/**
 * Create this classroom staff batch as staff accounts.
 * Password for every new account: pms123
 * Existing emails in Supabase Auth are skipped (not overwritten).
 *
 * Requires in .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL=...
 *   SUPABASE_SERVICE_ROLE_KEY=...
 *
 * Run:  npm run seed:staff-pms123
 */

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PASSWORD = "pms123";

if (!url || !serviceKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.\n" +
      "Add SUPABASE_SERVICE_ROLE_KEY to .env.local from Supabase → Settings → API.",
  );
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/** @type {{ fullName: string, email: string }[]} */
const staff = [
  { fullName: "Loisa Joy Gianan", email: "loisajoygianan@gmail.com" },
  { fullName: "Richelle Y. Abling", email: "richelleyabling@gmail.com" },
  { fullName: "Princes Dela Cruz", email: "princesdelacruz295@gmail.com" },
  { fullName: "Gerald Pentinio", email: "geraldpentinio1018@gmail.com" },
  { fullName: "Mylac Tabangay", email: "mylactabangay@gmail.com" },
  { fullName: "Alejandra Rosaut", email: "alejandrarosaut03@gmail.com" },
  { fullName: "Zhari Ponce de Leon", email: "zhariponce@gmail.com" },
  { fullName: "Rinalyn Martija", email: "rinalynmartija@gmail.com" },
  { fullName: "Seindy Ysulat", email: "seindyysulat8@gmail.com" },
  { fullName: "John Lester Peñalosa", email: "johnlesterpenalosa12@gmail.com" },
  { fullName: "Joan Villarosa", email: "villarosajoan471@gmail.com" },
  { fullName: "John Loyd Dagaraga", email: "johnloyddagaraga27@gmail.com" },
  { fullName: "Aijeza Ustares", email: "aijezaustares9@gmail.com" },
  { fullName: "Angelyn Sajol", email: "angelynsajol1@gmail.com" },
  { fullName: "Pinky Cautibar", email: "pinkycautibar9@gmail.com" },
  { fullName: "Rebecca Gallardo", email: "gallardorebecca85@gmail.com" },
  { fullName: "Jasper Catain Servano", email: "jaspercatainservano@gmail.com" },
  { fullName: "Cyrene Gapuz Rempillo", email: "cyrenegapuzrempillo@gmail.com" },
  { fullName: "Prince Martinico", email: "martinicoprince@gmail.com" },
  { fullName: "Cherlyn Anguas", email: "anguascherlyn@gmail.com" },
  { fullName: "Calina May Poligrates", email: "calinamaypoligrates7@gmail.com" },
  { fullName: "Clariez Igaña", email: "iganaclariez614@gmail.com" },
  { fullName: "Marjory Romano", email: "romanomarjory@gmail.com" },
  { fullName: "Gian Cojamco", email: "giancojamco47@gmail.com" },
  { fullName: "John Benedict Miraflores", email: "mirafloresjohnbenedict@gmail.com" },
  { fullName: "Dexter Rosas", email: "dexterrosas117@gmail.com" },
  { fullName: "Enry Jr Pasar", email: "pasarenryjr24@gmail.com" },
  { fullName: "Emil Rey Reyes", email: "emilreyreyes181@gmail.com" },
  { fullName: "Julie Mae Rodriguez", email: "juliemaerodriguez390@gmail.com" },
  { fullName: "John Ilalim", email: "ilalimjohn@gmail.com" },
  { fullName: "Leonila Sabanal", email: "leonilasabanal10@gmail.com" },
  { fullName: "Jocelyn C. Buri", email: "burijocelync67@gmail.com" },
  { fullName: "Ryan Echalico", email: "ryanechalico057@gmail.com" },
  { fullName: "Rosamie Lucero", email: "rosamielucero@gmail.com" },
  { fullName: "Cyrel Viguellanza Madeja", email: "cyrelviguellanzamadeja@gmail.com" },
  { fullName: "Crislyn Jane Pendon", email: "pendoncrislynjane7@gmail.com" },
  { fullName: "Marc Jerry Sanchez", email: "sanchezmarcjerry4@gmail.com" },
  { fullName: "Gerald Dalanon Alcantara", email: "geralddalanonalcantara@gmail.com" },
];

function usernameFromEmail(email) {
  return email.split("@")[0].replace(/[^a-zA-Z0-9._-]/g, "").slice(0, 40);
}

async function listAllAuthEmails() {
  /** @type {Set<string>} */
  const emails = new Set();
  let page = 1;
  const perPage = 1000;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const users = data.users ?? [];
    for (const user of users) {
      if (user.email) emails.add(user.email.toLowerCase());
    }
    if (users.length < perPage) break;
    page += 1;
  }

  return emails;
}

async function main() {
  console.log(`Seeding ${staff.length} staff accounts (password: ${PASSWORD})…\n`);

  const existingEmails = await listAllAuthEmails();

  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const person of staff) {
    const email = person.email.trim().toLowerCase();
    const fullName = person.fullName.trim();
    const username = usernameFromEmail(email);

    if (existingEmails.has(email)) {
      skipped += 1;
      console.log(`- skip     ${email}  (${fullName})`);
      continue;
    }

    try {
      const { data, error } = await supabase.auth.admin.createUser({
        email,
        password: PASSWORD,
        email_confirm: true,
        user_metadata: { full_name: fullName, username, role: "staff" },
      });
      if (error) throw error;
      if (!data.user) throw new Error("No user returned");

      const { error: profileError } = await supabase.from("profiles").upsert({
        id: data.user.id,
        tenant_id: data.user.id,
        full_name: fullName,
        username,
        role: "staff",
        is_active: true,
        login_password: PASSWORD,
      });
      if (profileError) throw profileError;

      await supabase.rpc("seed_tenant_defaults", { p_tenant: data.user.id });

      existingEmails.add(email);
      created += 1;
      console.log(`✓ created  ${email}  (${fullName})`);
    } catch (err) {
      failed += 1;
      console.error(`✗ FAIL     ${email}: ${err.message ?? err}`);
    }
  }

  console.log(`\nDone. created=${created} skipped=${skipped} failed=${failed}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
