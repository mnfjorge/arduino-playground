import Ajv2020, { type AnySchemaObject } from "ajv/dist/2020";
import addFormats from "ajv-formats";
import { readFileSync } from "node:fs";
import path from "node:path";
import { getComponentDefinition } from "../components/registry";
import type { Diagram } from "./types";

const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);

const diagramSchema = JSON.parse(
  readFileSync(path.join(process.cwd(), "schema/diagram.schema.json"), "utf8"),
) as AnySchemaObject;

const validateSchema = ajv.compile(diagramSchema);

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validates a diagram against schema/diagram.schema.json, then against
 * things JSON Schema can't express: component types and pins must exist
 * in data/components/*.json, connections must reference components that
 * exist in the same diagram, and component ids must be unique.
 */
export function validateDiagram(data: unknown): ValidationResult {
  if (!validateSchema(data)) {
    const errors = (validateSchema.errors ?? []).map((err) => `${err.instancePath || "(root)"} ${err.message}`);
    return { valid: false, errors };
  }

  const diagram = data as Diagram;
  const errors: string[] = [];
  const componentIds = new Set<string>();
  const componentById = new Map(diagram.components.map((c) => [c.id, c]));

  for (const component of diagram.components) {
    if (componentIds.has(component.id)) {
      errors.push(`Duplicate component id "${component.id}"`);
    }
    componentIds.add(component.id);

    if (!getComponentDefinition(component.type)) {
      errors.push(`Component "${component.id}" has unknown type "${component.type}". Use list_component_types to see valid types.`);
    }
  }

  for (const connection of diagram.connections) {
    for (const [role, ref] of [
      ["from", connection.from],
      ["to", connection.to],
    ] as const) {
      const component = componentById.get(ref.component);
      if (!component) {
        errors.push(`Connection "${role}" references unknown component id "${ref.component}"`);
        continue;
      }

      const definition = getComponentDefinition(component.type);
      if (definition && !definition.pins.some((pin) => pin.name === ref.pin)) {
        const validPins = definition.pins.map((pin) => pin.name).join(", ");
        errors.push(
          `Connection "${role}" references pin "${ref.pin}" which doesn't exist on component "${ref.component}" (type "${component.type}"). Valid pins: ${validPins}`,
        );
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
