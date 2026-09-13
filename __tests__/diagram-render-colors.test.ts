import { GROUND_COLOR, POWER_COLOR, SIGNAL_COLORS, edgeColor } from "../lib/diagram/render";
import type { LayoutEdge } from "../lib/diagram/layout";

function edge(fromPin: string, toPin: string): LayoutEdge {
  return {
    id: "e",
    points: [],
    from: { component: "a", pin: fromPin },
    to: { component: "b", pin: toPin },
  };
}

describe("edgeColor", () => {
  test("colors ground pins black regardless of which end has GND", () => {
    expect(edgeColor(edge("GND", "D4"))).toBe(GROUND_COLOR);
    expect(edgeColor(edge("D4", "GND"))).toBe(GROUND_COLOR);
    expect(edgeColor(edge("PSU_GND", "AC_GND"))).toBe(GROUND_COLOR);
    expect(edgeColor(edge("HEATER-", "HEATER-"))).toBe(GROUND_COLOR);
  });

  test("colors power/load pins red regardless of which end", () => {
    expect(edgeColor(edge("VCC", "3V3"))).toBe(POWER_COLOR);
    expect(edgeColor(edge("D4", "VIN"))).toBe(POWER_COLOR);
    expect(edgeColor(edge("HEATER+", "PSU_12V"))).toBe(POWER_COLOR);
    expect(edgeColor(edge("LCD_VCC", "5V"))).toBe(POWER_COLOR);
  });

  test("ground takes priority if a connection somehow mixes ground and power naming", () => {
    expect(edgeColor(edge("GND", "VCC"))).toBe(GROUND_COLOR);
  });

  test("signal pins get a color from the categorical palette, not the fixed colors", () => {
    const color = edgeColor(edge("OUT", "D4"));
    expect(SIGNAL_COLORS).toContain(color);
    expect(color).not.toBe(GROUND_COLOR);
    expect(color).not.toBe(POWER_COLOR);
  });

  test("the same pin pair always gets the same color", () => {
    const first = edgeColor(edge("OUT", "D4"));
    const second = edgeColor(edge("OUT", "D4"));
    expect(first).toBe(second);
  });

  test("color doesn't depend on which side is 'from' vs 'to'", () => {
    const forward = edgeColor(edge("OUT", "D4"));
    const reversed: LayoutEdge = {
      id: "e",
      points: [],
      from: { component: "b", pin: "D4" },
      to: { component: "a", pin: "OUT" },
    };
    expect(edgeColor(reversed)).toBe(forward);
  });

  test("different signal pin pairs are spread across the palette (not all identical)", () => {
    const colors = new Set([
      edgeColor(edge("OUT", "D4")),
      edgeColor(edge("OUT", "D5")),
      edgeColor(edge("OUT", "D14")),
      edgeColor(edge("OUT", "D21")),
      edgeColor(edge("OUT", "D25")),
    ]);
    expect(colors.size).toBeGreaterThan(1);
  });
});
