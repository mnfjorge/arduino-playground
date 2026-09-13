process.env.USE_LOCAL_FILE_STORAGE = "true";

import { randomUUID } from "node:crypto";
import { deleteFile } from "../lib/file-storage";
import { getDiagramImage } from "../lib/diagram/store";
import { createDiagram, listComponentTypes, renderDiagram, updateDiagram, type DiagramInput } from "../lib/mcp/tools";

const createdDiagramIds: string[] = [];

function trackedDiagramId(): string {
  const id = randomUUID();
  createdDiagramIds.push(id);
  return id;
}

afterAll(async () => {
  for (const id of createdDiagramIds) {
    await deleteFile(`diagrams/${id}.json`).catch(() => {});
    await deleteFile(`diagrams/${id}.jpg`).catch(() => {});
  }
});

function baseInput(diagramId: string): DiagramInput {
  return {
    diagramId,
    title: "Test diagram",
    components: [
      { id: "sensor-1", type: "hall_sensor" },
      { id: "mcu-1", type: "esp32" },
    ],
    connections: [{ from: { component: "sensor-1", pin: "OUT" }, to: { component: "mcu-1", pin: "D4" } }],
  };
}

describe("listComponentTypes", () => {
  test("returns every component definition with at least one pin", () => {
    const types = listComponentTypes();
    expect(types.length).toBeGreaterThan(0);
    for (const type of types) {
      expect(type.pins.length).toBeGreaterThan(0);
    }
  });
});

describe("createDiagram", () => {
  test("creates a new diagram", async () => {
    const diagramId = trackedDiagramId();
    const result = await createDiagram(baseInput(diagramId));
    expect(result.ok).toBe(true);
  });

  test("fails validation for an unknown component type, without saving anything", async () => {
    const diagramId = trackedDiagramId();
    const result = await createDiagram({
      diagramId,
      components: [{ id: "x1", type: "not_a_real_type" }],
      connections: [],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.includes("unknown type"))).toBe(true);
    }

    // Confirm it truly wasn't saved: a subsequent create with the same id should succeed.
    const retry = await createDiagram(baseInput(diagramId));
    expect(retry.ok).toBe(true);
  });

  test("fails if the diagram id is already in use", async () => {
    const diagramId = trackedDiagramId();
    await createDiagram(baseInput(diagramId));
    const result = await createDiagram(baseInput(diagramId));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.includes("already exists"))).toBe(true);
    }
  });
});

describe("updateDiagram", () => {
  test("fails if the diagram doesn't exist yet", async () => {
    const diagramId = trackedDiagramId();
    const result = await updateDiagram(baseInput(diagramId));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.includes("No diagram"))).toBe(true);
    }
  });

  test("replaces an existing diagram's components and connections", async () => {
    const diagramId = trackedDiagramId();
    await createDiagram(baseInput(diagramId));

    const updated: DiagramInput = {
      diagramId,
      title: "Test diagram",
      components: [
        { id: "sensor-1", type: "hall_sensor" },
        { id: "mcu-1", type: "esp32" },
        { id: "psu-1", type: "power_supply" },
      ],
      connections: [
        { from: { component: "sensor-1", pin: "OUT" }, to: { component: "mcu-1", pin: "D4" } },
        { from: { component: "psu-1", pin: "DC+" }, to: { component: "mcu-1", pin: "VIN" } },
      ],
    };

    const result = await updateDiagram(updated);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.diagram.components).toHaveLength(3);
      expect(result.diagram.connections).toHaveLength(2);
    }
  });
});

describe("renderDiagram", () => {
  test("fails for a diagram that doesn't exist", async () => {
    const result = await renderDiagram(randomUUID());
    expect(result.ok).toBe(false);
  });

  test("renders an existing diagram to a JPEG and returns a view URL", async () => {
    const diagramId = trackedDiagramId();
    await createDiagram(baseInput(diagramId));

    const result = await renderDiagram(diagramId);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.viewUrl).toContain(`/view/${diagramId}`);
      // JPEG magic bytes: 0xFF 0xD8 0xFF
      expect(result.jpeg.subarray(0, 3)).toEqual(Buffer.from([0xff, 0xd8, 0xff]));
    }
  });

  test("persists the same image getDiagramImage later reads back", async () => {
    const diagramId = trackedDiagramId();
    await createDiagram(baseInput(diagramId));

    expect(await getDiagramImage(diagramId)).toBeNull();

    const result = await renderDiagram(diagramId);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const stored = await getDiagramImage(diagramId);
      expect(stored).toEqual(result.jpeg);
    }
  });
});
