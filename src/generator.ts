import { faker } from "@faker-js/faker";

const EMAIL_DOMAINS = [
  "gmail.com",
  "yahoo.com",
  "hotmail.com",
  "outlook.com",
  "me.com",
  "icloud.com",
  "msn.com",
  "live.com",
  "aol.com",
  "protonmail.com",
  "mail.com",
  "ymail.com",
  "comcast.net",
  "sbcglobal.net",
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ~40% chance of appending 1–4 random digits
function maybeDigits(): string {
  if (Math.random() > 0.4) return "";
  const len = Math.floor(Math.random() * 4) + 1;
  return String(Math.floor(Math.random() * Math.pow(10, len))).padStart(len, "0");
}

export function generateEmail(): string {
  const first = faker.person.firstName().toLowerCase().replace(/[^a-z]/g, "");
  const last = faker.person.lastName().toLowerCase().replace(/[^a-z]/g, "");
  const num = maybeDigits();
  const domain = pick(EMAIL_DOMAINS);

  const patterns = [
    () => `${first}.${last}${num}`,
    () => `${first}${last}${num}`,
    () => `${first}_${last}${num}`,
    () => `${first}${num}`,
    () => `${first[0]}${last}${num}`,
  ];

  const username = pick(patterns)();
  return `${username}@${domain}`;
}

export function generateName(): string {
  return faker.person.fullName();
}

export function generateOrgName(): string {
  const patterns = [
    () => faker.company.name(),
    () => `${faker.person.lastName()} ${faker.word.noun()}`,
    () => `${faker.word.adjective()} ${faker.word.noun()}`,
    () => faker.word.words(2),
  ];
  return pick(patterns)();
}

export function generatePassword(): string {
  const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lower = "abcdefghijklmnopqrstuvwxyz";
  const digits = "0123456789";
  const special = "!@#$%&*";
  const all = upper + lower + digits + special;

  const length = 12 + Math.floor(Math.random() * 5); // 12–16 chars

  // Guarantee at least one of each category
  const chars = [
    pick([...upper]),
    pick([...lower]),
    pick([...digits]),
    pick([...special]),
  ];

  for (let i = chars.length; i < length; i++) {
    chars.push(all[Math.floor(Math.random() * all.length)]);
  }

  // Fisher-Yates shuffle
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join("");
}
