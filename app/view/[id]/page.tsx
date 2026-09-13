import { cache } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { InteractiveDiagram } from "@/components/diagram/interactive-diagram";
import { getComponentDefinition, type ComponentDefinition } from "@/lib/components/registry";
import { layoutDiagram } from "@/lib/diagram/layout";
import { getDiagram } from "@/lib/diagram/store";
import type { DiagramComponent } from "@/lib/diagram/types";

function componentLabel(component: DiagramComponent | undefined, fallbackId: string): string {
  return component?.label || component?.type || fallbackId;
}

function pinLabel(component: DiagramComponent | undefined, pin: string): string {
  const definition = component && getComponentDefinition(component.type);
  return definition?.pins.find((p) => p.name === pin)?.label ?? pin;
}

// Shared by generateMetadata and the page body so the diagram is only fetched once per request.
const getCachedDiagram = cache(getDiagram);

export async function generateMetadata({ params }: PageProps<"/view/[id]">): Promise<Metadata> {
  const { id } = await params;
  const diagram = await getCachedDiagram(id);
  return { title: diagram?.title || "Untitled diagram" };
}

export default async function ViewDiagramPage({ params }: PageProps<"/view/[id]">) {
  const { id } = await params;
  const diagram = await getCachedDiagram(id);

  if (!diagram) {
    notFound();
  }

  const layout = await layoutDiagram(diagram);

  const componentDefinitions: Record<string, ComponentDefinition> = {};
  for (const component of diagram.components) {
    const definition = getComponentDefinition(component.type);
    if (definition) componentDefinitions[component.type] = definition;
  }

  const json = JSON.stringify(diagram, null, 2);

  const componentById = new Map(diagram.components.map((component) => [component.id, component]));

  const connectionRows = diagram.connections
    .flatMap((connection) => {
      const from = componentById.get(connection.from.component);
      const to = componentById.get(connection.to.component);
      return [
        {
          component: componentLabel(from, connection.from.component),
          pin: pinLabel(from, connection.from.pin),
          otherComponent: componentLabel(to, connection.to.component),
          otherPin: pinLabel(to, connection.to.pin),
        },
        {
          component: componentLabel(to, connection.to.component),
          pin: pinLabel(to, connection.to.pin),
          otherComponent: componentLabel(from, connection.from.component),
          otherPin: pinLabel(from, connection.from.pin),
        },
      ];
    })
    .sort((a, b) => a.component.localeCompare(b.component) || a.pin.localeCompare(b.pin));

  return (
    <div className="min-h-full bg-background text-foreground">
      <main className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-16">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">{diagram.title || "Untitled diagram"}</h1>
          <p className="mt-1 font-mono text-sm text-zinc-500">{id}</p>
        </header>

        <section>
          <div className="mb-2 flex items-center justify-between gap-4">
            <p className="text-sm text-zinc-500">
              Hover a component, pin, or wire for details. Scroll to zoom, drag to pan.
            </p>
            {/* Authenticated same-origin route (see app/view/[id]/image/route.ts) - the raw
                Blob URL isn't directly fetchable when the store is private. It renders and
                caches the image on first request if render_diagram hasn't been called yet. */}
            <a
              href={`/view/${id}/image`}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 text-sm text-zinc-500 underline hover:text-zinc-700 dark:hover:text-zinc-300"
            >
              View static image
            </a>
          </div>
          <InteractiveDiagram diagram={diagram} layout={layout} componentDefinitions={componentDefinitions} />
        </section>

        <section>
          <h2 className="text-lg font-semibold">Connections</h2>
          <div className="mt-3 overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
                <tr>
                  <th className="px-4 py-2 font-medium">Component</th>
                  <th className="px-4 py-2 font-medium">Pin</th>
                  <th className="px-4 py-2 font-medium">Connected to</th>
                  <th className="px-4 py-2 font-medium">Pin</th>
                </tr>
              </thead>
              <tbody>
                {connectionRows.length === 0 ? (
                  <tr>
                    <td className="px-4 py-2 text-zinc-500" colSpan={4}>
                      No connections.
                    </td>
                  </tr>
                ) : (
                  connectionRows.map((row, index) => (
                    <tr
                      key={`${row.component}-${row.pin}-${row.otherComponent}-${row.otherPin}-${index}`}
                      className="border-b border-zinc-200 last:border-0 dark:border-zinc-800"
                    >
                      <td className="px-4 py-2">{row.component}</td>
                      <td className="px-4 py-2 font-mono">{row.pin}</td>
                      <td className="px-4 py-2">{row.otherComponent}</td>
                      <td className="px-4 py-2 font-mono">{row.otherPin}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold">JSON source</h2>
          <pre className="mt-3 overflow-x-auto rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm dark:border-zinc-800 dark:bg-zinc-900">
            <code className="font-mono">{json}</code>
          </pre>
        </section>
      </main>
    </div>
  );
}
