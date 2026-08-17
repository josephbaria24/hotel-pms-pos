/**
 * Seed student Auth users for PalawanSU Hotel PMS classroom.
 *
 * Requires in .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL=...
 *   SUPABASE_SERVICE_ROLE_KEY=...   (Dashboard → Project Settings → API → service_role)
 *
 * Run:  node --env-file=.env.local scripts/seed-students.mjs
 */

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

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

/** @type {{ fullName: string, email: string, password: string }[]} */
const students = [
  { fullName: "Raiza Pasinabo", email: "pasinaborairai0807@gmail.com", password: "rairai0807pas" },
  { fullName: "Jasmin Grace Pelonia", email: "jasmingracepelonia@gmail.com", password: "07/13/2004" },
  { fullName: "Kristine Kaye Paredes", email: "paredeskristinekaye32@gmail.com", password: "kaye0319paredes" },
  { fullName: "Kianmae Valdez", email: "kianmaevaldez1@gmail.com", password: "BSHM3B21" },
  { fullName: "Honeylyn P. Reselloza", email: "honeyreselloza@gmail.com", password: "honey061118" },
  { fullName: "Roshelle L. Mabutin", email: "mabutinroshelle0805@gmail.com", password: "mabutin0805" },
  { fullName: "Ivonie B. Lagan", email: "ivonielagan15@gmail.com", password: "TRIXIEMAELAGAN" },
  { fullName: "Joy Dela Cruz", email: "ibanezjoy840@gmail.com", password: "jdelacruz0526" },
  { fullName: "Angelica Palermo", email: "angelicapalermo402@gmail.com", password: "student2024" },
  { fullName: "Michelle R. Macapinig", email: "michellemacapinig4@gmail.com", password: "macapinig0509" },
  { fullName: "Sander John P. Paculdas", email: "psanderjohn@gmail.com", password: "DOUGHDS102806" },
  { fullName: "Dwyne Eman Antolin", email: "emanantolin3@gmail.com", password: "emmanuel192006" },
  { fullName: "Jaypee John Amacio", email: "amaciojaypeejohn71@gmail.com", password: "Panasonic66" },
  { fullName: "Kristel Saclet", email: "kristelsaclet84@gmail.com", password: "sacletkristel20" },
  { fullName: "Bench P. Acosta", email: "acostabench892@gmail.com", password: "Bensoy333" },
  { fullName: "Eranio J Domine", email: "eraniodomine77@gmail.com", password: "SECRETLANG00" },
  { fullName: "Jasmin H. Timajo", email: "timajojasmin00@gmail.com", password: "jasmin2026" },
  { fullName: "Charles Ian P. Refuela", email: "refuelacharles260@gmail.com", password: "charlesian66" },
  { fullName: "Torreblanca Neljay", email: "torreblancaneljah@gmail.com", password: "142005FUCKYOU" },
  { fullName: "Gretchen Jalea", email: "gretchenjalea@gmail.com", password: "123005chen" },
  { fullName: "Ana Jane Mampay", email: "mampayjane@gmail.com", password: "JANE-M 27" },
  { fullName: "Crisa P. Calalin", email: "crisacalalin23@gmail.com", password: "PSUBELOVED2024" },
  { fullName: "Alejo Althea", email: "alejoalthea19@gmail.com", password: "march142006" },
  { fullName: "Rinalyn Jusos", email: "jusosrinalyn23@gmail.com", password: "Favila072305" },
  { fullName: "Teleslie O. Cayaban", email: "telesliecayaban01@gmail.com", password: "Cayaban01" },
  { fullName: "Myra A. Pacaldo", email: "pmyra5816@gmail.com", password: "0323myra" },
  { fullName: "Kimberly Z. Magbanua", email: "magbanuakimberly22@gmail.com", password: "20230151HM" },
  { fullName: "Angel Divine Villono", email: "angeldivinevillono3@gmail.com", password: "angeldivine03" },
  { fullName: "Kiene Carinan", email: "kienegulacarinan@gmail.com", password: "091206kken" },
  { fullName: "Jenny B. Espiloy", email: "espiloyjenny34@gmail.com", password: "ESPILOY2126" },
  { fullName: "Kurt P. Tacob", email: "kurttacob45@gmail.com", password: "april102005" },
  { fullName: "Kimberly Ann V. Caabas", email: "kimberlyanncaabas687@gmail.com", password: "yumika108" },
  { fullName: "Princess Zyrhel P. Lazaro", email: "zyrhelprincess@gmail.com", password: "princesszyrhel_25" },
  { fullName: "Jenelyn M. Cardejon", email: "cardejonjenelynn@gmail.com", password: "ikawlangsapatna#143barbie" },
  { fullName: "Ryzah G. Dumali", email: "ryzahdumali30@gmail.com", password: "dumaliryzahg" },
  { fullName: "Nichaela Rose A. Pastrana", email: "romnickpastrana29@gmail.com", password: "kylapastrana0987654321" },
  { fullName: "Maechaela M. Ebbah", email: "madamayebbah@gmail.com", password: "LegendsLangNakakaalam" },
  { fullName: "Angelen Calipayan", email: "angelyncalipayan98@gmail.com", password: "072905angebirthday" },
  { fullName: "B. Segayon", email: "bsegayon@gmail.com", password: "SEGAYONB.29" },
  { fullName: "Angelyn A. Dela Cruz", email: "delaceuzangelyn@gmail.com", password: "angelyn123" },
  { fullName: "Jonathan Samante", email: "samantejonathan6@gmail.com", password: "jonathan@123" },
  { fullName: "Aprielene O. Villanueva", email: "aprielenevillanueva82@gmail.com", password: "lenelene2029passcode" },
  { fullName: "Maricar C. Lagan", email: "laganmaricar2@gmail.com", password: "maicmaic" },
  { fullName: "Remark C. Salvador", email: "remarkcsalvador019@gmail.com", password: "remarkcsalvador12122005" },
  { fullName: "Nico Repecio", email: "nicorepecio@gmail.com", password: "repecio2001" },
];

function usernameFromEmail(email) {
  return email.split("@")[0].replace(/[^a-zA-Z0-9._-]/g, "").slice(0, 40);
}

async function main() {
  console.log(`Seeding ${students.length} student accounts…\n`);

  const { data: listed, error: listErr } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (listErr) throw listErr;
  const byEmail = new Map(
    (listed.users ?? []).map((u) => [u.email?.toLowerCase() ?? "", u]),
  );

  let created = 0;
  let updated = 0;
  let failed = 0;

  for (const student of students) {
    try {
      const result = await upsertStudent(student, byEmail);
      console.log(`✓ ${result.status.padEnd(8)} ${result.email}`);
      if (result.status === "created") created += 1;
      else updated += 1;
    } catch (err) {
      failed += 1;
      console.error(`✗ FAIL     ${student.email}: ${err.message ?? err}`);
    }
  }

  console.log(`\nDone. created=${created} updated=${updated} failed=${failed}`);
}

async function upsertStudent(student, byEmail) {
  const email = student.email.trim().toLowerCase();
  const password = student.password;
  const fullName = student.fullName.trim();
  const username = usernameFromEmail(email);
  const existing = byEmail.get(email);

  if (existing) {
    const { error } = await supabase.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, username, role: "staff" },
    });
    if (error) throw error;

    await supabase.from("profiles").upsert({
      id: existing.id,
      tenant_id: existing.id,
      full_name: fullName,
      username,
      role: "staff",
      is_active: true,
      login_password: password,
      updated_at: new Date().toISOString(),
    });

    await supabase.rpc("seed_tenant_defaults", { p_tenant: existing.id });
    return { email, status: "updated", id: existing.id };
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, username, role: "staff" },
  });
  if (error) throw error;

  if (data.user) {
    byEmail.set(email, data.user);
    await supabase.from("profiles").upsert({
      id: data.user.id,
      tenant_id: data.user.id,
      full_name: fullName,
      username,
      role: "staff",
      is_active: true,
      login_password: password,
    });
  }

  return { email, status: "created", id: data.user?.id };
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
