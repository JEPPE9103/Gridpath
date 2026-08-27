import Link from "next/link";

export function MarketingFooter() {
  return (
    <footer className="border-t border-line bg-canvas">
      <div className="mx-auto grid max-w-[1120px] gap-10 px-5 py-12 sm:px-8 md:grid-cols-[1.3fr_1fr] md:px-10">
        <div>
          <p className="text-[13px] font-semibold tracking-[0.18em]">NOXHEIM</p>
          <p className="mt-3 max-w-sm text-sm leading-6 text-muted">
            Official Swedish grid context for energy development portfolios.
          </p>
        </div>
        <div className="flex flex-wrap gap-x-8 gap-y-3 text-sm">
          <Link href="/#product" className="text-muted hover:text-ink">
            Product
          </Link>
          <Link href="/#use-cases" className="text-muted hover:text-ink">
            Use cases
          </Link>
          <Link href="/about" className="text-muted hover:text-ink">
            About
          </Link>
          <Link href="/privacy" className="text-muted hover:text-ink">
            Privacy
          </Link>
          <Link href="/#demo" className="text-muted hover:text-ink">
            Contact
          </Link>
        </div>
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-[1120px] flex-col gap-2 px-5 py-5 text-xs text-muted sm:px-8 md:flex-row md:items-center md:justify-between md:px-10">
          <p>Indicative grid intelligence only. Formal grid operator assessment required.</p>
          <p>© 2026 NOXHEIM</p>
        </div>
      </div>
    </footer>
  );
}
