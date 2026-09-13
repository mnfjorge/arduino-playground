import Link from "next/link";
import type { Metadata } from "next";
import { listComponentDefinitions } from "@/lib/components/registry";

export const metadata: Metadata = {
  title: "Supported Components",
};

function formatCategory(category: string): string {
  return category
    .split(/[-_]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export default function ComponentsPage() {
  const definitions = listComponentDefinitions().sort((a, b) => a.label.localeCompare(b.label));

  const byCategory = new Map<string, typeof definitions>();
  for (const definition of definitions) {
    const group = byCategory.get(definition.category) ?? [];
    group.push(definition);
    byCategory.set(definition.category, group);
  }
  const categories = Array.from(byCategory.keys()).sort((a, b) => a.localeCompare(b));

  return (
    <div className="min-h-full bg-background text-foreground">
      <main className="mx-auto flex max-w-3xl flex-col gap-12 px-6 py-16">
        <header>
          <Link href="/" className="text-sm text-zinc-500 underline hover:text-zinc-700 dark:hover:text-zinc-300">
            ← Home
          </Link>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">Supported Components</h1>
          <p className="mt-3 text-lg text-zinc-600 dark:text-zinc-400">
            Every component type the diagram tools accept, along with its pins.
          </p>
        </header>

        {categories.map((category) => (
          <section key={category}>
            <h2 className="text-xl font-semibold">{formatCategory(category)}</h2>
            <div className="mt-4 flex flex-col gap-6">
              {byCategory.get(category)!.map((definition) => (
                <div key={definition.type} className="rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
                  <h3 className="text-base font-semibold">{definition.label}</h3>
                  <p className="mt-1 font-mono text-xs text-zinc-500">{definition.type}</p>
                  {definition.description && (
                    <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{definition.description}</p>
                  )}
                  <p className="mt-4 text-xs font-medium tracking-wide text-zinc-500 uppercase">Pins</p>
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {definition.pins.map((pin) => (
                      <li
                        key={pin.name}
                        title={pin.label}
                        className="rounded-md border border-zinc-200 px-2 py-1 font-mono text-xs dark:border-zinc-800"
                      >
                        {pin.name}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        ))}
      </main>
    </div>
  );
}
