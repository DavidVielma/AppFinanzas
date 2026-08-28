const { Client } = require("pg");

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

const sql = `
alter table public.movements
  add column if not exists paid_responsibles text;

comment on column public.movements.paid_responsibles is
  'Lista JSON de responsables cuya parte del movimiento ya fue pagada.';
`;

async function main() {
  const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();
  await client.query(sql);
  await client.end();
  console.log("Paid responsibles migration applied.");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
