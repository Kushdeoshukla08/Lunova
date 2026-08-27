import "server-only";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { dirname, join, normalize } from "node:path";
import { randomUUID } from "node:crypto";
import { env } from "@/lib/env";

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
  /** Browser-facing URL for a key. Local provider serves via a route handler. */
  publicUrl(key: string): string;
}

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

function safeKey(key: string): string {
  const clean = normalize(key).replace(/^(\.\.[/\\])+/, "");
  if (clean.includes("..") || clean.startsWith("/") || clean.startsWith("\\")) {
    throw new Error("invalid storage key");
  }
  return clean.replace(/\\/g, "/");
}

/** DEV provider — writes to a local directory, served by /media/[...key]. */
class LocalStorageProvider implements StorageProvider {
  readonly name = "local";
  private root = join(process.cwd(), env.STORAGE_LOCAL_DIR);

  async put(prefix: string, bytes: Buffer, contentType: string): Promise<StoredObject> {
    const ext = EXT[contentType] ?? "bin";
    const id = randomUUID();
    const key = `${prefix}/${id.slice(0, 2)}/${id.slice(2, 4)}/${id}.${ext}`;
    const abs = join(this.root, safeKey(key));
    await mkdir(dirname(abs), { recursive: true });
    await writeFile(abs, bytes);
    return { key };
  }

  async get(key: string) {
    try {
      const abs = join(this.root, safeKey(key));
      const bytes = await readFile(abs);
      const ext = key.split(".").pop() ?? "";
      const contentType =
        Object.entries(EXT).find(([, e]) => e === ext)?.[0] ?? "application/octet-stream";
      return { bytes, contentType };
    } catch {
      return null;
    }
  }

  async delete(key: string) {
    try {
      await unlink(join(this.root, safeKey(key)));
    } catch {
      /* already gone */
    }
  }

  publicUrl(key: string): string {
    return `/media/${safeKey(key)}`;
  }
}

function build(): StorageProvider {
  switch (env.STORAGE_PROVIDER) {
    // case "s3": return new S3StorageProvider({ ... });
    case "local":
    default:
      return new LocalStorageProvider();
  }
}

const globalForStorage = globalThis as unknown as { storage?: StorageProvider };
export const storage: StorageProvider =
  globalForStorage.storage ?? (globalForStorage.storage = build());

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const ACCEPTED_IMAGE_TYPES = Object.keys(EXT);
