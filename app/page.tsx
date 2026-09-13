import Link from "next/link";
import { z } from "zod";
import { toolDefinitions } from "@/lib/mcp/tool-definitions";
import { getBaseUrl } from "@/lib/site-url";

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="mt-3 overflow-x-auto rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm dark:border-zinc-800 dark:bg-zinc-900">
      <code className="font-mono">{children}</code>
    </pre>
  );
}

function formatParamsSchema(shape: Record<string, z.ZodType>): string {
  // Every tool's schema repeats the same $schema line; it's identical noise here, not information.
  const schema = z.toJSONSchema(z.object(shape)) as Record<string, unknown>;
  delete schema.$schema;
  return JSON.stringify(schema, null, 2);
}

export default function Home() {
  const endpoint = `${getBaseUrl()}/api/mcp`;

  const clientConfig = JSON.stringify(
    { mcpServers: { "electronics-diagrams": { url: endpoint } } },
    null,
    2,
  );

  return (
    <div className="min-h-full bg-background text-foreground">
      <main className="mx-auto flex max-w-3xl flex-col gap-12 px-6 py-16">
        <header>
          <h1 className="text-3xl font-semibold tracking-tight">Electronics Diagram MCP Server</h1>
          <p className="mt-3 text-lg text-zinc-600 dark:text-zinc-400">
            Lets an LLM design electronics wiring diagrams from JSON over MCP, and render them to an image.
          </p>
        </header>

        <section>
          <h2 className="text-xl font-semibold">Connect</h2>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            Streamable HTTP, no authentication or sessions. Point an MCP client at:
          </p>
          <CodeBlock>{`POST ${endpoint}`}</CodeBlock>
          <p className="mt-4 text-zinc-600 dark:text-zinc-400">Example client configuration:</p>
          <CodeBlock>{clientConfig}</CodeBlock>
        </section>

        <section>
          <h2 className="text-xl font-semibold">Tools</h2>
          <div className="mt-4 flex flex-col gap-6">
            {toolDefinitions.map((tool) => (
              <div key={tool.name} className="rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
                <h3 className="font-mono text-base font-semibold">{tool.name}</h3>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{tool.description}</p>
                <p className="mt-4 text-xs font-medium tracking-wide text-zinc-500 uppercase">Parameters</p>
                <CodeBlock>
                  {tool.inputShape ? formatParamsSchema(tool.inputShape) : "None"}
                </CodeBlock>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold">Diagram format</h2>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            Diagrams are JSON (see <code className="font-mono text-sm">schema/diagram.schema.json</code>): a list of
            component instances and pin-to-pin connections. Component placement and wire routing are computed
            automatically — there&apos;s no canvas or position to configure. Call{" "}
            <code className="font-mono text-sm">list_component_types</code> first to see every available component
            type and its pins.
          </p>
          <p className="mt-4 text-zinc-600 dark:text-zinc-400">
            See the{" "}
            <Link href="/components" className="underline hover:text-zinc-700 dark:hover:text-zinc-300">
              full list of supported components
            </Link>{" "}
            for a human-readable reference.
          </p>
        </section>
      </main>
    </div>
  );
}
