function splitList(value: string | undefined): string[] {
  return (value ?? "")
    .split(/[,\s]+/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

export function operatorEmailsFromEnv(env = process.env): string[] {
  return splitList(env.OPERATOR_EMAILS);
}

export function operatorUserIdsFromEnv(env = process.env): string[] {
  return splitList(env.OPERATOR_USER_IDS);
}

export function isNoxheimOperator(input: {
  email?: string | null;
  userId?: string | null;
  env?: NodeJS.ProcessEnv;
}): boolean {
  const env = input.env ?? process.env;
  const emails = operatorEmailsFromEnv(env);
  const ids = operatorUserIdsFromEnv(env);
  if (emails.length === 0 && ids.length === 0) {
    return false;
  }
  const email = input.email?.trim().toLowerCase() ?? "";
  const userId = input.userId?.trim().toLowerCase() ?? "";
  if (email && emails.includes(email)) {
    return true;
  }
  if (userId && ids.includes(userId)) {
    return true;
  }
  return false;
}
