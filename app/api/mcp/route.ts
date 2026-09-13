import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createDiagramMcpServer } from "@/lib/mcp/server";

// No auth and no persistent sessions: each request gets a fresh server and
// transport (sessionIdGenerator: undefined = stateless mode), which fits a
// serverless deployment where nothing survives between invocations anyway.
export async function POST(request: Request): Promise<Response> {
  const server = createDiagramMcpServer();
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined });

  await server.connect(transport);
  return transport.handleRequest(request);
}

function methodNotAllowed(): Response {
  return Response.json(
    { jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed." }, id: null },
    { status: 405 },
  );
}

export const GET = methodNotAllowed;
export const DELETE = methodNotAllowed;
