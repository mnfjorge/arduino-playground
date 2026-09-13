"use client";

import type { Node, NodeProps } from "@xyflow/react";
import type { ComponentDefinition } from "@/lib/components/registry";
import type { LayoutNode, LayoutPin } from "@/lib/diagram/layout";

export interface ComponentNodeData extends Record<string, unknown> {
  layoutNode: LayoutNode;
  definition?: ComponentDefinition;
  onHoverComponent: (node: LayoutNode, definition?: ComponentDefinition) => void;
  onHoverPin: (node: LayoutNode, pin: LayoutPin, definition?: ComponentDefinition) => void;
  onLeave: () => void;
}

export type ComponentNodeType = Node<ComponentNodeData, "component">;

const PIN_SIZE = 10;

export function ComponentNode({ data }: NodeProps<ComponentNodeType>) {
  const { layoutNode, definition, onHoverComponent, onHoverPin, onLeave } = data;

  return (
    <div
      className="relative rounded-lg border-2 border-zinc-800 bg-white shadow-sm dark:border-zinc-200 dark:bg-zinc-900"
      style={{ width: layoutNode.width, height: layoutNode.height }}
      onMouseEnter={() => onHoverComponent(layoutNode, definition)}
      onMouseLeave={onLeave}
    >
      <div className="pointer-events-none absolute inset-x-0 top-1 truncate px-2 text-center text-xs font-semibold text-zinc-900 dark:text-zinc-100">
        {layoutNode.label}
      </div>
      <div className="pointer-events-none absolute inset-x-0 top-[22px] truncate px-2 text-center text-[10px] text-zinc-500 dark:text-zinc-400">
        {layoutNode.type}
      </div>

      {layoutNode.pins.map((pin) => {
        const left = pin.x - layoutNode.x;
        const top = pin.y - layoutNode.y;
        return (
          <div
            key={pin.name}
            className="absolute rounded-full border border-zinc-900 bg-zinc-900 transition-transform hover:scale-150 dark:border-zinc-100 dark:bg-zinc-100"
            style={{
              width: PIN_SIZE,
              height: PIN_SIZE,
              left: left - PIN_SIZE / 2,
              top: top - PIN_SIZE / 2,
              cursor: "pointer",
            }}
            onMouseEnter={(event) => {
              event.stopPropagation();
              onHoverPin(layoutNode, pin, definition);
            }}
            onMouseLeave={(event) => {
              event.stopPropagation();
              onHoverComponent(layoutNode, definition);
            }}
          />
        );
      })}
    </div>
  );
}
