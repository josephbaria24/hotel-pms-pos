/**
 * Set the same login password on every staff account.
 * Admin accounts are not changed.
 *
 * Requires in .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL=...
 *   SUPABASE_SERVICE_ROLE_KEY=...   (Dashboard → Project Settings → API → service_role)
 *
 * Run:
 *   node --env-file=.env.local scripts/reset-staff-passwords.mjs "YourNewPassword"
 *   npm run reset:staff-passwords -- "YourNewPassword"
 *
 * Or set STAFF_PASSWORD in the environment instead of passing an argument.
 */

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const password = (process.argv[2] || process.env.STAFF_PASSWORD || "").trim();

if (!url || !serviceKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.\n" +
      "Add SUPABASE_SERVICE_ROLE_KEY to .env.local from Supabase → Settings → API.",
  );
  process.exit(1);
}

if (password.length < 6) {
  console.error(
    "Password must be at least 6 characters.\n\n" +
      '  node --env-file=.env.local scripts/reset-staff-passwords.mjs "YourNewPassword"\n' +
      '  npm run reset:staff-passwords -- "YourNewPassword"',
  );
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const { data: staff, error } = await supabase
    .from("profiles")
    .select("id, full_name, username, role")
    .eq("role", "staff")
    .order("full_name");

  if (error) throw error;

  const rows = staff ?? [];
  if (rows.length === 0) {
    console.log("No staff profiles found.");
    return;
  }

  console.log(`Resetting password for ${rows.length} staff account(s)…\n`);

  let updated = 0;
  let failed = 0;

  for (const profile of rows) {
    const label = profile.full_name || profile.username || profile.id;
    try {
      const { error: authError } = await supabase.auth.admin.updateUserById(profile.id, {
        password,
        email_confirm: true,
      });
      if (authError) throw authError;

      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          login_password: password,
          updated_at: new Date().toISOString(),
        })
        .eq("id", profile.id);
      if (profileError) throw profileError;

      updated += 1;
      console.log(`✓ ${label}`);
    } catch (err) {
      failed += 1;
      console.error(`✗ ${label}: ${err.message ?? err}`);
    }
  }

  console.log(`\nDone. updated=${updated} failed=${failed}`);
  console.log("Staff can now sign in with the shared password.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
