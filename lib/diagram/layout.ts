import ELK, { type ElkExtendedEdge, type ElkNode } from "elkjs/lib/elk.bundled.js";
import { getComponentDefinition } from "../components/registry";
import type { Diagram } from "./types";

const PIN_SPACING = 24;
const NODE_PADDING = 16;
const MIN_NODE_WIDTH = 160;
const MIN_NODE_HEIGHT = 60;
const CHARS_TO_PX = 7;

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

/**
 * Computes node placement and orthogonal wire routing for a diagram using elkjs.
 * Pins are split evenly across the west/east sides of each component's box
 * (like a simple IC symbol) so every pin label renders as plain horizontal
 * text instead of needing rotation for top/bottom placement.
 */
export async function layoutDiagram(diagram: Diagram): Promise<DiagramLayout> {
  const elk = new ELK();

  const elkNodes: ElkNode[] = diagram.components.map((component) => {
    const definition = getComponentDefinition(component.type);
    if (!definition) {
      throw new Error(`Unknown component type "${component.type}" for component "${component.id}"`);
    }

    const west = definition.pins.filter((_, index) => index % 2 === 0);
    const east = definition.pins.filter((_, index) => index % 2 === 1);
    const label = component.label ?? definition.label;

    const height = Math.max(MIN_NODE_HEIGHT, Math.max(west.length, east.length) * PIN_SPACING + NODE_PADDING * 2);
    const width = estimateNodeWidth(
      label,
      definition.pins.map((pin) => pin.label ?? pin.name),
    );

    const ports = [...west, ...east].map((pin, index) => ({
      id: pinId(component.id, pin.name),
      width: 1,
      height: 1,
      layoutOptions: {
        "elk.port.side": index < west.length ? "WEST" : "EAST",
      },
    }));

    return {
      id: component.id,
      width,
      height,
      layoutOptions: { "elk.portConstraints": "FIXED_SIDE" },
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
      const side = (port.layoutOptions?.["elk.port.side"] as PinSide | undefined) ?? "WEST";
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
