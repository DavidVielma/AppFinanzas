const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

const sql = fs.readFileSync(path.join(__dirname, "supabase/migrations/20261008_link_legacy_installments.sql"), "utf8");

async function main() {
  const client = new Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  const results = await client.query(sql);
  const summary = [].concat(results).find((result) => result.rows?.[0]?.series_enlazadas !== undefined);
  await client.end();
  console.log("Installment series migration applied.", summary?.rows?.[0] || "");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
