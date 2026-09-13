import type { LayoutEdge } from "./layout";

export type WireKind = "ground" | "power" | "signal";

// Wire colors: fixed colors for the two nets a viewer needs to recognize at a
// glance (power and ground), everything else cycles through a categorical
// palette (dataviz skill default) keyed by the pin pair so distinct signals
// stay visually distinguishable instead of every wire reading as one color.
export const GROUND_COLOR = "#111111";
export const POWER_COLOR = "#e34948";
export const SIGNAL_COLORS = [
  "#2a78d6", // blue
  "#eb6834", // orange
  "#1baf7a", // aqua
  "#eda100", // yellow
  "#e87ba4", // magenta
  "#008300", // green
  "#4a3aa7", // violet
];

export function isGroundPin(pinName: string): boolean {
  const upper = pinName.toUpperCase();
  return upper.endsWith("GND") || upper.endsWith("-");
}

export function isPowerPin(pinName: string): boolean {
  const upper = pinName.toUpperCase();
  return (
    upper.endsWith("+") ||
    upper.endsWith("VCC") ||
    upper === "VIN" ||
    upper === "3V3" ||
    upper === "5V" ||
    upper === "AC_L"
  );
}

// Simple stable string hash (FNV-1a) so the same pin pair always gets the
// same color across renders.
function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function classifyWire(edge: Pick<LayoutEdge, "from" | "to">): { kind: WireKind; color: string } {
  if (isGroundPin(edge.from.pin) || isGroundPin(edge.to.pin)) {
    return { kind: "ground", color: GROUND_COLOR };
  }
  if (isPowerPin(edge.from.pin) || isPowerPin(edge.to.pin)) {
    return { kind: "power", color: POWER_COLOR };
  }

  // Sorted so the same net gets the same color regardless of which end is "from".
  const key = [`${edge.from.component}.${edge.from.pin}`, `${edge.to.component}.${edge.to.pin}`].sort().join("|");
  return { kind: "signal", color: SIGNAL_COLORS[hashString(key) % SIGNAL_COLORS.length] };
}

export function edgeColor(edge: Pick<LayoutEdge, "from" | "to">): string {
  return classifyWire(edge).color;
}
