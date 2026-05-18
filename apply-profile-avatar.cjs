const { Client } = require("pg");

const sql = `
alter table public.profiles
add column if not exists avatar_base64 text;
`;

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();
  await client.query(sql);
  await client.end();
  console.log("profiles.avatar_base64 listo");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
