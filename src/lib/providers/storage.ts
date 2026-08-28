import "server-only";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { env } from "@/lib/env";
import {
  ACCEPTED_IMAGE_TYPES,
  EXTENSION_BY_MIME,
  MAX_IMAGE_BYTES,
  MIME_BY_EXTENSION,
  type ImageMime,
} from "@/lib/media/image";

export { ACCEPTED_IMAGE_TYPES, MAX_IMAGE_BYTES };

export interface StoredObject {
  /** Opaque key stored in the DB (e.g. "photos/ab/cd/uuid.jpg"). */
  key: string;
}

export interface StorageProvider {
  readonly name: string;
  /** Persist bytes, return the key to store. `prefix` groups objects (e.g. "photos"). */
  put(prefix: string, bytes: Buffer, contentType: string): Promise<StoredObject>;
  get(key: string): Promise<{ bytes: Buffer; contentType: string } | null>;
  delete(key: string): Promise<void>;
  /**
   * Browser-facing URL for a key. Always an app-relative `/media/...` path: the
   * route handler is the single place authorization is enforced, so buckets
   * stay private and object keys are never dereferenceable on their own.
   */
  publicUrl(key: string): string;
  /**
   * A short-lived direct URL the browser may be redirected to, or null when the
   * provider has no such concept and `/media` should stream the bytes itself.
   */
  signedUrl(key: string, ttlSeconds: number): Promise<string | null>;
  /** Env vars this provider needs but does not have. Empty ⇒ ready to use. */
  configIssues(): string[];
}

/**
 * Keys are always generated server-side, never derived from a filename — but
 * they also arrive back from the database and from URL path segments, so every
 * entry point re-validates. A strict allowlist beats `path.normalize`, which is
 * platform-dependent and has a long history of bypasses.
 */
const KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,255}$/;
const SEGMENT_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export function isSafeKey(key: string): boolean {
  if (!KEY_PATTERN.test(key)) return false;
  // Validate segment by segment. `.` and `..` are rejected outright rather than
  // normalised away: two spellings of one object would break the unique-key
  // lookup that /media uses to authorize the request.
  for (const segment of key.split("/")) {
    if (!SEGMENT_PATTERN.test(segment)) return false;
    if (segment === "." || segment === ".." || segment.endsWith(".")) return false;
  }
  return true;
}

function assertSafeKey(key: string): string {
  if (!isSafeKey(key)) throw new Error("invalid storage key");
  return key;
}

/** `photos/ab/cd/<uuid>.jpg` — sharded so no directory or prefix grows unbounded. */
function newKey(prefix: string, contentType: string): string {
  const ext = EXTENSION_BY_MIME[contentType as ImageMime] ?? "bin";
  const id = randomUUID();
  const key = `${prefix}/${id.slice(0, 2)}/${id.slice(2, 4)}/${id}.${ext}`;
  return assertSafeKey(key);
}

function contentTypeForKey(key: string): string {
  const ext = key.split(".").pop()?.toLowerCase() ?? "";
  return MIME_BY_EXTENSION[ext] ?? "application/octet-stream";
}

// ─── local (development + single-node staging) ───────────────────────────────

/** Writes to a local directory, served by /media/[...key]. Ephemeral on PaaS. */
class LocalStorageProvider implements StorageProvider {
  readonly name = "local";
  private root = join(process.cwd(), env.STORAGE_LOCAL_DIR);

  async put(prefix: string, bytes: Buffer, contentType: string): Promise<StoredObject> {
    const key = newKey(prefix, contentType);
    const abs = join(this.root, key);
    await mkdir(dirname(abs), { recursive: true });
    await writeFile(abs, bytes);
    return { key };
  }

  async get(key: string) {
    if (!isSafeKey(key)) return null;
    try {
      const bytes = await readFile(join(this.root, key));
      return { bytes, contentType: contentTypeForKey(key) };
    } catch {
      return null;
    }
  }

  async delete(key: string) {
    if (!isSafeKey(key)) return;
    try {
      await unlink(join(this.root, key));
    } catch {
      /* already gone */
    }
  }

  publicUrl(key: string): string {
    return `/media/${key}`;
  }

  async signedUrl(): Promise<string | null> {
    return null; // nothing to sign — /media streams from disk
  }

  configIssues(): string[] {
    return [];
  }
}

// ─── S3-compatible (AWS S3, Cloudflare R2, Backblaze B2, MinIO…) ─────────────

/**
 * Any S3-compatible object store. Nothing here is Cloudflare-specific: R2 is
 * reached by pointing `S3_ENDPOINT` at the account's R2 endpoint and leaving
 * `S3_REGION` as `auto`. Swapping providers is a config change, never a code
 * change — see docs/PROVIDERS.md.
 *
 * The bucket is expected to be **private**. Objects are reachable only through
 * `/media/[...key]`, which authorizes the request and then redirects to a
 * short-lived presigned URL, so a leaked key is useless once it expires and the
 * bucket itself is never publicly enumerable.
 */
class S3StorageProvider implements StorageProvider {
  readonly name = "s3";

  private clientPromise?: Promise<import("@aws-sdk/client-s3").S3Client>;

  configIssues(): string[] {
    const missing: string[] = [];
    if (!env.S3_BUCKET) missing.push("S3_BUCKET");
    if (!env.S3_ACCESS_KEY_ID) missing.push("S3_ACCESS_KEY_ID");
    if (!env.S3_SECRET_ACCESS_KEY) missing.push("S3_SECRET_ACCESS_KEY");
    // Region defaults to "auto" (correct for R2); a custom endpoint is required
    // for every non-AWS provider but optional for AWS itself.
    return missing;
  }

  private async client() {
    const issues = this.configIssues();
    if (issues.length) {
      throw new Error(`storage: missing configuration — ${issues.join(", ")}`);
    }
    this.clientPromise ??= import("@aws-sdk/client-s3").then(
      ({ S3Client }) =>
        new S3Client({
          region: env.S3_REGION || "auto",
          endpoint: env.S3_ENDPOINT || undefined,
          // R2 and most non-AWS stores only support path-style addressing.
          forcePathStyle: Boolean(env.S3_ENDPOINT),
          credentials: {
            accessKeyId: env.S3_ACCESS_KEY_ID!,
            secretAccessKey: env.S3_SECRET_ACCESS_KEY!,
          },
        }),
    );
    return this.clientPromise;
  }

  async put(prefix: string, bytes: Buffer, contentType: string): Promise<StoredObject> {
    const key = newKey(prefix, contentType);
    const [client, { PutObjectCommand }] = await Promise.all([
      this.client(),
      import("@aws-sdk/client-s3"),
    ]);
    await client.send(
      new PutObjectCommand({
        Bucket: env.S3_BUCKET!,
        Key: key,
        Body: bytes,
        // Pin the response type to the sniffed image type and forbid sniffing,
        // so a stored object can never be interpreted as an active document.
        ContentType: contentType,
        ContentDisposition: "inline",
        CacheControl: "private, max-age=31536000, immutable",
      }),
    );
    return { key };
  }

  async get(key: string) {
    if (!isSafeKey(key)) return null;
    try {
      const [client, { GetObjectCommand }] = await Promise.all([
        this.client(),
        import("@aws-sdk/client-s3"),
      ]);
      const res = await client.send(
        new GetObjectCommand({ Bucket: env.S3_BUCKET!, Key: key }),
      );
      if (!res.Body) return null;
      const bytes = Buffer.from(await res.Body.transformToByteArray());
      // Trust our own extension over the stored header.
      return { bytes, contentType: contentTypeForKey(key) };
    } catch {
      return null;
    }
  }

  async delete(key: string) {
    if (!isSafeKey(key)) return;
    try {
      const [client, { DeleteObjectCommand }] = await Promise.all([
        this.client(),
        import("@aws-sdk/client-s3"),
      ]);
      await client.send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET!, Key: key }));
    } catch {
      /* best-effort — an orphaned object is not worth failing a user action */
    }
  }

  publicUrl(key: string): string {
    return `/media/${key}`;
  }

  async signedUrl(key: string, ttlSeconds: number): Promise<string | null> {
    if (!isSafeKey(key)) return null;
    try {
      const [client, { GetObjectCommand }, { getSignedUrl }] = await Promise.all([
        this.client(),
        import("@aws-sdk/client-s3"),
        import("@aws-sdk/s3-request-presigner"),
      ]);
      return await getSignedUrl(
        client,
        new GetObjectCommand({
          Bucket: env.S3_BUCKET!,
          Key: key,
          ResponseContentType: contentTypeForKey(key),
          ResponseContentDisposition: "inline",
        }),
        { expiresIn: ttlSeconds },
      );
    } catch {
      return null; // fall back to proxying through /media
    }
  }
}

function build(): StorageProvider {
  switch (env.STORAGE_PROVIDER) {
    case "s3":
      return new S3StorageProvider();
    case "local":
    default:
      return new LocalStorageProvider();
  }
}

/**
 * One provider instance per configuration. Reusing it keeps the S3 client's
 * connection pool alive across requests and survives dev HMR; keying on the
 * config means a changed environment builds a fresh one instead of silently
 * serving the old backend.
 */
const globalForStorage = globalThis as unknown as {
  lunovaStorage?: { key: string; provider: StorageProvider };
};

function configKey(): string {
  return [
    env.STORAGE_PROVIDER,
    env.S3_BUCKET ?? "",
    env.S3_REGION ?? "",
    env.S3_ENDPOINT ?? "",
    // presence only — never the value itself
    env.S3_ACCESS_KEY_ID ? "k" : "",
    env.S3_SECRET_ACCESS_KEY ? "s" : "",
    env.STORAGE_LOCAL_DIR ?? "",
  ].join("|");
}

function resolveStorage(): StorageProvider {
  const key = configKey();
  const cached = globalForStorage.lunovaStorage;
  if (cached && cached.key === key) return cached.provider;
  const provider = build();
  globalForStorage.lunovaStorage = { key, provider };
  return provider;
}

/**
 * The active provider. A getter, not a frozen binding, so the instance always
 * matches the current configuration — module-level capture is what made this
 * untestable and would have masked a mid-deploy config change.
 */
export const storage: StorageProvider = new Proxy({} as StorageProvider, {
  get(_t, prop: keyof StorageProvider) {
    const target = resolveStorage();
    const value = target[prop];
    return typeof value === "function" ? value.bind(target) : value;
  },
});

/**
 * Configuration problems that would make media silently break, for `/api/health`.
 * Names the missing variables — never their values.
 */
export function storageStatus(): { provider: string; ready: boolean; missing: string[] } {
  const missing = storage.configIssues();
  return { provider: storage.name, ready: missing.length === 0, missing };
}
