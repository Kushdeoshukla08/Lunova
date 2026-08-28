import { describe, expect, it } from "vitest";
import { resolveBuildCommit, sanitizeDatabaseUrl } from "./health-info";

describe("sanitizeDatabaseUrl", () => {
  it("keeps only host + database name — drops user, password, port, query", () => {
    const out = sanitizeDatabaseUrl(
      "postgresql://app_user:sup3r-s3cret@ep-cool-mud-123-pooler.eu-central-1.aws.neon.tech:5432/neondb?sslmode=require&options=project%3Dep-cool-mud-123",
    );
    expect(out).toEqual({
      host: "ep-cool-mud-123-pooler.eu-central-1.aws.neon.tech",
      name: "neondb",
    });
  });

  it("never returns the password or username in any field", () => {
    const out = sanitizeDatabaseUrl(
      "postgresql://lunova_app:PLAINTEXT_PASSWORD@127.0.0.1:5433/lunova_dev?schema=public",
    );
    const serialized = JSON.stringify(out);
    expect(serialized).not.toContain("PLAINTEXT_PASSWORD");
    expect(serialized).not.toContain("lunova_app");
    expect(serialized).not.toContain("schema=public");
    expect(out).toEqual({ host: "127.0.0.1", name: "lunova_dev" });
  });

  it("returns null for a non-URL value", () => {
    expect(sanitizeDatabaseUrl("not a url")).toBeNull();
    expect(sanitizeDatabaseUrl("")).toBeNull();
    expect(sanitizeDatabaseUrl(undefined)).toBeNull();
  });

  it("handles a URL with no database path", () => {
    expect(sanitizeDatabaseUrl("postgresql://u:p@host:5432")).toEqual({
      host: "host",
      name: "(none)",
    });
  });
});

describe("resolveBuildCommit", () => {
  it("prefers BUILD_COMMIT, then platform vars, in order", () => {
    expect(resolveBuildCommit({ BUILD_COMMIT: "aaa", RENDER_GIT_COMMIT: "bbb" })).toBe("aaa");
    expect(resolveBuildCommit({ RENDER_GIT_COMMIT: "bbb", GITHUB_SHA: "ccc" })).toBe("bbb");
    expect(resolveBuildCommit({ GITHUB_SHA: "ccc" })).toBe("ccc");
  });

  it("falls back to 'unknown' when nothing is set", () => {
    expect(resolveBuildCommit({})).toBe("unknown");
    expect(resolveBuildCommit({ BUILD_COMMIT: "   " })).toBe("unknown");
  });
});
