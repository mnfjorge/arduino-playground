import ELK, { type ElkExtendedEdge, type ElkNode } from "elkjs/lib/elk.bundled.js";
import type { ComponentPin } from "../components/registry";
import { collectEphemeralDefinitions, resolveDefinition } from "./definitions";
import type { Diagram, DiagramConnection, PinRef } from "./types";

const PIN_SPACING = 24;
const NODE_PADDING = 16;
const MIN_NODE_WIDTH = 160;
const MIN_NODE_HEIGHT = 60;
const CHARS_TO_PX = 7;
// How far a pin's connecting dot sits from the component box. Ports are
// placed out here (not on the box edge) so a wire's routing - and its first
// bend - starts with real clearance from the component instead of hugging it.
const PIN_STUB = 28;
// Approx glyph width for the 10px monospace font pin labels render in
// (see PIN_LABEL_GAP in render.ts / component-node.tsx, which this mirrors).
const PIN_LABEL_CHAR_PX = 6;
const PIN_LABEL_GAP = 6;
// Extra room past a label's own text before another component's wire may
// route through - without this, ELK (which only knows about the component's
// box, not the label sitting past its pin stubs) can legally draw another
// wire's bend straight across the label.
const PIN_LABEL_CLEARANCE = 6;

// Minimum distance a routed wire must run straight out from a pin - along the
// same axis as the pin's own stub - before its first turn. Without this, ELK
// sometimes bends a wire immediately at the port (since every pin on a side
// shares that side's x-coordinate, a vertical trunk line fits neatly right
// through the ports themselves), which reads as the wire ignoring the pin it
// came from rather than extending away from it.
const WIRE_EXIT_CLEARANCE = 16;

export type PinSide = "WEST" | "EAST";

export interface LayoutPin {
  name: string;
  label?: string;
  side: PinSide;
  x: number;
  y: number;
}

export interface LayoutNode {
  componentId: string;
  type: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  pins: LayoutPin[];
}

export interface LayoutEdge {
  id: string;
  points: { x: number; y: number }[];
  from: PinRef;
  to: PinRef;
}

export interface DiagramLayout {
  width: number;
  height: number;
  nodes: LayoutNode[];
  edges: LayoutEdge[];
}

function pinId(componentId: string, pinName: string): string {
  return `${componentId}::${pinName}`;
}

function connectionId(connection: DiagramConnection, index: number): string {
  return connection.id ?? `edge-${index}`;
}

function estimateNodeWidth(label: string, pinLabels: string[]): number {
  const longestPin = pinLabels.reduce((max, text) => Math.max(max, text.length), 0);
  // Room for a pin label on each side plus the box's own interior.
  const contentWidth = Math.max(label.length * CHARS_TO_PX, longestPin * CHARS_TO_PX * 2 + 60);
  return Math.max(MIN_NODE_WIDTH, contentWidth);
}

function nodeHeight(westCount: number, eastCount: number): number {
  return Math.max(MIN_NODE_HEIGHT, Math.max(westCount, eastCount) * PIN_SPACING + NODE_PADDING * 2);
}

/**
 * How far a side's pin labels reach out past PIN_STUB - the width ELK needs
 * to treat as part of this node's footprint so its own edgeNode spacing
 * keeps *other* components' wires from routing across the label text. 0 when
 * the side has no pins, which keeps that side's margin at plain PIN_STUB.
 */
function pinLabelReach(pins: ComponentPin[]): number {
  const widest = pins.reduce((max, pin) => Math.max(max, pin.name.length * PIN_LABEL_CHAR_PX), 0);
  return widest === 0 ? 0 : PIN_LABEL_GAP + widest + PIN_LABEL_CLEARANCE;
}

/**
 * Cheap first pass with no ports: edges connect node-to-node directly, so
 * elk only needs to decide each component's column, not route anything. We
 * use the resulting x-centers to decide, per pin, whether the component it
 * connects to sits to the left or right - that's what determines which side
 * of the box the pin (and its wire) should exit from.
 */
async function estimateComponentCenters(diagram: Diagram): Promise<Map<string, number>> {
  const elk = new ELK();
  const ephemeral = collectEphemeralDefinitions(diagram).definitions;

  const nodes: ElkNode[] = diagram.components.map((component) => {
    const definition = resolveDefinition(component.type, ephemeral);
    if (!definition) {
      throw new Error(`Unknown component type "${component.type}" for component "${component.id}"`);
    }
    const half = Math.ceil(definition.pins.length / 2);
    return {
      id: component.id,
      width: estimateNodeWidth(
        component.label ?? definition.label,
        definition.pins.map((pin) => pin.label ?? pin.name),
      ),
      height: nodeHeight(half, definition.pins.length - half),
    };
  });

  const edges: ElkExtendedEdge[] = diagram.connections.map((connection, index) => ({
    id: connectionId(connection, index),
    sources: [connection.from.component],
    targets: [connection.to.component],
  }));

  const graph: ElkNode = {
    id: "root",
    layoutOptions: { "elk.algorithm": "layered", "elk.direction": "RIGHT" },
    children: nodes,
    edges,
  };

  const result = await elk.layout(graph);
  const centers = new Map<string, number>();
  for (const node of result.children ?? []) {
    centers.set(node.id, (node.x ?? 0) + (node.width ?? 0) / 2);
  }
  return centers;
}

/**
 * Decides which side of the box a pin's connecting dot belongs on, based on
 * whether the component(s) it's wired to sit to the left or right of this
 * one (per the preliminary layout). A pin with connections on both sides, or
 * none at all, falls back to alternating so pins still spread across both
 * sides for box sizing/legibility.
 */
function choosePinSide(
  componentId: string,
  pinName: string,
  diagram: Diagram,
  centers: Map<string, number>,
  fallbackIndex: number,
): PinSide {
  const ownCenter = centers.get(componentId) ?? 0;
  let westVotes = 0;
  let eastVotes = 0;

  for (const connection of diagram.connections) {
    let otherComponent: string | undefined;
    if (connection.from.component === componentId && connection.from.pin === pinName) {
      otherComponent = connection.to.component;
    } else if (connection.to.component === componentId && connection.to.pin === pinName) {
      otherComponent = connection.from.component;
    }
    if (!otherComponent || otherComponent === componentId) continue;

    const otherCenter = centers.get(otherComponent);
    if (otherCenter === undefined) continue;
    if (otherCenter < ownCenter) westVotes++;
    else if (otherCenter > ownCenter) eastVotes++;
  }

  if (westVotes > eastVotes) return "WEST";
  if (eastVotes > westVotes) return "EAST";
  return fallbackIndex % 2 === 0 ? "WEST" : "EAST";
}

/** Which way a wire should run when leaving/arriving at a pin on this side. */
function pinExitDirection(side: PinSide): 1 | -1 {
  return side === "WEST" ? -1 : 1;
}

/**
 * If the segment touching `pin` (the array's first point when end is
 * "start", its last when "end") runs straight vertical, insert points so it
 * instead runs WIRE_EXIT_CLEARANCE horizontally - in the pin's own exit
 * direction - before turning. When the segment beyond that already
 * continues horizontally at the same y, the turn point is simply slid out
 * to the clearance distance (no extra bend); otherwise a small detour is
 * added that returns to the pin's exact column before reaching it.
 */
function enforcePinExit(
  points: { x: number; y: number }[],
  dir: 1 | -1,
  end: "start" | "end",
): { x: number; y: number }[] {
  const pin = end === "start" ? points[0] : points[points.length - 1];
  const neighbor = end === "start" ? points[1] : points[points.length - 2];
  if (neighbor.x !== pin.x) return points;

  const beyond = end === "start" ? points[2] : points[points.length - 3];
  const jogX = pin.x + dir * WIRE_EXIT_CLEARANCE;

  if (beyond && beyond.y === neighbor.y) {
    const slid = { x: jogX, y: neighbor.y };
    return end === "start" ? [pin, slid, ...points.slice(2)] : [...points.slice(0, -2), slid, pin];
  }

  const out = { x: jogX, y: pin.y };
  const turn = { x: jogX, y: neighbor.y };
  return end === "start" ? [pin, out, turn, ...points.slice(1)] : [...points.slice(0, -1), turn, out, pin];
}

/** Applies enforcePinExit at both ends of a routed wire. */
function enforceHorizontalPinExits(
  points: { x: number; y: number }[],
  fromSide: PinSide,
  toSide: PinSide,
): { x: number; y: number }[] {
  if (points.length < 2) return points;
  const withStartExit = enforcePinExit(points, pinExitDirection(fromSide), "start");
  return enforcePinExit(withStartExit, pinExitDirection(toSide), "end");
}

/**
 * Computes node placement and orthogonal wire routing for a diagram using elkjs.
 * Each pin is assigned to the west or east side of its component's box (like
 * a simple IC symbol) based on which side its connected component(s) land
 * on, so wires exit toward where they're actually headed instead of
 * potentially looping around the box.
 */
export async function layoutDiagram(diagram: Diagram): Promise<DiagramLayout> {
  const centers = await estimateComponentCenters(diagram);
  const elk = new ELK();
  const ephemeral = collectEphemeralDefinitions(diagram).definitions;

  // Populated per-node below, then used once layout comes back to (a) know
  // which side each pin resolved to without re-deriving it from geometry,
  // and (b) recover the visible box's x/width from the wider footprint ELK
  // was actually given (see pinLabelReach above).
  const pinSides = new Map<string, PinSide>();
  const nodeBoxes = new Map<string, { coreWidth: number; westMargin: number }>();

  const elkNodes: ElkNode[] = diagram.components.map((component) => {
    const definition = resolveDefinition(component.type, ephemeral);
    if (!definition) {
      throw new Error(`Unknown component type "${component.type}" for component "${component.id}"`);
    }

    const sides = new Map<string, PinSide>();
    definition.pins.forEach((pin, index) => {
      sides.set(pin.name, choosePinSide(component.id, pin.name, diagram, centers, index));
    });

    definition.pins.forEach((pin) => {
      pinSides.set(pinId(component.id, pin.name), sides.get(pin.name) ?? "EAST");
    });

    const west = definition.pins.filter((pin) => sides.get(pin.name) === "WEST");
    const east = definition.pins.filter((pin) => sides.get(pin.name) === "EAST");
    const label = component.label ?? definition.label;

    const height = nodeHeight(west.length, east.length);
    const coreWidth = estimateNodeWidth(
      label,
      definition.pins.map((pin) => pin.label ?? pin.name),
    );

    // Each side's margin is PIN_STUB plus room for that side's own pin
    // labels - folding the label footprint into the node's declared width so
    // ELK's edgeNode spacing keeps other components' wires clear of it too.
    const westMargin = PIN_STUB + pinLabelReach(west);
    const eastMargin = PIN_STUB + pinLabelReach(east);
    const width = westMargin + coreWidth + eastMargin;
    nodeBoxes.set(component.id, { coreWidth, westMargin });

    const sidePins = (pins: ComponentPin[], side: PinSide) =>
      pins.map((pin, index) => ({
        id: pinId(component.id, pin.name),
        width: 1,
        height: 1,
        // FIXED_POS below means these coordinates are taken as-is: y is spread
        // evenly down the box's interior, x sits PIN_STUB outside the (core)
        // box edge - westMargin/eastMargin already include that PIN_STUB.
        x: side === "WEST" ? westMargin - PIN_STUB : westMargin + coreWidth + PIN_STUB,
        y: NODE_PADDING + ((index + 0.5) / pins.length) * (height - NODE_PADDING * 2),
      }));

    const ports = [...sidePins(west, "WEST"), ...sidePins(east, "EAST")];

    return {
      id: component.id,
      width,
      height,
      layoutOptions: { "elk.portConstraints": "FIXED_POS" },
      ports,
    };
  });

  const connectionById = new Map(diagram.connections.map((connection, index) => [connectionId(connection, index), connection]));

  const elkEdges: ElkExtendedEdge[] = diagram.connections.map((connection, index) => ({
    id: connectionId(connection, index),
    sources: [pinId(connection.from.component, connection.from.pin)],
    targets: [pinId(connection.to.component, connection.to.pin)],
  }));

  const graph: ElkNode = {
    id: "root",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": "RIGHT",
      "elk.edgeRouting": "ORTHOGONAL",
      "elk.spacing.nodeNode": "80",
      "elk.layered.spacing.nodeNodeBetweenLayers": "120",
      "elk.spacing.edgeEdge": "12",
      "elk.spacing.edgeNode": "20",
    },
    children: elkNodes,
    edges: elkEdges,
  };

  const result = await elk.layout(graph);

  const nodes: LayoutNode[] = (result.children ?? []).map((node) => {
    const component = diagram.components.find((c) => c.id === node.id);
    if (!component) {
      throw new Error(`Layout produced an unexpected node id "${node.id}"`);
    }
    const definition = resolveDefinition(component.type, ephemeral);
    if (!definition) {
      throw new Error(`Unknown component type "${component.type}" for component "${component.id}"`);
    }
    const pinByName = new Map(definition.pins.map((pin) => [pin.name, pin]));
    const nodeX = node.x ?? 0;
    const nodeY = node.y ?? 0;
    const box = nodeBoxes.get(component.id) ?? { coreWidth: node.width ?? MIN_NODE_WIDTH, westMargin: 0 };

    const pins: LayoutPin[] = (node.ports ?? []).map((port) => {
      const pinName = port.id.slice(pinId(component.id, "").length);
      const pinDef = pinByName.get(pinName);
      const side: PinSide = pinSides.get(port.id) ?? "EAST";
      return {
        name: pinDef?.name ?? pinName,
        label: pinDef?.label,
        side,
        x: nodeX + (port.x ?? 0),
        y: nodeY + (port.y ?? 0),
      };
    });

    return {
      componentId: component.id,
      type: component.type,
      label: component.label ?? definition.label,
      // node.width from ELK is the widened footprint (core box + label
      // margins on each side, see pinLabelReach) - the visible box is just
      // the core, offset in by westMargin.
      x: nodeX + box.westMargin,
      y: nodeY,
      width: box.coreWidth,
      height: node.height ?? MIN_NODE_HEIGHT,
      pins,
    };
  });

  const edges: LayoutEdge[] = (result.edges ?? []).map((edge) => {
    const points: { x: number; y: number }[] = [];
    for (const section of edge.sections ?? []) {
      points.push(section.startPoint, ...(section.bendPoints ?? []), section.endPoint);
    }
    const id = edge.id ?? "edge";
    const connection = connectionById.get(id);
    if (!connection) {
      throw new Error(`Layout produced an unexpected edge id "${id}"`);
    }
    const fromSide = pinSides.get(pinId(connection.from.component, connection.from.pin)) ?? "EAST";
    const toSide = pinSides.get(pinId(connection.to.component, connection.to.pin)) ?? "EAST";
    return { id, points: enforceHorizontalPinExits(points, fromSide, toSide), from: connection.from, to: connection.to };
  });

  return {
    width: result.width ?? MIN_NODE_WIDTH,
    height: result.height ?? MIN_NODE_HEIGHT,
    nodes,
    edges,
  };
}
