import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { MarketingNavbar } from "@/components/marketing/marketing-navbar";
import type { ReactNode } from "react";

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen overflow-x-clip bg-canvas text-[15px] text-ink">
      <MarketingNavbar />
      {children}
      <MarketingFooter />
    </div>
  );
}
