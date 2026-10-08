const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

const sql = fs.readFileSync(path.join(__dirname, "supabase/migrations/20261008_shared_account_views.sql"), "utf8");

async function main() {
  const client = new Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  await client.query(sql);
  await client.end();
  console.log("Shared account views migration applied.");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
