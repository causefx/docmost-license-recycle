import "dotenv/config";
import { loadEnv, Env } from "./env";
import { loadAccountsFile, saveAccountsFile } from "./accounts";
import { register, login, getMe, isTokenValid } from "./auth";
import { getTrialSettings, getLicenses, getOrganization, createTrialLicense } from "./licenses";
import { activateLicense, checkApiKey, getLicenseInfo } from "./activate";
import { generateEmail, generateName, generateOrgName, generatePassword } from "./generator";
import { Account, AccountsFile, ActiveLicense, Session, StoredLicense } from "./types";

// ─── Auth ────────────────────────────────────────────────────────────────────

async function authenticate(account: Account, isNew: boolean): Promise<Session> {
  let token: string;

  if (!isNew && isTokenValid(account.token)) {
    console.log(`  Using cached token for ${account.email}`);
    try {
      const { userData, cookie } = await getMe(account.token!);
      const orgId = userData.memberships[0]?.orgId ?? account.orgId;
      if (!orgId) throw new Error(`No org membership for ${account.email}`);
      account.orgId = orgId;
      return { token: account.token!, cookie, orgId };
    } catch {
      console.log(`  Cached token rejected — re-logging in`);
      account.token = undefined;
    }
  }

  const fresh = await login(account.email, account.password);
  if (fresh) {
    console.log(`  Logged in: ${account.email}`);
    token = fresh;
  } else if (isNew) {
    console.log(`  Login failed — registering: ${account.email}`);
    token = await register(account);
  } else {
    throw new Error(`Login failed for ${account.email}`);
  }

  account.token = token;

  const { userData, cookie } = await getMe(token);
  const orgId = userData.memberships[0]?.orgId;
  if (!orgId) throw new Error(`No org membership for ${account.email}`);
  account.orgId = orgId;

  return { token, cookie, orgId };
}

// ─── Sync ────────────────────────────────────────────────────────────────────

async function syncLicenses(file: AccountsFile, targetEdition: string): Promise<void> {
  console.log("\n--- Syncing licenses from remote ---");
  for (const account of file.accounts) {
    try {
      const session = await authenticate(account, false);
      const remote = await getLicenses(session.orgId, session.token, session.cookie);

      account.licenses = remote.map((l): StoredLicense => ({
        licenseKey: l.licenseKey,
        edition: l.edition,
        status: l.status,
        expiresAt: l.expiresAt,
        issuedAt: l.issuedAt,
        trial: l.trial,
      }));

      const active = account.licenses.filter(
        (l) => l.edition === targetEdition && l.trial && l.status === "active"
      );
      const latest = active.sort(
        (a, b) => new Date(b.expiresAt).getTime() - new Date(a.expiresAt).getTime()
      )[0];
      console.log(
        `  ${account.email}: ${active.length} active ${targetEdition} trial(s)` +
        (latest ? ` | latest expires ${latest.expiresAt}` : "")
      );
    } catch (err) {
      console.warn(`  Sync failed for ${account.email}: ${err instanceof Error ? err.message : err}`);
    }
  }
}

// ─── Expiry check ────────────────────────────────────────────────────────────

function needsRefresh(activeLicense: ActiveLicense | undefined, thresholdDays: number): boolean {
  if (!activeLicense) return true;
  const msLeft = new Date(activeLicense.expiresAt).getTime() - Date.now();
  const daysLeft = msLeft / (1000 * 60 * 60 * 24);
  console.log(
    `\nActive license expires ${activeLicense.expiresAt} ` +
    `(${daysLeft.toFixed(2)} days left, threshold: ${thresholdDays}d)`
  );
  return daysLeft <= thresholdDays;
}

// ─── Find reusable stored license ────────────────────────────────────────────

function findStoredActiveLicense(
  file: AccountsFile,
  targetEdition: string,
  thresholdDays: number
): { licenseKey: string; expiresAt: string; accountEmail: string } | null {
  const thresholdMs = thresholdDays * 24 * 60 * 60 * 1000;

  for (const account of file.accounts) {
    const usable = (account.licenses ?? [])
      .filter(
        (l) =>
          l.edition === targetEdition &&
          l.trial &&
          l.status === "active" &&
          new Date(l.expiresAt).getTime() - Date.now() > thresholdMs
      )
      .sort((a, b) => new Date(b.expiresAt).getTime() - new Date(a.expiresAt).getTime());

    if (usable.length > 0) {
      return { licenseKey: usable[0].licenseKey, expiresAt: usable[0].expiresAt, accountEmail: account.email };
    }
  }

  return null;
}

// ─── Find trial slot ─────────────────────────────────────────────────────────

async function findTrialSlot(
  file: AccountsFile,
  targetEdition: string
): Promise<{ session: Session; account: Account; isNew: boolean }> {
  for (const account of file.accounts) {
    try {
      const session = await authenticate(account, false);
      const [settings, org] = await Promise.all([
        getTrialSettings(session.orgId, session.token, session.cookie),
        getOrganization(session.orgId, session.token, session.cookie),
      ]);
      const setting = settings.find((s) => s.edition === targetEdition && s.enabled);
      if (!setting) continue;

      // Use org.trialsUsed — counts all trials ever created, not just active ones
      const remaining = setting.maxTrialsPerOrg - org.trialsUsed;

      console.log(
        `  ${account.email}: ${org.trialsUsed}/${setting.maxTrialsPerOrg} trials used` +
        ` (${remaining} remaining)`
      );

      if (remaining > 0) return { session, account, isNew: false };
    } catch (err) {
      console.warn(`  Skipping ${account.email}: ${err instanceof Error ? err.message : err}`);
    }
  }

  // All accounts exhausted — generate a fresh one
  const newAccount: Account = {
    name: generateName(),
    email: generateEmail(),
    password: generatePassword(),
    orgName: generateOrgName(),
  };

  console.log(`\nAll accounts exhausted — registering new: ${newAccount.email}`);
  const session = await authenticate(newAccount, true);
  return { session, account: newAccount, isNew: true };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const env: Env = loadEnv();
  const file = await loadAccountsFile(env.ACCOUNTS_FILE);

  console.log(`Accounts: ${file.accounts.length} | Edition: ${env.TARGET_EDITION} | Threshold: ${env.REFRESH_THRESHOLD_DAYS}d`);

  // 0. Pre-check: verify the local API key works before doing anything else
  if (env.DOCMOST_API_KEY) {
    console.log("\n--- Pre-check: validating DOCMOST_API_KEY ---");
    if (env.DOCMOST_LOCAL_URL) {
      await checkApiKey(env.DOCMOST_LOCAL_URL, env.DOCMOST_API_KEY);
    } else {
      console.warn("  DOCMOST_API_KEY is set but DOCMOST_LOCAL_URL is not — skipping API key check");
    }
  }

  // 1. Sync all account licenses from remote
  await syncLicenses(file, env.TARGET_EDITION);
  await saveAccountsFile(env.ACCOUNTS_FILE, file);

  // 2. Check if active license needs refreshing
  //    Prefer live data from the local instance; fall back to accounts.json
  let refreshReason: string | null = null;

  if (env.DOCMOST_LOCAL_URL && env.DOCMOST_API_KEY) {
    console.log("\n--- Checking live license on local instance ---");
    const liveInfo = await getLicenseInfo(env.DOCMOST_LOCAL_URL, env.DOCMOST_API_KEY);

    if (liveInfo?.noLicense) {
      refreshReason = "no license active on local instance";
    } else if (liveInfo?.expiresAt) {
      const msLeft = new Date(liveInfo.expiresAt).getTime() - Date.now();
      const daysLeft = msLeft / (1000 * 60 * 60 * 24);
      console.log(
        `  Live license: edition=${liveInfo.licenseType ?? liveInfo.edition ?? "unknown"}` +
        ` | expires=${liveInfo.expiresAt} (${daysLeft.toFixed(2)} days left)`
      );

      // Sync live data back into activeLicense so accounts.json stays accurate
      if (file.activeLicense) {
        file.activeLicense.expiresAt = liveInfo.expiresAt;
        if (liveInfo.licenseKey) file.activeLicense.licenseKey = liveInfo.licenseKey;
        const editionValue = liveInfo.licenseType ?? liveInfo.edition;
        if (editionValue) file.activeLicense.edition = editionValue;
      }

      if (daysLeft <= env.REFRESH_THRESHOLD_DAYS) {
        refreshReason = `live license expires in ${daysLeft.toFixed(2)} days (threshold: ${env.REFRESH_THRESHOLD_DAYS}d)`;
      }
    } else {
      console.log("  No license info returned from local instance — checking stored record");
      if (needsRefresh(file.activeLicense, env.REFRESH_THRESHOLD_DAYS)) {
        refreshReason = "stored license missing or expiring soon";
      }
    }
  } else {
    console.log("\n(DOCMOST_LOCAL_URL/DOCMOST_API_KEY not set — checking stored license only)");
    if (needsRefresh(file.activeLicense, env.REFRESH_THRESHOLD_DAYS)) {
      refreshReason = "stored license missing or expiring soon";
    }
  }

  if (!refreshReason) {
    console.log("License is valid — no refresh needed.");
    await saveAccountsFile(env.ACCOUNTS_FILE, file); // persist any live sync updates
    return;
  }

  console.log(`\nRefresh required: ${refreshReason}`);

  // 3. Pre-flight: local API config must be present before doing any work
  if (!env.DOCMOST_LOCAL_URL || !env.DOCMOST_API_KEY) {
    console.error(
      "\nDOCMOST_LOCAL_URL and DOCMOST_API_KEY are required to activate a license.\n" +
      "Add them to your .env and re-run."
    );
    process.exit(1);
  }

  // 4. Check accounts.json for an existing usable license before creating a new one
  const reusable = findStoredActiveLicense(file, env.TARGET_EDITION, env.REFRESH_THRESHOLD_DAYS);
  if (reusable) {
    console.log(`\nFound existing valid license from ${reusable.accountEmail} (expires ${reusable.expiresAt})`);
    console.log(`Activating on ${env.DOCMOST_LOCAL_URL}...`);
    try {
      await activateLicense(env.DOCMOST_LOCAL_URL, env.DOCMOST_API_KEY, reusable.licenseKey);
    } catch (err) {
      console.error(`  Activation failed: ${err instanceof Error ? err.message : err}`);
      console.warn("  Will retry on next run.");
    }

    file.activeLicense = {
      ...(file.activeLicense ?? {}),
      licenseKey: reusable.licenseKey,
      expiresAt: reusable.expiresAt,
      activatedAt: new Date().toISOString(),
      accountEmail: reusable.accountEmail,
      edition: env.TARGET_EDITION,
      issuedAt: file.activeLicense?.issuedAt ?? new Date().toISOString(),
    };
    await saveAccountsFile(env.ACCOUNTS_FILE, file);
    console.log("Done — existing license re-activated.");
    return;
  }

  // 5. No usable stored license — find a trial slot and create a new one
  console.log("\n--- No reusable license found — finding available trial slot ---");
  const { session, account, isNew } = await findTrialSlot(file, env.TARGET_EDITION);

  const settings = await getTrialSettings(session.orgId, session.token, session.cookie);
  const setting = settings.find((s) => s.edition === env.TARGET_EDITION && s.enabled);
  if (!setting) throw new Error(`No enabled trial setting for "${env.TARGET_EDITION}"`);

  console.log(`\nCreating ${env.TARGET_EDITION} trial license for ${account.email}...`);
  const newLicense = await createTrialLicense(
    session.orgId, setting.id, setting.edition, session.token, session.cookie
  );

  // 6. Activate on local instance
  console.log(`Activating on ${env.DOCMOST_LOCAL_URL}...`);
  try {
    await activateLicense(env.DOCMOST_LOCAL_URL, env.DOCMOST_API_KEY, newLicense.licenseKey);
  } catch (err) {
    console.error(`  Activation failed: ${err instanceof Error ? err.message : err}`);
    console.warn("  License was created remotely and saved to accounts.json — activation will be retried on next run.");
  }

  // 7. Persist to accounts.json
  if (isNew) file.accounts.push(account);

  const stored: StoredLicense = {
    licenseKey: newLicense.licenseKey,
    edition: newLicense.edition,
    status: newLicense.status,
    expiresAt: newLicense.expiresAt,
    issuedAt: newLicense.issuedAt,
    trial: newLicense.trial,
  };
  const entry = file.accounts.find((a) => a.email === account.email);
  if (entry) entry.licenses = [...(entry.licenses ?? []), stored];

  file.activeLicense = {
    licenseKey: newLicense.licenseKey,
    edition: newLicense.edition,
    expiresAt: newLicense.expiresAt,
    issuedAt: newLicense.issuedAt,
    activatedAt: new Date().toISOString(),
    accountEmail: account.email,
  };

  await saveAccountsFile(env.ACCOUNTS_FILE, file);
  console.log(`Saved to ${env.ACCOUNTS_FILE}`);

  console.log("\n========== LICENSE ACTIVATED ==========");
  console.log(`Account:  ${account.email}`);
  console.log(`Edition:  ${newLicense.edition}`);
  console.log(`Issued:   ${newLicense.issuedAt}`);
  console.log(`Expires:  ${newLicense.expiresAt}`);
  console.log(`Key:\n${newLicense.licenseKey}`);
  console.log("=======================================");
}

main().catch((err) => {
  console.error("\nFatal:", err instanceof Error ? err.message : err);
  process.exit(1);
});
