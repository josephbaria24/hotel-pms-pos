export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function usernameFromEmail(email: string) {
  return (email.split("@")[0] ?? "user")
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .slice(0, 40);
}

export function fullNameFromEmail(email: string) {
  const local = email.split("@")[0] ?? "User";
  const words = local
    .replace(/[._-]+/g, " ")
    .replace(/\d+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
  if (!words) return local;
  return words.replace(/\b\w/g, (c) => c.toUpperCase());
}

export type BulkUserEntry = {
  email: string;
  password: string;
  fullName: string;
  username: string;
};

export type BulkParseResult = {
  entries: BulkUserEntry[];
  errors: string[];
};

function uniqueEmails(emails: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const email of emails) {
    if (seen.has(email)) continue;
    seen.add(email);
    out.push(email);
  }
  return out;
}

export function parseBulkUserPaste(
  raw: string,
  opts: { samePassword: boolean; password: string },
): BulkParseResult {
  const errors: string[] = [];
  const shared = opts.password.trim();

  if (opts.samePassword) {
    if (shared.length < 6) {
      return {
        entries: [],
        errors: raw.trim()
          ? ["Password must be at least 6 characters."]
          : [],
      };
    }
    const tokens = raw
      .split(/[\s,;]+/)
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);
    const emails: string[] = [];
    for (const token of tokens) {
      if (EMAIL_RE.test(token)) emails.push(token);
      else if (token.includes("@")) errors.push(`Invalid email: ${token}`);
    }
    const unique = uniqueEmails(emails);
    if (unique.length > 80) {
      errors.push("You can add at most 80 users at a time. Extra emails were skipped.");
    }
    const entries = unique.slice(0, 80).map((email) => ({
      email,
      password: shared,
      fullName: fullNameFromEmail(email),
      username: usernameFromEmail(email),
    }));
    return { entries, errors };
  }

  const entries: BulkUserEntry[] = [];
  const seen = new Set<string>();
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    let email = "";
    let password = "";
    if (/[,\t;]/.test(trimmed)) {
      const parts = trimmed.split(/[,\t;]/).map((p) => p.trim());
      email = (parts[0] ?? "").toLowerCase();
      password = parts.slice(1).join(" ").trim();
    } else {
      const parts = trimmed.split(/\s+/);
      email = (parts[0] ?? "").toLowerCase();
      password = parts.slice(1).join(" ").trim();
    }

    if (!EMAIL_RE.test(email)) {
      errors.push(`Invalid email: ${trimmed}`);
      continue;
    }
    if (seen.has(email)) continue;
    seen.add(email);
    const resolvedPassword = password || shared;
    if (resolvedPassword.length < 6) {
      errors.push(`${email}: password must be at least 6 characters.`);
      continue;
    }
    entries.push({
      email,
      password: resolvedPassword,
      fullName: fullNameFromEmail(email),
      username: usernameFromEmail(email),
    });
  }

  return { entries, errors };
}
