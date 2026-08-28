import { describe, expect, it } from "vitest";
import { __redactForTests as redact } from "./logger";

describe("log redaction", () => {
  it("drops known-sensitive keys anywhere in the tree", () => {
    const out = redact({
      kind: "music",
      email: "a@b.com",
      nested: { phone: "+1555", ip: "1.2.3.4", ok: true },
      userAgent: "Mozilla",
    }) as Record<string, unknown>;
    expect(out.kind).toBe("music");
    expect(out.email).toBe("[redacted]");
    expect(out.userAgent).toBe("[redacted]");
    expect((out.nested as Record<string, unknown>).phone).toBe("[redacted]");
    expect((out.nested as Record<string, unknown>).ip).toBe("[redacted]");
    expect((out.nested as Record<string, unknown>).ok).toBe(true);
  });

  it("truncates very long strings", () => {
    const out = redact({ note: "x".repeat(900) }) as { note: string };
    expect(out.note.length).toBeLessThan(900);
    expect(out.note.endsWith("…")).toBe(true);
  });

  it("caps recursion depth", () => {
    const deep: Record<string, unknown> = {};
    let cur = deep;
    for (let i = 0; i < 10; i++) {
      cur.next = {};
      cur = cur.next as Record<string, unknown>;
    }
    expect(() => redact(deep)).not.toThrow();
  });
});
