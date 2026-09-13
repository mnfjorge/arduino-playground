import sharp from "sharp";
import { layoutDiagram, type DiagramLayout, type LayoutNode } from "./layout";
import type { Diagram } from "./types";

const MARGIN = 40;
const PIN_STUB = 14;
const FONT_FAMILY = "Helvetica, Arial, sans-serif";
const INK = "#1f2933";
const WIRE = "#2b6cb0";
const MUTED = "#52606d";

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
    const stubEndX = pin.side === "WEST" ? pin.x - PIN_STUB : pin.x + PIN_STUB;
    const textX = pin.side === "WEST" ? stubEndX - 6 : stubEndX + 6;
    const anchor = pin.side === "WEST" ? "end" : "start";
    parts.push(
      `<line x1="${pin.x}" y1="${pin.y}" x2="${stubEndX}" y2="${pin.y}" stroke="${INK}" stroke-width="2" />`,
      `<circle cx="${stubEndX}" cy="${pin.y}" r="3" fill="${INK}" />`,
      `<text x="${textX}" y="${pin.y + 3}" text-anchor="${anchor}" font-family="${FONT_FAMILY}" font-size="10" fill="${INK}">${escapeXml(pin.name)}</text>`,
    );
  }

  return parts.join("\n");
}

function renderEdge(points: { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  const path = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  return `<path d="${path}" fill="none" stroke="${WIRE}" stroke-width="2" />`;
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
    body.push(renderEdge(edge.points));
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
  return sharp(Buffer.from(svg)).flatten({ background: "#ffffff" }).jpeg({ quality: 90 }).toBuffer();
}
