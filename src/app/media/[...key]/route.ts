import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/dal";
import { isSafeKey, storage } from "@/lib/providers/storage";

/**
 * The single door to user media.
 *
 * Every photo URL in the product points here, whatever storage provider is
 * configured, so the bucket itself is private and an object key on its own is
 * not dereferenceable. This handler authorizes first, then either streams the
 * bytes (local provider) or redirects to a short-lived presigned URL (S3/R2).
 *
 * Rules:
 *   - signed-in users only — member photos are not world-readable
 *   - a photo still in moderation is visible only to the person who uploaded it
 *   - a block in either direction hides the photo, matching every other surface
 *   - only viewer-facing prefixes are served; verification selfies never are
 */
const SERVE_PREFIXES = ["photos/"];

/** Long for approved photos (content at a key never changes), short otherwise. */
const APPROVED_TTL = 60 * 60 * 24 * 7;
const OWNER_TTL = 60 * 5;

function deny() {
  // 404, not 403: a distinguishable "exists but forbidden" turns this route
  // into an oracle for whether a given key is real.
  return new Response("Not found", {
    status: 404,
    headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
}

export async function GET(_req: Request, ctx: RouteContext<"/media/[...key]">) {
  const { key } = await ctx.params;
  const path = key.join("/");

  if (!isSafeKey(path)) return deny();
  if (!SERVE_PREFIXES.some((p) => path.startsWith(p))) return deny();

  const viewer = await getCurrentUser();
  if (!viewer) return deny();

  const photo = await db.photo.findUnique({
    where: { storageKey: path },
    select: {
      moderationStatus: true,
      profile: {
        select: {
          userId: true,
          user: {
            select: {
              status: true,
              deletedAt: true,
              blocksMade: { where: { blockedId: viewer.id }, select: { id: true }, take: 1 },
              blocksAgainst: { where: { blockerId: viewer.id }, select: { id: true }, take: 1 },
            },
          },
        },
      },
    },
  });
  if (!photo) return deny();

  const owner = photo.profile.user;
  const isOwner = photo.profile.userId === viewer.id;

  if (!isOwner) {
    if (owner.deletedAt || owner.status === "DELETED" || owner.status === "BANNED") return deny();
    if (owner.blocksMade.length > 0 || owner.blocksAgainst.length > 0) return deny();
    // Pending/rejected photos are private to their owner until moderation clears
    // them — a moderation queue must not double as a preview gallery.
    if (photo.moderationStatus !== "APPROVED") return deny();
  }

  const ttl = isOwner && photo.moderationStatus !== "APPROVED" ? OWNER_TTL : APPROVED_TTL;

  const signed = await storage.signedUrl(path, ttl);
  if (signed) {
    return new Response(null, {
      status: 302,
      headers: {
        Location: signed,
        // Cache the redirect for well under the signature's own lifetime so a
        // cached 302 can never outlive the URL it points at.
        "Cache-Control": `private, max-age=${Math.floor(ttl / 2)}`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  }

  const object = await storage.get(path);
  if (!object) return deny();

  return new Response(new Uint8Array(object.bytes), {
    headers: {
      "Content-Type": object.contentType,
      "Content-Length": String(object.bytes.byteLength),
      // Belt and braces against a stored file being treated as an active
      // document: never sniff, never render as a top-level page, never frame.
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Cache-Control": `private, max-age=${ttl}`,
    },
  });
}
