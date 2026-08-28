/**
 * Image identification and limits.
 *
 * The multipart `Content-Type` on an upload is attacker-controlled: a browser
 * sets it honestly, `curl` sets it to whatever you like. Everything here works
 * from the *bytes*, so a text/html payload labelled `image/png` is rejected
 * before it is ever written to the object store.
 *
 * Dimensions are read from the container header only — we never decode pixel
 * data, so a decompression bomb is rejected on its declared geometry without
 * ever being expanded in memory.
 *
 * No `server-only` import: this is pure byte math and is unit-tested directly.
 */

export type ImageMime = "image/jpeg" | "image/png" | "image/webp" | "image/avif";

export interface ImageInfo {
  mime: ImageMime;
  width: number;
  height: number;
}

/** Hard byte ceiling — also enforced before the body is buffered. */
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
/** Anything smaller is a tracking pixel or a broken upload, not a photo. */
export const MIN_IMAGE_DIMENSION = 200;
/** Above this on either axis we would only downscale anyway. */
export const MAX_IMAGE_DIMENSION = 8_000;
/**
 * Total pixels. 8000×8000 is allowed, 8000×20000 is not: the pixel cap is what
 * actually bounds the memory any downstream resize would need.
 */
export const MAX_IMAGE_PIXELS = 40_000_000;

export const ACCEPTED_IMAGE_TYPES: ImageMime[] = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
];

export const EXTENSION_BY_MIME: Record<ImageMime, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

export const MIME_BY_EXTENSION: Record<string, ImageMime> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
};

// ─── container parsers ───────────────────────────────────────────────────────

function parsePng(b: Buffer): ImageInfo | null {
  // 8-byte signature, then an IHDR chunk whose width/height are big-endian u32.
  if (b.length < 24) return null;
  if (b.readUInt32BE(0) !== 0x89504e47 || b.readUInt32BE(4) !== 0x0d0a1a0a) return null;
  if (b.toString("ascii", 12, 16) !== "IHDR") return null;
  return { mime: "image/png", width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
}

function parseJpeg(b: Buffer): ImageInfo | null {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;
  // Walk the marker segments to the first Start-Of-Frame, which carries the size.
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) {
      i++; // resync past fill bytes / corruption rather than trusting the offset
      continue;
    }
    const marker = b[i + 1];
    // standalone markers carry no length
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2;
      continue;
    }
    if (marker === 0xd9 || marker === 0xda) break; // EOI / start of scan
    const len = b.readUInt16BE(i + 2);
    if (len < 2) return null;
    const isSof =
      marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSof) {
      if (i + 9 >= b.length) return null;
      return {
        mime: "image/jpeg",
        height: b.readUInt16BE(i + 5),
        width: b.readUInt16BE(i + 7),
      };
    }
    i += 2 + len;
  }
  return null;
}

function parseWebp(b: Buffer): ImageInfo | null {
  if (b.length < 30) return null;
  if (b.toString("ascii", 0, 4) !== "RIFF" || b.toString("ascii", 8, 12) !== "WEBP") return null;
  const chunk = b.toString("ascii", 12, 16);

  if (chunk === "VP8 ") {
    // lossy: 3-byte start code, then 14-bit width and height
    if (b[23] !== 0x9d || b[24] !== 0x01 || b[25] !== 0x2a) return null;
    return {
      mime: "image/webp",
      width: b.readUInt16LE(26) & 0x3fff,
      height: b.readUInt16LE(28) & 0x3fff,
    };
  }
  if (chunk === "VP8L") {
    // lossless: signature byte then 28 bits of (width-1, height-1)
    if (b[20] !== 0x2f) return null;
    const bits = b.readUInt32LE(21);
    return {
      mime: "image/webp",
      width: (bits & 0x3fff) + 1,
      height: ((bits >> 14) & 0x3fff) + 1,
    };
  }
  if (chunk === "VP8X") {
    // extended: 24-bit little-endian canvas size, stored minus one
    return {
      mime: "image/webp",
      width: (b[24] | (b[25] << 8) | (b[26] << 16)) + 1,
      height: (b[27] | (b[28] << 8) | (b[29] << 16)) + 1,
    };
  }
  return null;
}

const AVIF_BRANDS = new Set(["avif", "avis", "mif1", "miaf", "heic", "heix"]);

function parseAvif(b: Buffer): ImageInfo | null {
  if (b.length < 16 || b.toString("ascii", 4, 8) !== "ftyp") return null;
  const major = b.toString("ascii", 8, 12);
  // The major brand may be a generic one, so also check the compatible-brand list.
  const ftypLen = Math.min(b.readUInt32BE(0) || 0, b.length);
  let branded = AVIF_BRANDS.has(major);
  for (let i = 16; !branded && i + 4 <= ftypLen; i += 4) {
    if (AVIF_BRANDS.has(b.toString("ascii", i, i + 4))) branded = true;
  }
  if (!branded) return null;

  // `ispe` (image spatial extents) holds the real geometry: 4 bytes of
  // version+flags, then big-endian u32 width and height.
  const idx = b.indexOf("ispe", 0, "ascii");
  if (idx < 0 || idx + 16 > b.length) return null;
  return {
    mime: "image/avif",
    width: b.readUInt32BE(idx + 8),
    height: b.readUInt32BE(idx + 12),
  };
}

/**
 * Identify an image from its bytes. Returns null for anything that is not one
 * of the four accepted containers — including SVG, GIF, PDF, HTML and archives,
 * all of which are things people try to smuggle through an "image" field.
 */
export function sniffImage(bytes: Buffer): ImageInfo | null {
  const info =
    parsePng(bytes) ?? parseJpeg(bytes) ?? parseWebp(bytes) ?? parseAvif(bytes) ?? null;
  if (!info) return null;
  if (!Number.isInteger(info.width) || !Number.isInteger(info.height)) return null;
  if (info.width <= 0 || info.height <= 0) return null;
  return info;
}

// ─── validation ──────────────────────────────────────────────────────────────

export type ImageRejection =
  | "empty"
  | "too-large"
  | "unsupported-type"
  | "type-mismatch"
  | "too-small"
  | "too-large-dimensions"
  | "too-many-pixels";

export type ImageCheck =
  | { ok: true; info: ImageInfo }
  | { ok: false; reason: ImageRejection };

/**
 * Validate an upload end-to-end. `declaredType` is the browser-supplied MIME —
 * it must agree with the bytes, so a renamed file is rejected rather than
 * silently stored under the wrong extension.
 */
export function checkImageUpload(bytes: Buffer, declaredType: string): ImageCheck {
  if (bytes.length === 0) return { ok: false, reason: "empty" };
  if (bytes.length > MAX_IMAGE_BYTES) return { ok: false, reason: "too-large" };

  const info = sniffImage(bytes);
  if (!info) return { ok: false, reason: "unsupported-type" };

  const declared = declaredType.split(";")[0]!.trim().toLowerCase();
  const normalisedDeclared = declared === "image/jpg" ? "image/jpeg" : declared;
  if (normalisedDeclared !== info.mime) return { ok: false, reason: "type-mismatch" };

  if (info.width < MIN_IMAGE_DIMENSION || info.height < MIN_IMAGE_DIMENSION) {
    return { ok: false, reason: "too-small" };
  }
  if (info.width > MAX_IMAGE_DIMENSION || info.height > MAX_IMAGE_DIMENSION) {
    return { ok: false, reason: "too-large-dimensions" };
  }
  if (info.width * info.height > MAX_IMAGE_PIXELS) {
    return { ok: false, reason: "too-many-pixels" };
  }
  return { ok: true, info };
}

/** Human-readable, non-technical copy for each rejection. */
export function imageRejectionMessage(reason: ImageRejection): string {
  switch (reason) {
    case "empty":
      return "Choose an image to upload.";
    case "too-large":
      return "That image is over 8 MB — try a smaller one.";
    case "unsupported-type":
    case "type-mismatch":
      return "Use a JPEG, PNG, WebP or AVIF image.";
    case "too-small":
      return `That image is too small — it needs to be at least ${MIN_IMAGE_DIMENSION}px on each side.`;
    case "too-large-dimensions":
    case "too-many-pixels":
      return "That image is too large to process — try one under 8000px per side.";
  }
}
