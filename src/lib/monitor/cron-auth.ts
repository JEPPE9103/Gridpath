import { timingSafeEqual } from "node:crypto";

export function authorizeCronRequest(request: Request, secret = process.env.CRON_SECRET): boolean {
  const expected = secret?.trim() ?? "";
  if (!expected) {
    return false;
  }

  const header = request.headers.get("authorization") ?? "";
  const bearer = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  const alt = (request.headers.get("x-cron-secret") ?? "").trim();

  return secretsEqual(bearer, expected) || secretsEqual(alt, expected);
}

export function secretsEqual(provided: string, expected: string): boolean {
  if (!provided || !expected) {
    return false;
  }
  const left = Buffer.from(provided);
  const right = Buffer.from(expected);
  if (left.length !== right.length) {
    return false;
  }
  return timingSafeEqual(left, right);
}
