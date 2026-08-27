// Manage the isolated local dev PostgreSQL cluster for Lunova.
// Usage: node scripts/pg.mjs <start|stop|status|restart>
//
// This is a user-owned throwaway cluster created by initdb — completely separate
// from any system PostgreSQL install. Data dir: ~/.lunova/pgdata, port 5433.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const PG_BIN = process.env.LUNOVA_PG_BIN || "C:\\Program Files\\PostgreSQL\\17\\bin";
const DATA_DIR = process.env.LUNOVA_PG_DATA || join(homedir(), ".lunova", "pgdata");
const LOG_FILE = join(homedir(), ".lunova", "pg.log");
const PG_CTL = join(PG_BIN, process.platform === "win32" ? "pg_ctl.exe" : "pg_ctl");

if (!existsSync(DATA_DIR)) {
  console.error(`No cluster at ${DATA_DIR}. See docs/DATABASE.md to create one.`);
  process.exit(1);
}

const cmd = process.argv[2] ?? "status";
const args = {
  start: ["-D", DATA_DIR, "-l", LOG_FILE, "-o", "-p 5433", "start"],
  stop: ["-D", DATA_DIR, "-m", "fast", "stop"],
  restart: ["-D", DATA_DIR, "-l", LOG_FILE, "-o", "-p 5433", "-m", "fast", "restart"],
  status: ["-D", DATA_DIR, "status"],
}[cmd];

if (!args) {
  console.error("Usage: node scripts/pg.mjs <start|stop|status|restart>");
  process.exit(1);
}

const res = spawnSync(PG_CTL, args, { stdio: "inherit", detached: cmd === "start" });
process.exit(res.status ?? 0);
