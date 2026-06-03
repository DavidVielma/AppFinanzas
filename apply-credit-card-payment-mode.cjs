const fs = require("fs");
const { Client } = require("pg");

async function main() {
  const sql = fs.readFileSync("supabase/migrations/20260603_credit_card_payment_mode.sql", "utf8");
  const client = new Client({
    host: process.env.PGHOST,
    port: Number(process.env.PGPORT || 5432),
    database: process.env.PGDATABASE,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();
  await client.query(sql);
  const { rows } = await client.query(
    "select column_name from information_schema.columns where table_schema = $1 and table_name = $2 and column_name = $3",
    ["public", "movements", "card_payment_mode"]
  );
  await client.end();
  console.log(JSON.stringify(rows));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
