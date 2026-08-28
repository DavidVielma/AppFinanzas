const { Client } = require("pg");

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

const sql = `
alter table public.movements
  add column if not exists responsible_amounts text,
  add column if not exists reimbursement_source_id uuid;

alter table public.movements
  drop constraint if exists movements_reimbursement_source_id_fkey,
  add constraint movements_reimbursement_source_id_fkey
    foreign key (reimbursement_source_id) references public.movements(id) on delete set null;

create index if not exists movements_reimbursement_source_idx
  on public.movements(user_id, reimbursement_source_id);

create unique index if not exists movements_one_reimbursement_per_source_idx
  on public.movements(user_id, reimbursement_source_id)
  where reimbursement_source_id is not null;
`;

async function main() {
  const client = new Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  await client.query(sql);
  await client.end();
  console.log("Card reimbursements migration applied.");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
