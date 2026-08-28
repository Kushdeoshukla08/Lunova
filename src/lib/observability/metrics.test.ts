import { beforeEach, describe, expect, it } from "vitest";
import { metrics } from "./metrics";

beforeEach(() => metrics.reset());

describe("metrics registry", () => {
  it("counters accumulate per label set and render Prometheus text", () => {
    metrics.increment("lunova_auth_attempts_total", { action: "login", outcome: "success" });
    metrics.increment("lunova_auth_attempts_total", { action: "login", outcome: "success" });
    metrics.increment("lunova_auth_attempts_total", { action: "login", outcome: "bad_password" });

    const out = metrics.render();
    expect(out).toContain("# TYPE lunova_auth_attempts_total counter");
    expect(out).toContain('lunova_auth_attempts_total{action="login",outcome="success"} 2');
    expect(out).toContain('lunova_auth_attempts_total{action="login",outcome="bad_password"} 1');
  });

  it("gauges can go up and down", () => {
    metrics.addGauge("lunova_sse_connections", 1);
    metrics.addGauge("lunova_sse_connections", 1);
    metrics.addGauge("lunova_sse_connections", -1);
    expect(metrics.render()).toContain("lunova_sse_connections 1");
  });

  it("histograms emit cumulative buckets, _sum and _count", () => {
    metrics.observe("lunova_db_ping_ms", 8);
    metrics.observe("lunova_db_ping_ms", 40);
    metrics.observe("lunova_db_ping_ms", 300);

    const out = metrics.render();
    expect(out).toContain("# TYPE lunova_db_ping_ms histogram");
    expect(out).toContain('lunova_db_ping_ms{le="10"} 1');
    expect(out).toContain('lunova_db_ping_ms{le="50"} 2');
    expect(out).toContain('lunova_db_ping_ms{le="+Inf"} 3');
    expect(out).toContain("lunova_db_ping_ms_count 3");
    expect(out).toContain("lunova_db_ping_ms_sum 348");
  });

  it("time() records latency with an outcome label and rethrows", async () => {
    await expect(
      metrics.time("op_ms", { op: "x" }, async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(metrics.render()).toContain('op_ms{op="x",outcome="error",le="+Inf"} 1');
  });
});
