import Link from "next/link";

export function MarketingFooter() {
  return (
    <footer className="border-t border-line bg-canvas">
      <div className="mx-auto grid max-w-[1120px] gap-10 px-5 py-12 sm:px-8 md:grid-cols-[1.3fr_1fr] md:px-10">
        <div>
          <p className="text-[13px] font-semibold tracking-[0.18em]">NOXHEIM</p>
          <p className="mt-3 max-w-sm text-sm leading-6 text-muted">
            Grid Development Intelligence
          </p>
        </div>
        <div className="flex flex-wrap gap-x-8 gap-y-3 text-sm">
          <Link href="/#product" className="text-muted hover:text-ink">
            Product
          </Link>
          <Link href="/about" className="text-muted hover:text-ink">
            About
          </Link>
          <Link href="/privacy" className="text-muted hover:text-ink">
            Privacy
          </Link>
          <Link href="/login" className="text-muted hover:text-ink">
            Sign in
          </Link>
          <Link href="/signup" className="text-muted hover:text-ink">
            Get started
          </Link>
          <Link href="/#demo" className="text-muted hover:text-ink">
            Book a demo
          </Link>
        </div>
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-[1120px] px-5 py-5 text-xs text-muted sm:px-8 md:px-10">
          <p>© 2026 Noxheim</p>
        </div>
      </div>
    </footer>
  );
}
