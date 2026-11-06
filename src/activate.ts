export interface LocalLicenseInfo {
  licenseKey?: string;
  licenseType?: string;
  edition?: string;
  expiresAt?: string;
  issuedAt?: string;
  seats?: number;
  trial?: boolean;
  status?: string;
  noLicense?: boolean;
}

export async function checkApiKey(localUrl: string, apiKey: string): Promise<boolean> {
  const url = `${localUrl.replace(/\/$/, "")}/api/users/me`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });
    const body = await res.text();
    if (!res.ok) {
      console.error(`  API key check FAILED (${res.status} ${res.statusText}): ${body.slice(0, 500)}`);
      return false;
    }
    let who = "";
    try {
      const json = JSON.parse(body);
      const user = json.data?.user ?? json.user;
      if (user?.email) who = ` — authenticated as ${user.email}`;
    } catch {
      // non-JSON success body; status code is enough
    }
    console.log(`  API key check OK (${res.status})${who}`);
    return true;
  } catch (err) {
    console.error(`  API key check FAILED — could not reach ${url}: ${err instanceof Error ? err.message : err}`);
    return false;
  }
}

export async function getLicenseInfo(localUrl: string, apiKey: string): Promise<LocalLicenseInfo | null> {
  const url = `${localUrl.replace(/\/$/, "")}/api/license/info`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });
    const body = await res.text();
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      console.warn(`  /api/license/info returned non-JSON (${res.status}) — falling back to stored license`);
      return null;
    }
    if (!res.ok) {
      const json = JSON.parse(body) as { message?: string };
      if (res.status === 400 && json.message === "No license key found.") {
        console.warn("  No license active on local instance — will activate one");
        return { noLicense: true };
      }
      console.warn(`  /api/license/info returned ${res.status} — falling back to stored license`);
      return null;
    }
    const json = JSON.parse(body);
    // Handle both { data: {...} } and flat response shapes
    return (json.data ?? json) as LocalLicenseInfo;
  } catch (err) {
    console.warn(`  Could not reach local instance for license info: ${err instanceof Error ? err.message : err}`);
    return null;
  }
}

export async function activateLicense(localUrl: string, apiKey: string, licenseKey: string): Promise<void> {
  const url = `${localUrl.replace(/\/$/, "")}/api/license/activate`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ licenseKey }),
  });

  const body = await res.text();
  if (!res.ok) throw new Error(`Local activation failed (${res.status}): ${body}`);
  console.log(`  Activated on local instance (${res.status})`);
}
