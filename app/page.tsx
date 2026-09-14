import Link from "next/link";
import { getBaseUrl } from "@/lib/site-url";

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="mt-3 overflow-x-auto rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm dark:border-zinc-800 dark:bg-zinc-900">
      <code className="font-mono">{children}</code>
    </pre>
  );
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
          <p className="text-zinc-600 dark:text-zinc-400">
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
