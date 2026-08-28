export const SALES_DEMO_ORGANIZATION_ID = "ea5096a9-8da3-42e6-9dbd-64097414cb03";

export const SALES_DEMO_ORGANIZATION_SLUG = "noxheim-demo-development";

export const SALES_DEMO_ORGANIZATION_NAME = "NOXHEIM Demo Development";

/** Exact slugs allowed before/after the one-time rename of the smoke workspace. */
export const SALES_DEMO_ALLOWED_SOURCE_SLUGS = [
  "jeppebattery",
  SALES_DEMO_ORGANIZATION_SLUG,
] as const;

export const SALES_DEMO_HERO_SLUG = "stockholm-north-bess";

export const SALES_DEMO_COMPARE_SLUGS = [
  "uppsala-storage",
  "stockholm-north-bess",
  "gavle-bess",
] as const;

export function isSalesDemoOrganizationSlug(slug: string | null | undefined): boolean {
  return slug === SALES_DEMO_ORGANIZATION_SLUG;
}
