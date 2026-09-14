import type { ComponentPin } from "../components/registry";

export interface PinRef {
  component: string;
  pin: string;
}

export interface DiagramConnection {
  id?: string;
  from: PinRef;
  to: PinRef;
}

/** An ad-hoc component type definition scoped to a single diagram; see schema/component-definition.schema.json (minus 'type', which comes from the component's own 'type' field). */
export interface InlineComponentDefinition {
  label: string;
  category: string;
  description?: string;
  pins: ComponentPin[];
}

export interface DiagramComponent {
  id: string;
  type: string;
  label?: string;
  /** Only present when 'type' isn't a registered component type; defines it on the fly for this diagram. */
  definition?: InlineComponentDefinition;
}

export interface Diagram {
  id: string;
  title?: string;
  components: DiagramComponent[];
  connections: DiagramConnection[];
}
