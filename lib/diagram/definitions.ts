import { getComponentDefinition, type ComponentDefinition } from "../components/registry";
import type { Diagram } from "./types";

export interface EphemeralDefinitionsResult {
  definitions: Map<string, ComponentDefinition>;
  errors: string[];
}

/**
 * Collects the ad-hoc component definitions carried inline on a diagram's
 * components (used when a component's `type` isn't a registered type from
 * data/components/*.json). Validates that an inline definition doesn't
 * shadow a registered type and that every component sharing an ad-hoc type
 * agrees on its definition, since a type's pins/label/category must be
 * consistent within the diagram.
 */
export function collectEphemeralDefinitions(diagram: Diagram): EphemeralDefinitionsResult {
  const errors: string[] = [];
  const definitions = new Map<string, ComponentDefinition>();

  for (const component of diagram.components) {
    if (!component.definition) continue;

    if (getComponentDefinition(component.type)) {
      errors.push(
        `Component "${component.id}" provides an inline "definition" for type "${component.type}", but that type is already registered. Remove the inline definition or use a different type key.`,
      );
      continue;
    }

    const pinNames = component.definition.pins.map((pin) => pin.name);
    if (new Set(pinNames).size !== pinNames.length) {
      errors.push(`Inline definition for type "${component.type}" (component "${component.id}") has duplicate pin names.`);
      continue;
    }

    const candidate: ComponentDefinition = { type: component.type, ...component.definition };
    const existing = definitions.get(component.type);
    if (existing && JSON.stringify(existing) !== JSON.stringify(candidate)) {
      errors.push(
        `Component "${component.id}" uses ad-hoc type "${component.type}" with a different inline "definition" than another component of the same type in this diagram. Every instance of the same ad-hoc type must share the same definition.`,
      );
      continue;
    }
    definitions.set(component.type, candidate);
  }

  return { definitions, errors };
}

/** Resolves a component type against the persisted registry first, then a diagram's own ephemeral (inline) definitions. */
export function resolveDefinition(
  type: string,
  ephemeralDefinitions: Map<string, ComponentDefinition>,
): ComponentDefinition | undefined {
  return getComponentDefinition(type) ?? ephemeralDefinitions.get(type);
}
