import { renderDiagramToJpeg } from "@/lib/diagram/render";
import { getDiagram, getDiagramImage, saveDiagramImage } from "@/lib/diagram/store";

// The Blob store is typically private (see lib/file-storage.ts), so its raw
// URL isn't fetchable by a browser without auth. This route is the
// authenticated path to the image: it holds the server-side Blob
// credentials, so a viewer's browser only ever needs this same-origin URL.
export async function GET(_request: Request, { params }: RouteContext<"/view/[id]/image">): Promise<Response> {
  const { id } = await params;

  let jpeg = await getDiagramImage(id);

  if (!jpeg) {
    // No cached render yet (create_diagram was called but not render_diagram,
    // or this is the first view after an update_diagram). Render it now so
    // the diagram shows up regardless, and cache it for the next request.
    const diagram = await getDiagram(id);
    if (!diagram) {
      return new Response("Diagram not found.", { status: 404 });
    }
    jpeg = await renderDiagramToJpeg(diagram);
    await saveDiagramImage(id, jpeg);
  }

  return new Response(Uint8Array.from(jpeg), {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "no-store",
    },
  });
}
