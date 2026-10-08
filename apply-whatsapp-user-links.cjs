const { Client } = require("pg");
const fs = require("fs");
const path = require("path");

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

const sqlPath = path.join(__dirname, "supabase", "migrations", "20260526_whatsapp_user_links.sql");
const sql = fs.readFileSync(sqlPath, "utf8");

async function main() {
  const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();
  await client.query(sql);
  await client.end();
  console.log("WhatsApp user links migration applied.");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
