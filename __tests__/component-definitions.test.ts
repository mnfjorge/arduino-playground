import Ajv2020, { type AnySchemaObject } from "ajv/dist/2020";
import addFormats from "ajv-formats";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const ROOT = path.join(__dirname, "..");
const COMPONENTS_DIR = path.join(ROOT, "data/components");

function readJson<T = unknown>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);

const componentSchema = readJson<AnySchemaObject>(path.join(ROOT, "schema/component-definition.schema.json"));
const diagramSchema = readJson<AnySchemaObject>(path.join(ROOT, "schema/diagram.schema.json"));
const validateComponent = ajv.compile(componentSchema);
const validateDiagram = ajv.compile(diagramSchema);

const componentFiles = readdirSync(COMPONENTS_DIR).filter((f) => f.endsWith(".json"));

interface ComponentDefinition {
  type: string;
  label: string;
  category: string;
  description?: string;
  pins: { name: string; label?: string; group?: string }[];
}

describe("component definition schema", () => {
  test("compiles as a valid JSON Schema", () => {
    expect(validateComponent).toBeInstanceOf(Function);
  });

  test("at least one component type is defined", () => {
    expect(componentFiles.length).toBeGreaterThan(0);
  });
});

describe.each(componentFiles)("data/components/%s", (file) => {
  const filePath = path.join(COMPONENTS_DIR, file);
  const data = readJson(filePath) as ComponentDefinition;

  test("conforms to component-definition.schema.json", () => {
    const valid = validateComponent(data);
    if (!valid) {
      throw new Error(`Schema errors for ${file}:\n${JSON.stringify(validateComponent.errors, null, 2)}`);
    }
  });

  test("'type' matches the filename", () => {
    const expectedType = path.basename(file, ".json");
    expect(data.type).toBe(expectedType);
  });

  test("has no duplicate pin names", () => {
    const names = data.pins.map((pin) => pin.name);
    const uniqueNames = new Set(names);
    expect(uniqueNames.size).toBe(names.length);
  });

  test("has at least one pin", () => {
    expect(data.pins.length).toBeGreaterThan(0);
  });
});

describe("component types across all files", () => {
  const allTypes = componentFiles.map((file) => (readJson(path.join(COMPONENTS_DIR, file)) as ComponentDefinition).type);

  test("no two files declare the same 'type'", () => {
    const uniqueTypes = new Set(allTypes);
    expect(uniqueTypes.size).toBe(allTypes.length);
  });
});

describe("diagram schema", () => {
  test("compiles as a valid JSON Schema", () => {
    expect(validateDiagram).toBeInstanceOf(Function);
  });

  test("accepts a minimal valid diagram", () => {
    const diagram = {
      id: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      components: [
        { id: "sensor-1", type: "hall_sensor" },
        { id: "mcu-1", type: "esp32" },
      ],
      connections: [{ from: { component: "sensor-1", pin: "OUT" }, to: { component: "mcu-1", pin: "D4" } }],
    };

    const valid = validateDiagram(diagram);
    if (!valid) {
      throw new Error(`Schema errors:\n${JSON.stringify(validateDiagram.errors, null, 2)}`);
    }
  });

  test("rejects a diagram missing a required field", () => {
    const diagram = {
      id: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      components: [{ id: "sensor-1" /* missing type */ }],
      connections: [],
    };

    expect(validateDiagram(diagram)).toBe(false);
  });

  test("rejects an id that isn't a UUID", () => {
    const diagram = { id: "not-a-uuid", components: [], connections: [] };
    expect(validateDiagram(diagram)).toBe(false);
  });

  test("rejects unknown top-level fields", () => {
    const diagram = {
      id: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      components: [],
      connections: [],
      position: { x: 0, y: 0 },
    };

    expect(validateDiagram(diagram)).toBe(false);
  });
});
