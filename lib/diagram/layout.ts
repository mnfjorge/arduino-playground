import ELK, { type ElkExtendedEdge, type ElkNode } from "elkjs/lib/elk.bundled.js";
import { getComponentDefinition, type ComponentPin } from "../components/registry";
import type { Diagram } from "./types";

const PIN_SPACING = 24;
const NODE_PADDING = 16;
const MIN_NODE_WIDTH = 160;
const MIN_NODE_HEIGHT = 60;
const CHARS_TO_PX = 7;
// How far a pin's connecting dot sits from the component box. Ports are
// placed out here (not on the box edge) so a wire's routing - and its first
// bend - starts with real clearance from the component instead of hugging it.
const PIN_STUB = 28;

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
 * Cheap first pass with no ports: edges connect node-to-node directly, so
 * elk only needs to decide each component's column, not route anything. We
 * use the resulting x-centers to decide, per pin, whether the component it
 * connects to sits to the left or right - that's what determines which side
 * of the box the pin (and its wire) should exit from.
 */
async function estimateComponentCenters(diagram: Diagram): Promise<Map<string, number>> {
  const elk = new ELK();

  const nodes: ElkNode[] = diagram.components.map((component) => {
    const definition = getComponentDefinition(component.type);
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
    id: connection.id ?? `edge-${index}`,
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

  const elkNodes: ElkNode[] = diagram.components.map((component) => {
    const definition = getComponentDefinition(component.type);
    if (!definition) {
      throw new Error(`Unknown component type "${component.type}" for component "${component.id}"`);
    }

    const sides = new Map<string, PinSide>();
    definition.pins.forEach((pin, index) => {
      sides.set(pin.name, choosePinSide(component.id, pin.name, diagram, centers, index));
    });

    const west = definition.pins.filter((pin) => sides.get(pin.name) === "WEST");
    const east = definition.pins.filter((pin) => sides.get(pin.name) === "EAST");
    const label = component.label ?? definition.label;

    const height = nodeHeight(west.length, east.length);
    const width = estimateNodeWidth(
      label,
      definition.pins.map((pin) => pin.label ?? pin.name),
    );

    const sidePins = (pins: ComponentPin[], side: PinSide) =>
      pins.map((pin, index) => ({
        id: pinId(component.id, pin.name),
        width: 1,
        height: 1,
        // FIXED_POS below means these coordinates are taken as-is: y is spread
        // evenly down the box's interior, x sits PIN_STUB outside the box edge.
        x: side === "WEST" ? -PIN_STUB : width + PIN_STUB,
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

  const elkEdges: ElkExtendedEdge[] = diagram.connections.map((connection, index) => ({
    id: connection.id ?? `edge-${index}`,
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
    const definition = getComponentDefinition(component.type);
    if (!definition) {
      throw new Error(`Unknown component type "${component.type}" for component "${component.id}"`);
    }
    const pinByName = new Map(definition.pins.map((pin) => [pin.name, pin]));
    const nodeX = node.x ?? 0;
    const nodeY = node.y ?? 0;

    const pins: LayoutPin[] = (node.ports ?? []).map((port) => {
      const pinName = port.id.slice(pinId(component.id, "").length);
      const pinDef = pinByName.get(pinName);
      const side: PinSide = (port.x ?? 0) < 0 ? "WEST" : "EAST";
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
      x: nodeX,
      y: nodeY,
      width: node.width ?? MIN_NODE_WIDTH,
      height: node.height ?? MIN_NODE_HEIGHT,
      pins,
    };
  });

  const edges: LayoutEdge[] = (result.edges ?? []).map((edge) => {
    const points: { x: number; y: number }[] = [];
    for (const section of edge.sections ?? []) {
      points.push(section.startPoint, ...(section.bendPoints ?? []), section.endPoint);
    }
    return { id: edge.id ?? "edge", points };
  });

  return {
    width: result.width ?? MIN_NODE_WIDTH,
    height: result.height ?? MIN_NODE_HEIGHT,
    nodes,
    edges,
  };
}
