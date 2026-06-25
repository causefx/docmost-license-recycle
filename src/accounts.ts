import fs from "fs/promises";
import { Account, AccountsFile } from "./types";

export async function loadAccountsFile(filePath: string): Promise<AccountsFile> {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    const parsed = JSON.parse(content);
    // Migrate from old flat array format
    if (Array.isArray(parsed)) {
      return { accounts: parsed as Account[] };
    }
    return parsed as AccountsFile;
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return { accounts: [] };
    throw err;
  }
}

export async function saveAccountsFile(filePath: string, data: AccountsFile): Promise<void> {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
}

