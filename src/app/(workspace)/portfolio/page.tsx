import { PortfolioPage } from "@/features/portfolio/portfolio-page";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Portfolio" };

export default function Page() {
  return <PortfolioPage />;
}
