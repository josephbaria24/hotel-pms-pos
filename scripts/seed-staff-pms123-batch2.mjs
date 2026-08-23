/**
 * Create / update this staff batch.
 * Password for every account: pms123
 * Existing Auth emails are updated (password + profile), not skipped.
 *
 * Requires in .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL=...
 *   SUPABASE_SERVICE_ROLE_KEY=...
 *
 * Run:  npm run seed:staff-pms123-2
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
  { fullName: "Kimberly Magbanua", email: "magbanuakimberly22@gmail.com" },
  { fullName: "Crisa Calalin", email: "crisacalalin23@gmail.com" },
  { fullName: "Charles Refuela", email: "refuelacharles260@gmail.com" },
  { fullName: "Jaypee John Amacio", email: "amaciojaypeejohn71@gmail.com" },
  { fullName: "Sander John Paculdas", email: "psanderjohn@gmail.com" },
  { fullName: "B. Segayon", email: "bsegayon@gmail.com" },
  { fullName: "Teleslie Cayaban", email: "telesliecayaban01@gmail.com" },
  { fullName: "Romnick Pastrana", email: "romnickpastrana29@gmail.com" },
  { fullName: "Angelica Palermo", email: "angelicapalermo402@gmail.com" },
  { fullName: "Angelyn Calipayan", email: "angelyncalipayan98@gmail.com" },
  { fullName: "Zyrhel Princess Lazaro", email: "zyrhelprincess@gmail.com" },
  { fullName: "Jonathan Samante", email: "samantejonathan6@gmail.com" },
  { fullName: "Kimberly Ann Caabas", email: "kimberlyanncaabas687@gmail.com" },
  { fullName: "Bench Acosta", email: "acostabench892@gmail.com" },
  { fullName: "Maricar Lagan", email: "laganmaricar2@gmail.com" },
  { fullName: "Joy Dela Cruz", email: "ibanezjoy840@gmail.com" },
  { fullName: "Remark Salvador", email: "remarkcsalvador019@gmail.com" },
  { fullName: "Raiza Pasinabo", email: "pasinaborairai0807@gmail.com" },
  { fullName: "Ivonie Lagan", email: "ivonielagan15@gmail.com" },
  { fullName: "Nico Repecio", email: "nicorepecio@gmail.com" },
  { fullName: "Jasmin Timajo", email: "timajojasmin00@gmail.com" },
  { fullName: "Madamay Ebbah", email: "madamayebbah@gmail.com" },
  { fullName: "Kristine Kaye Paredes", email: "paredeskristinekaye32@gmail.com" },
  { fullName: "Eman Antolin", email: "emanantolin3@gmail.com" },
  { fullName: "Roshelle Mabutin", email: "mabutinroshelle0805@gmail.com" },
  { fullName: "Kianmae Valdez", email: "kianmaevaldez1@gmail.com" },
  { fullName: "Kristel Saclet", email: "kristelsaclet84@gmail.com" },
  { fullName: "Jasmin Grace Pelonia", email: "jasmingracepelonia@gmail.com" },
  { fullName: "Rinalyn Jusos", email: "jusosrinalyn23@gmail.com" },
  { fullName: "Jenny Espiloy", email: "espiloyjenny34@gmail.com" },
  { fullName: "Honey Padul Reselloza", email: "honeypadul@gmail.com" },
  { fullName: "Angelyn Dela Cruz", email: "delaceuzangelyn@gmail.com" },
  { fullName: "Gretchen Jalea", email: "gretchenjalea@gmail.com" },
  { fullName: "Althea Alejo", email: "alejoalthea19@gmail.com" },
  { fullName: "Neljah Torreblanca", email: "torreblancaneljah@gmail.com" },
  { fullName: "Kiene Carinan", email: "kienegulacarinan@gmail.com" },
  { fullName: "Angel Divine Villono", email: "angeldivinevillono3@gmail.com" },
  { fullName: "Ryzah Dumali", email: "ryzahdumali30@gmail.com" },
];

function usernameFromEmail(email) {
  return email.split("@")[0].replace(/[^a-zA-Z0-9._-]/g, "").slice(0, 40);
}

async function listAllAuthUsers() {
  /** @type {Map<string, import("@supabase/supabase-js").User>} */
  const byEmail = new Map();
  let page = 1;
  const perPage = 1000;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const users = data.users ?? [];
    for (const user of users) {
      if (user.email) byEmail.set(user.email.toLowerCase(), user);
    }
    if (users.length < perPage) break;
    page += 1;
  }

  return byEmail;
}

async function upsertProfile(userId, fullName, username) {
  const { error } = await supabase.from("profiles").upsert({
    id: userId,
    tenant_id: userId,
    full_name: fullName,
    username,
    role: "staff",
    is_active: true,
    login_password: PASSWORD,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
  await supabase.rpc("seed_tenant_defaults", { p_tenant: userId });
}

async function main() {
  console.log(`Seeding ${staff.length} staff accounts (password: ${PASSWORD})…\n`);

  const byEmail = await listAllAuthUsers();

  let created = 0;
  let updated = 0;
  let failed = 0;

  for (const person of staff) {
    const email = person.email.trim().toLowerCase();
    const fullName = person.fullName.trim();
    const username = usernameFromEmail(email);
    const existing = byEmail.get(email);

    try {
      if (existing) {
        const { error } = await supabase.auth.admin.updateUserById(existing.id, {
          password: PASSWORD,
          email_confirm: true,
          user_metadata: { full_name: fullName, username, role: "staff" },
        });
        if (error) throw error;
        await upsertProfile(existing.id, fullName, username);
        updated += 1;
        console.log(`✓ updated  ${email}  (${fullName})`);
        continue;
      }

      const { data, error } = await supabase.auth.admin.createUser({
        email,
        password: PASSWORD,
        email_confirm: true,
        user_metadata: { full_name: fullName, username, role: "staff" },
      });
      if (error) throw error;
      if (!data.user) throw new Error("No user returned");

      await upsertProfile(data.user.id, fullName, username);
      byEmail.set(email, data.user);
      created += 1;
      console.log(`✓ created  ${email}  (${fullName})`);
    } catch (err) {
      failed += 1;
      console.error(`✗ FAIL     ${email}: ${err.message ?? err}`);
    }
  }

  console.log(`\nDone. created=${created} updated=${updated} failed=${failed}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
