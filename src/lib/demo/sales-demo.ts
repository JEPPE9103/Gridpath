export const SALES_DEMO_ORGANIZATION_ID = "ea5096a9-8da3-42e6-9dbd-64097414cb03";

export const SALES_DEMO_ORGANIZATION_SLUG = "noxheim-demo-development";

export const SALES_DEMO_ORGANIZATION_NAME = "Northfield Energy Development AB";

/** Exact slugs allowed before/after the one-time rename of the smoke workspace. */
export const SALES_DEMO_ALLOWED_SOURCE_SLUGS = [
  "jeppebattery",
  SALES_DEMO_ORGANIZATION_SLUG,
] as const;

export const SALES_DEMO_CONFIRM_ENV = "NOXHEIM_CONFIRM_DEMO_RESET";

export const SALES_DEMO_HERO_SLUG = "stockholm-north-bess";

export const SALES_DEMO_PROMOTED_SLUG = "orebro-east-storage";

export const SALES_DEMO_PRIMARY_SEARCH_NAME = "Örebro East BESS";

export const SALES_DEMO_COMPARE_SLUGS = [
  "uppsala-storage",
  "stockholm-north-bess",
  "gavle-bess",
] as const;

export function isSalesDemoOrganizationSlug(slug: string | null | undefined): boolean {
  return slug === SALES_DEMO_ORGANIZATION_SLUG;
}
