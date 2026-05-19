const { Client } = require("pg");

const sql = `
alter table public.profiles
add column if not exists theme_mode text not null default 'light';

alter table public.profiles
drop constraint if exists profiles_theme_mode_check;

alter table public.profiles
add constraint profiles_theme_mode_check
check (theme_mode in ('light', 'dark'));
`;

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();
  await client.query(sql);
  await client.end();
  console.log("profiles.theme_mode listo");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
