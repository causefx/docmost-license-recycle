import { ApiResponse, LicenseData, OrgData, TrialSetting } from "./types";

const BASE_URL = "https://customers.docmost.com";

function headers(token: string, cookie: string): Record<string, string> {
  const h: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
  if (cookie) h["Cookie"] = cookie;
  return h;
}

export async function getTrialSettings(orgId: string, token: string, cookie: string): Promise<TrialSetting[]> {
  const res = await fetch(`${BASE_URL}/api/organizations/${orgId}/licenses/trial-settings`, {
    headers: headers(token, cookie),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`trial-settings failed (${res.status}): ${body}`);
  const json = JSON.parse(body) as ApiResponse<TrialSetting[]>;
  return json.data;
}

export async function getOrganization(orgId: string, token: string, cookie: string): Promise<OrgData> {
  const res = await fetch(`${BASE_URL}/api/organizations/${orgId}`, {
    headers: headers(token, cookie),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`get org failed (${res.status}): ${body}`);
  const json = JSON.parse(body) as ApiResponse<OrgData>;
  return json.data;
}

export async function getLicenses(orgId: string, token: string, cookie: string): Promise<LicenseData[]> {
  const res = await fetch(`${BASE_URL}/api/organizations/${orgId}/licenses`, {
    headers: headers(token, cookie),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`get licenses failed (${res.status}): ${body}`);
  const json = JSON.parse(body) as ApiResponse<LicenseData[]>;
  return json.data;
}

export async function createTrialLicense(
  orgId: string,
  trialSettingId: string,
  edition: string,
  token: string,
  cookie: string
): Promise<LicenseData> {
  const res = await fetch(`${BASE_URL}/api/organizations/${orgId}/licenses/trial`, {
    method: "POST",
    headers: headers(token, cookie),
    body: JSON.stringify({ trialSettingId, edition }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`create trial license failed (${res.status}): ${body}`);
  const json = JSON.parse(body) as ApiResponse<LicenseData>;
  return json.data;
}
