import { layoutDiagram } from "../lib/diagram/layout";
import type { Diagram } from "../lib/diagram/types";

const diagram: Diagram = {
  id: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  title: "Layout test",
  components: [
    { id: "sensor-1", type: "hall_sensor" },
    { id: "mcu-1", type: "esp32", label: "Main ESP32" },
    { id: "psu-1", type: "power_supply" },
  ],
  connections: [
    { id: "c1", from: { component: "sensor-1", pin: "OUT" }, to: { component: "mcu-1", pin: "D4" } },
    { id: "c2", from: { component: "sensor-1", pin: "VCC" }, to: { component: "mcu-1", pin: "3V3" } },
    { id: "c3", from: { component: "psu-1", pin: "DC+" }, to: { component: "mcu-1", pin: "VIN" } },
  ],
};

function rectsOverlap(a: { x: number; y: number; width: number; height: number }, b: typeof a): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

describe("layoutDiagram", () => {
  test("positions every component with a non-overlapping box", async () => {
    const layout = await layoutDiagram(diagram);
    expect(layout.nodes).toHaveLength(diagram.components.length);

    for (const node of layout.nodes) {
      expect(node.width).toBeGreaterThan(0);
      expect(node.height).toBeGreaterThan(0);
    }

    for (let i = 0; i < layout.nodes.length; i++) {
      for (let j = i + 1; j < layout.nodes.length; j++) {
        expect(rectsOverlap(layout.nodes[i], layout.nodes[j])).toBe(false);
      }
    }
  });

  test("produces one routed edge per connection, each with at least a start and end point", async () => {
    const layout = await layoutDiagram(diagram);
    expect(layout.edges).toHaveLength(diagram.connections.length);
    for (const edge of layout.edges) {
      expect(edge.points.length).toBeGreaterThanOrEqual(2);
    }
  });

  test("every edge starts and ends exactly on the referenced pin's coordinates", async () => {
    const layout = await layoutDiagram(diagram);
    const pinCoord = (componentId: string, pin: string) => {
      const node = layout.nodes.find((n) => n.componentId === componentId)!;
      const found = node.pins.find((p) => p.name === pin)!;
      return { x: found.x, y: found.y };
    };

    for (const connection of diagram.connections) {
      const edge = layout.edges.find((e) => e.id === connection.id)!;
      const from = pinCoord(connection.from.component, connection.from.pin);
      const to = pinCoord(connection.to.component, connection.to.pin);
      const first = edge.points[0];
      const last = edge.points[edge.points.length - 1];

      // elkjs positions ports with sub-pixel rounding, so allow a 1px tolerance.
      expect(Math.abs(first.x - from.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(first.y - from.y)).toBeLessThanOrEqual(1);
      expect(Math.abs(last.x - to.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(last.y - to.y)).toBeLessThanOrEqual(1);
    }
  });

  test("throws a clear error for an unknown component type", async () => {
    const bad: Diagram = {
      id: diagram.id,
      components: [{ id: "x1", type: "not_a_real_type" }],
      connections: [],
    };
    await expect(layoutDiagram(bad)).rejects.toThrow(/unknown component type/i);
  });
});
