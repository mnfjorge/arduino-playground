process.env.USE_LOCAL_FILE_STORAGE = "true";

import { randomUUID } from "node:crypto";
import { deleteFile } from "../lib/file-storage";
import { getDiagramImage } from "../lib/diagram/store";
import { createDiagram } from "../lib/mcp/tools";
import { GET } from "../app/view/[id]/image/route";

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

function getImage(id: string) {
  return GET(new Request(`http://localhost/view/${id}/image`), { params: Promise.resolve({ id }) });
}

describe("GET /view/[id]/image", () => {
  test("renders and caches an image on first request if render_diagram was never called", async () => {
    const diagramId = trackedDiagramId();
    await createDiagram({
      diagramId,
      components: [{ id: "sensor-1", type: "hall_sensor" }],
      connections: [],
    });

    expect(await getDiagramImage(diagramId)).toBeNull();

    const response = await getImage(diagramId);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/jpeg");

    const bytes = Buffer.from(await response.arrayBuffer());
    expect(bytes.subarray(0, 3)).toEqual(Buffer.from([0xff, 0xd8, 0xff]));

    // Now cached: getDiagramImage should return the same bytes without another render.
    const cached = await getDiagramImage(diagramId);
    expect(cached).toEqual(bytes);
  });

  test("serves the cached image on a second request without re-rendering", async () => {
    const diagramId = trackedDiagramId();
    await createDiagram({
      diagramId,
      components: [{ id: "sensor-1", type: "hall_sensor" }],
      connections: [],
    });

    const first = Buffer.from(await (await getImage(diagramId)).arrayBuffer());
    const second = Buffer.from(await (await getImage(diagramId)).arrayBuffer());
    expect(second).toEqual(first);
  });

  test("returns 404 for a diagram that doesn't exist", async () => {
    const response = await getImage(randomUUID());
    expect(response.status).toBe(404);
  });
});
