export interface Account {
  name: string;
  email: string;
  password: string;
  orgName: string;
  token?: string;
  orgId?: string;
  licenses?: StoredLicense[];
}

export interface StoredLicense {
  licenseKey: string;
  edition: string;
  status: string;
  expiresAt: string;
  issuedAt: string;
  trial: boolean;
}

export interface ActiveLicense {
  licenseKey: string;
  edition: string;
  expiresAt: string;
  issuedAt: string;
  activatedAt: string;
  accountEmail: string;
}

export interface AccountsFile {
  accounts: Account[];
  activeLicense?: ActiveLicense;
}

export interface ApiResponse<T> {
  data: T;
  success: boolean;
  status: number;
}

export interface AuthTokenData {
  token: string;
}

export interface UserData {
  user: { id: string; email: string; name: string; role: string };
  memberships: Array<{ id: string; orgId: string; role: string }>;
}

export interface TrialSetting {
  id: string;
  edition: string;
  durationDays: number;
  maxSeats: number;
  maxTrialsPerOrg: number;
  enabled: boolean;
}

export interface OrgData {
  id: string;
  name: string;
  trialsUsed: number;
}

export interface LicenseData {
  id: string;
  licenseKey: string;
  licenseType: string;
  edition: string;
  status: string;
  expiresAt: string;
  issuedAt: string;
  trial: boolean;
  orgId: string;
}

export interface Session {
  token: string;
  cookie: string;
  orgId: string;
}
