import { ProductPreview } from "@/components/marketing/product-preview";
import { Reveal } from "@/components/marketing/reveal";
import { Eyebrow, MarketingSection } from "@/components/marketing/section";

export function ProductPreviewSection() {
  return (
    <MarketingSection className="bg-surface" wide>
      <Reveal>
        <Eyebrow>Sample workspace</Eyebrow>
        <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight sm:text-[40px] sm:leading-[1.15]">
          One workspace from site screening to grid connection.
        </h2>
        <p className="mt-4 max-w-2xl text-base leading-7 text-muted">
          Bring project data, official grid context and development workflow together instead of
          managing each part separately.
        </p>
      </Reveal>
      <Reveal delay={70} className="mt-10">
        <ProductPreview />
      </Reveal>
    </MarketingSection>
  );
}
