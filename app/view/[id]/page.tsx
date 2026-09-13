import { notFound } from "next/navigation";
import { getDiagram } from "@/lib/diagram/store";

export default async function ViewDiagramPage({ params }: PageProps<"/view/[id]">) {
  const { id } = await params;
  const diagram = await getDiagram(id);

  if (!diagram) {
    notFound();
  }

  const json = JSON.stringify(diagram, null, 2);

  return (
    <div className="min-h-full bg-background text-foreground">
      <main className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-16">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">{diagram.title || "Untitled diagram"}</h1>
          <p className="mt-1 font-mono text-sm text-zinc-500">{id}</p>
        </header>

        <section>
          {/* Authenticated same-origin route (see app/view/[id]/image/route.ts) - the raw
              Blob URL isn't directly fetchable when the store is private. It renders and
              caches the image on first request if render_diagram hasn't been called yet. */}
          {/* eslint-disable-next-line @next/next/no-img-element -- size varies per diagram, no fixed dimensions to give next/image */}
          <img
            src={`/view/${id}/image`}
            alt={diagram.title ?? `Diagram ${id}`}
            className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800"
          />
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
