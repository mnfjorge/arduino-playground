import { Resvg } from "@resvg/resvg-js";
import path from "node:path";
import sharp from "sharp";
import { layoutDiagram, type DiagramLayout, type LayoutEdge, type LayoutNode } from "./layout";
import type { Diagram } from "./types";

const MARGIN = 40;
const FONT_FAMILY = "Geist";
const INK = "#1f2933";
const MUTED = "#52606d";

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

function isGroundPin(pinName: string): boolean {
  const upper = pinName.toUpperCase();
  return upper.endsWith("GND") || upper.endsWith("-");
}

function isPowerPin(pinName: string): boolean {
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

export function edgeColor(edge: LayoutEdge): string {
  if (isGroundPin(edge.from.pin) || isGroundPin(edge.to.pin)) return GROUND_COLOR;
  if (isPowerPin(edge.from.pin) || isPowerPin(edge.to.pin)) return POWER_COLOR;

  // Sorted so the same net gets the same color regardless of which end is "from".
  const key = [`${edge.from.component}.${edge.from.pin}`, `${edge.to.component}.${edge.to.pin}`].sort().join("|");
  return SIGNAL_COLORS[hashString(key) % SIGNAL_COLORS.length];
}

// Serverless runtimes (Vercel included) generally ship no system fonts, so
// asking a raster engine to render SVG <text> via fontconfig - which is what
// sharp/librsvg do - silently draws empty "tofu" boxes instead of glyphs
// (this can go unnoticed locally if your machine happens to have fonts
// installed). resvg sidesteps that: given loadSystemFonts: false and our own
// font files, rendering is identical everywhere. It only emits PNG, so sharp
// still does the final PNG -> JPEG conversion (pure raster, no fonts involved).
const FONT_DIR = path.join(process.cwd(), "assets/fonts");
const FONT_FILES = ["Geist-Regular.ttf", "Geist-SemiBold.ttf", "Geist-Bold.ttf"].map((file) =>
  path.join(FONT_DIR, file),
);

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function renderNode(node: LayoutNode): string {
  const parts: string[] = [
    `<rect x="${node.x}" y="${node.y}" width="${node.width}" height="${node.height}" rx="8" fill="#ffffff" stroke="${INK}" stroke-width="2" />`,
    `<text x="${node.x + node.width / 2}" y="${node.y + 20}" text-anchor="middle" font-family="${FONT_FAMILY}" font-size="14" font-weight="600" fill="${INK}">${escapeXml(node.label)}</text>`,
    `<text x="${node.x + node.width / 2}" y="${node.y + 36}" text-anchor="middle" font-family="${FONT_FAMILY}" font-size="11" fill="${MUTED}">${escapeXml(node.type)}</text>`,
  ];

  for (const pin of node.pins) {
    // pin.x/y is the connecting dot, already offset away from the box by the
    // layout (see PIN_STUB in layout.ts) - the stub just draws the box edge
    // in between, it isn't what creates the spacing.
    const boxEdgeX = pin.side === "WEST" ? node.x : node.x + node.width;
    const textX = pin.side === "WEST" ? pin.x - 6 : pin.x + 6;
    const anchor = pin.side === "WEST" ? "end" : "start";
    parts.push(
      `<line x1="${boxEdgeX}" y1="${pin.y}" x2="${pin.x}" y2="${pin.y}" stroke="${INK}" stroke-width="2" />`,
      `<circle cx="${pin.x}" cy="${pin.y}" r="3" fill="${INK}" />`,
      `<text x="${textX}" y="${pin.y + 3}" text-anchor="${anchor}" font-family="${FONT_FAMILY}" font-size="10" fill="${INK}">${escapeXml(pin.name)}</text>`,
    );
  }

  return parts.join("\n");
}

function renderEdge(edge: LayoutEdge): string {
  if (edge.points.length === 0) return "";
  const path = edge.points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  return `<path d="${path}" fill="none" stroke="${edgeColor(edge)}" stroke-width="2" />`;
}

export function diagramToSvg(diagram: Diagram, layout: DiagramLayout): string {
  const titleHeight = diagram.title ? 28 : 0;
  const width = Math.ceil(layout.width + MARGIN * 2);
  const height = Math.ceil(layout.height + MARGIN * 2 + titleHeight);

  const body: string[] = [`<rect x="0" y="0" width="${width}" height="${height}" fill="#ffffff" />`];

  if (diagram.title) {
    body.push(
      `<text x="${width / 2}" y="24" text-anchor="middle" font-family="${FONT_FAMILY}" font-size="18" font-weight="700" fill="${INK}">${escapeXml(diagram.title)}</text>`,
    );
  }

  body.push(`<g transform="translate(${MARGIN}, ${MARGIN + titleHeight})">`);
  for (const edge of layout.edges) {
    body.push(renderEdge(edge));
  }
  for (const node of layout.nodes) {
    body.push(renderNode(node));
  }
  body.push("</g>");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">\n${body.join("\n")}\n</svg>`;
}

export async function renderDiagramToJpeg(diagram: Diagram): Promise<Buffer> {
  const layout = await layoutDiagram(diagram);
  const svg = diagramToSvg(diagram, layout);

  const resvg = new Resvg(svg, {
    font: {
      loadSystemFonts: false,
      fontFiles: FONT_FILES,
      defaultFontFamily: FONT_FAMILY,
      sansSerifFamily: FONT_FAMILY,
    },
    background: "#ffffff",
  });
  const png = resvg.render().asPng();

  return sharp(png).jpeg({ quality: 90 }).toBuffer();
}
