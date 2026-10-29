import { connectDatabase, migrate } from "../src/server/wam/database";
import { seedDemo } from "../src/server/wam/seed";

const command = process.argv[2] ?? "migrate";
if (process.env["NODE_ENV"] === "production" && !process.env["DATABASE_URL"])
  throw new Error("DATABASE_URL is required in production.");
const db = await connectDatabase(
  process.env["DATABASE_URL"],
  process.env["WAM_DATA_DIR"] ?? ".data/wam",
);
try {
  await migrate(db);
  if (command === "seed") {
    if (process.env["WAM_LOCAL_DEMO"] !== "true" || process.env["NODE_ENV"] === "production")
      throw new Error("Sample seeding requires WAM_LOCAL_DEMO=true outside production.");
    await seedDemo(db);
  }
  const { rows } = await db.query(
    "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename",
  );
  console.log(
    `Database ready: ${rows.length} WAM tables.`,
    rows.map((row) => row.tablename).join(", "),
  );
} finally {
  await db.close();
}
