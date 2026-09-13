import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createDiagram, listComponentTypes, renderDiagram, updateDiagram, type DiagramInput } from "./tools";
import { createDiagramTool, listComponentTypesTool, renderDiagramTool, updateDiagramTool } from "./tool-definitions";

function errorResult(errors: string[]) {
  return {
    isError: true,
    content: [{ type: "text" as const, text: `Diagram is invalid:\n${errors.map((e) => `- ${e}`).join("\n")}` }],
  };
}

function diagramSummary(action: string, diagram: DiagramInput) {
  return {
    content: [
      {
        type: "text" as const,
        text: `${action} diagram "${diagram.diagramId}" with ${diagram.components.length} component(s) and ${diagram.connections.length} connection(s). Call render_diagram to generate an image.`,
      },
    ],
    structuredContent: {
      diagramId: diagram.diagramId,
      componentCount: diagram.components.length,
      connectionCount: diagram.connections.length,
    },
  };
}

export function createDiagramMcpServer(): McpServer {
  const server = new McpServer({ name: "electronics-diagrams", version: "1.0.0" });

  server.registerTool(
    createDiagramTool.name,
    {
      title: createDiagramTool.title,
      description: createDiagramTool.description,
      inputSchema: createDiagramTool.inputShape,
    },
    async (input) => {
      const result = await createDiagram(input);
      return result.ok ? diagramSummary("Created", input) : errorResult(result.errors);
    },
  );

  server.registerTool(
    updateDiagramTool.name,
    {
      title: updateDiagramTool.title,
      description: updateDiagramTool.description,
      inputSchema: updateDiagramTool.inputShape,
    },
    async (input) => {
      const result = await updateDiagram(input);
      return result.ok ? diagramSummary("Updated", input) : errorResult(result.errors);
    },
  );

  server.registerTool(
    renderDiagramTool.name,
    {
      title: renderDiagramTool.title,
      description: renderDiagramTool.description,
      inputSchema: renderDiagramTool.inputShape,
    },
    async ({ diagramId }) => {
      const result = await renderDiagram(diagramId);
      if (!result.ok) return errorResult(result.errors);

      return {
        content: [
          { type: "text" as const, text: `Rendered diagram. View it at ${result.viewUrl}` },
          { type: "image" as const, data: result.jpeg.toString("base64"), mimeType: "image/jpeg" },
        ],
        structuredContent: {
          diagramId: result.diagramId,
          viewUrl: result.viewUrl,
        },
      };
    },
  );

  server.registerTool(
    listComponentTypesTool.name,
    { title: listComponentTypesTool.title, description: listComponentTypesTool.description },
    async () => {
      const types = listComponentTypes();
      return {
        content: [{ type: "text" as const, text: JSON.stringify(types, null, 2) }],
        structuredContent: { componentTypes: types },
      };
    },
  );

  return server;
}
