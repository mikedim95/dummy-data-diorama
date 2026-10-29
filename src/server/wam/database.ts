import { readFile, readdir, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import type { Row as PostgresRow, Sql, TransactionSql, ParameterOrJSON } from "postgres";

export type Row = PostgresRow;
export interface Database {
  query<T extends Row = Row>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
  exec(sql: string): Promise<unknown>;
  transaction<T>(run: (tx: Database) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

export async function connectDatabase(url?: string, directory = ".data/wam"): Promise<Database> {
  if (url) {
    const { default: postgres } = await import("postgres");
    const client = postgres(url, { max: 5, onnotice: () => {} });
    const wrap = (sql: Sql | TransactionSql): Database => ({
      query: async <T extends Row>(text: string, params: unknown[] = []) => ({
        rows: await sql.unsafe<T[]>(text, params as ParameterOrJSON<never>[]),
      }),
      exec: (text) => sql.unsafe(text),
      transaction: (run) =>
        ("begin" in sql
          ? sql.begin((tx) => run(wrap(tx)))
          : sql.savepoint((tx) => run(wrap(tx)))) as ReturnType<typeof run>,
      close: () => client.end(),
    });
    return wrap(client);
  }
  const { PGlite } = await import("@electric-sql/pglite");
  if (directory !== "memory://") await mkdir(resolve(directory), { recursive: true });
  const client = new PGlite(directory === "memory://" ? undefined : resolve(directory));
  await client.waitReady;
  return client as unknown as Database;
}

export async function migrate(db: Database) {
  await db.exec(
    "CREATE SCHEMA IF NOT EXISTS wam_internal; CREATE TABLE IF NOT EXISTS wam_internal.migrations (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())",
  );
  const directory = resolve("database/migrations");
  for (const name of (await readdir(directory)).filter((file) => file.endsWith(".sql")).sort()) {
    const source = await readFile(resolve(directory, name), "utf8");
    const checksum = createHash("sha256").update(source).digest("hex");
    const existing = (
      await db.query("SELECT checksum FROM wam_internal.migrations WHERE name=$1", [name])
    ).rows[0];
    if (existing) {
      if (existing["checksum"] !== checksum)
        throw new Error(`Applied migration changed: ${name}. Add a new migration instead.`);
      continue;
    }
    // The supplied fresh-install SQL has its own transaction; keep the ledger atomic with it.
    const body = source
      .replace(/^\uFEFF/, "")
      .replace(/^BEGIN;\s*$/m, "")
      .replace(/^COMMIT;\s*$/m, "");
    await db.transaction(async (tx) => {
      await tx.exec(body);
      await tx.query("INSERT INTO wam_internal.migrations(name, checksum) VALUES($1,$2)", [
        name,
        checksum,
      ]);
    });
  }
}

const runtime = globalThis as typeof globalThis & { wamDatabase?: Promise<Database> };
export function getDatabase() {
  runtime.wamDatabase ??= (async () => {
    const url = process.env["DATABASE_URL"];
    if (process.env["NODE_ENV"] === "production" && !url)
      throw new Error("DATABASE_URL is required in production.");
    const db = await connectDatabase(url, process.env["WAM_DATA_DIR"] ?? ".data/wam");
    await migrate(db);
    if (process.env["WAM_LOCAL_DEMO"] === "true" && process.env["NODE_ENV"] !== "production") {
      const { seedDemo } = await import("./seed");
      await seedDemo(db);
    }
    return db;
  })();
  return runtime.wamDatabase;
}

export async function withActor<T>(
  db: Database,
  accountId: string,
  reason: string,
  run: (tx: Database) => Promise<T>,
) {
  return db.transaction(async (tx) => {
    await tx.query(
      "SELECT set_config('wam.actor_user_id',$1,true), set_config('wam.change_reason',$2,true)",
      [accountId, reason],
    );
    return run(tx);
  });
}
