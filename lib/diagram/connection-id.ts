import type { DiagramConnection } from "./types";

/** Stable id for a physical wire; shared by both reciprocal connection table rows. */
export function getConnectionStableId(connection: DiagramConnection): string {
  if (connection.id) {
    return connection.id;
  }
  const endpoints = [
    `${connection.from.component}\0${connection.from.pin}`,
    `${connection.to.component}\0${connection.to.pin}`,
  ].sort();
  return endpoints.join("\x01");
}
