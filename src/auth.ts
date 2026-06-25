import { Account, ApiResponse, AuthTokenData, UserData } from "./types";

export function isTokenValid(token: string | undefined): boolean {
  if (!token) return false;
  try {
    const payload = token.split(".")[1];
    const { exp } = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf-8")
    ) as { exp?: number };
    return !!exp && Date.now() < exp * 1000 - 60_000; // 60s buffer before expiry
  } catch {
    return false;
  }
}

const BASE_URL = "https://customers.docmost.com";

export async function register(account: Account): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: account.name,
      email: account.email,
      password: account.password,
      orgName: account.orgName,
    }),
  });

  const body = await res.text();
  if (!res.ok) throw new Error(`Register failed (${res.status}): ${body}`);

  const json = JSON.parse(body) as ApiResponse<AuthTokenData>;
  return json.data.token;
}

export async function login(email: string, password: string): Promise<string | null> {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const body = await res.text();
  // Return null for auth failures so callers can fall back to register
  if (res.status === 401 || res.status === 404) return null;
  if (!res.ok) throw new Error(`Login failed (${res.status}): ${body}`);

  const json = JSON.parse(body) as ApiResponse<AuthTokenData>;
  return json.data.token;
}

export async function getMe(token: string): Promise<{ userData: UserData; cookie: string }> {
  const res = await fetch(`${BASE_URL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const body = await res.text();
  if (!res.ok) throw new Error(`/me failed (${res.status}): ${body}`);

  // Extract dls_auth cookie set by this endpoint for subsequent org requests
  const setCookie = res.headers.get("set-cookie") ?? "";
  const cookie = setCookie.split(";")[0] ?? "";

  const json = JSON.parse(body) as ApiResponse<UserData>;
  return { userData: json.data, cookie };
}
