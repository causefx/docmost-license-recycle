import { z } from "zod";

const envSchema = z.object({
  ACCOUNTS_FILE: z.string().default("./accounts.json"),
  TARGET_EDITION: z.enum(["enterprise", "business"]).default("enterprise"),
  REFRESH_THRESHOLD_DAYS: z.coerce.number().positive().default(1.5),
  // Required to activate a refreshed license on the local instance
  DOCMOST_LOCAL_URL: z.string().url().optional(),
  DOCMOST_API_KEY: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error("Environment variable validation failed:");
    for (const issue of result.error.issues) {
      console.error(`  ${issue.path.join(".")}: ${issue.message}`);
    }
    process.exit(1);
  }
  return result.data;
}
