import { storage } from "@/lib/providers/storage";

/**
 * Serves objects from the local storage provider. In production with an S3-style
 * provider this route is unused (objects are served from the CDN / bucket URL).
 *
 * Only prefixes meant to be viewer-facing are served here. Transient artefacts
 * such as verification selfies (`verification/`) are never exposed, even though
 * their keys are random and short-lived.
 */
const SERVE_PREFIXES = ["photos/"];

export async function GET(_req: Request, ctx: RouteContext<"/media/[...key]">) {
  const { key } = await ctx.params;
  const path = key.join("/");

  if (!SERVE_PREFIXES.some((p) => path.startsWith(p))) {
    return new Response("Not found", { status: 404 });
  }

  const object = await storage.get(path);
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
