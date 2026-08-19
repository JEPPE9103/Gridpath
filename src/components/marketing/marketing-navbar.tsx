"use client";

import { CtaLink } from "@/components/marketing/cta-link";
import { cn } from "@/lib/cn";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

const LINKS = [
  { href: "/#product", label: "Product" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#use-cases", label: "Use cases" },
  { href: "/#why", label: "Why Noxheim" },
];

export function MarketingNavbar() {
  const [compact, setCompact] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.documentElement.classList.add("marketing-scroll");
    const onScroll = () => setCompact(window.scrollY > 18);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      document.documentElement.classList.remove("marketing-scroll");
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 border-b bg-canvas/92 backdrop-blur-sm transition-[padding,border-color] duration-200",
        compact ? "border-line py-2" : "border-transparent py-4",
      )}
    >
      <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-4 px-5 sm:px-8 md:px-10">
        <Link href="/" className="min-w-0" onClick={() => setOpen(false)}>
          <p className="text-[13px] font-semibold tracking-[0.18em]">NOXHEIM</p>
          <p
            className={cn(
              "text-[11px] tracking-wide text-muted transition-all",
              compact ? "hidden sm:block sm:h-0 sm:overflow-hidden sm:opacity-0" : "mt-0.5",
            )}
          >
            Grid Intelligence
          </p>
        </Link>

        <nav className="hidden items-center gap-7 text-sm text-muted lg:flex">
          {LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="hover:text-ink">
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <CtaLink href="/overview" variant="secondary">
            Open demo
          </CtaLink>
          <CtaLink href="/#demo">Book a demo</CtaLink>
        </div>

        <button
          type="button"
          className="rounded-md p-2 text-ink lg:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      {open ? (
        <div className="border-t border-line bg-canvas px-5 py-5 lg:hidden">
          <nav className="flex flex-col gap-3 text-sm">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="py-1 text-ink"
                onClick={() => setOpen(false)}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="mt-5 flex flex-col gap-2">
            <CtaLink href="/overview" variant="secondary" className="w-full">
              Open demo
            </CtaLink>
            <CtaLink href="/#demo" className="w-full">
              Book a demo
            </CtaLink>
          </div>
        </div>
      ) : null}
    </header>
  );
}
