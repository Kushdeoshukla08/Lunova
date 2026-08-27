import { storage } from "@/lib/providers/storage";

/**
 * Serves objects from the local storage provider. In production with an S3-style
 * provider this route is unused (objects are served from the CDN / bucket URL).
 */
export async function GET(
  _req: Request,
  ctx: RouteContext<"/media/[...key]">,
) {
  const { key } = await ctx.params;
  const object = await storage.get(key.join("/"));
  if (!object) {
    return new Response("Not found", { status: 404 });
  }
  return new Response(new Uint8Array(object.bytes), {
    headers: {
      "Content-Type": object.contentType,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
