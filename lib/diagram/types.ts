export interface PinRef {
  component: string;
  pin: string;
}

export interface DiagramConnection {
  id?: string;
  from: PinRef;
  to: PinRef;
}

export interface DiagramComponent {
  id: string;
  type: string;
  label?: string;
}

export interface Diagram {
  id: string;
  title?: string;
  components: DiagramComponent[];
  connections: DiagramConnection[];
}
