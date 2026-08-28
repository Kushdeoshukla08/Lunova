/**
 * Bake the staging personas' photos into the Docker image.
 *
 * WHY
 * The staging seed runs from a laptop against Neon: it writes persona *rows* to
 * the database and their *files* to the laptop's upload directory. The
 * container never sees those files, and its own disk is wiped on every deploy,
 * so every seeded photo 404s in staging — the feed looks broken to anyone
 * testing it, and the fix has nothing to do with the code they are testing.
 *
 * The photos are deterministic gradients derived from the persona, so the build
 * can generate exactly the bytes the seeder would have written. Both go through
 * `personaPhotos()` for the key and the bytes; two copies of that formula would
 * drift, and the failure mode is silent.
 *
 * This does NOT make uploads durable — a photo a tester adds still disappears
 * on the next deploy. Only real object storage fixes that (docs/PROVIDERS.md).
 *
 *   npx tsx scripts/stage-persona-photos.ts <outDir>
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { PERSONAS } from "../prisma/persona-data";
import { personaPhotos } from "../prisma/personas";

const outDir = process.argv[2];
if (!outDir) {
  console.error("usage: npx tsx scripts/stage-persona-photos.ts <outDir>");
  process.exit(1);
}

let written = 0;
let bytes = 0;
for (const persona of PERSONAS) {
  for (const photo of personaPhotos(persona)) {
    const abs = join(outDir, photo.key);
    await mkdir(dirname(abs), { recursive: true });
    await writeFile(abs, photo.bytes);
    written++;
    bytes += photo.bytes.byteLength;
  }
}

console.log(
  `[persona-photos] wrote ${written} files (${Math.round(bytes / 1024)} KB) to ${outDir}`,
);
