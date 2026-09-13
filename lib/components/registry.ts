import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

export interface ComponentPin {
  name: string;
  label?: string;
  group?: string;
}

export interface ComponentDefinition {
  type: string;
  label: string;
  category: string;
  description?: string;
  pins: ComponentPin[];
}

const COMPONENTS_DIR = path.join(process.cwd(), "data/components");

let cache: Map<string, ComponentDefinition> | null = null;

function load(): Map<string, ComponentDefinition> {
  if (cache) return cache;

  const map = new Map<string, ComponentDefinition>();
  const files = readdirSync(COMPONENTS_DIR).filter((file) => file.endsWith(".json"));
  for (const file of files) {
    const definition = JSON.parse(readFileSync(path.join(COMPONENTS_DIR, file), "utf8")) as ComponentDefinition;
    map.set(definition.type, definition);
  }

  cache = map;
  return map;
}

export function listComponentDefinitions(): ComponentDefinition[] {
  return Array.from(load().values());
}

export function getComponentDefinition(type: string): ComponentDefinition | undefined {
  return load().get(type);
}
