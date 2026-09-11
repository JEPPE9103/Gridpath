import { Reveal } from "@/components/marketing/reveal";
import { Eyebrow, MarketingSection } from "@/components/marketing/section";

export function DecisionSupportSection() {
  return (
    <MarketingSection>
      <Reveal>
        <Eyebrow>Trust</Eyebrow>
        <h2 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight sm:text-[40px] sm:leading-[1.15]">
          Decision support, not a grid connection guarantee.
        </h2>
        <p className="mt-5 max-w-2xl text-base leading-7 text-muted">
          Noxheim helps development teams find sites worth investigating, see missing evidence, and
          keep that context through connection tracking and official-source review. It does not
          replace formal network-operator assessments, connection studies or binding capacity offers.
          It does not estimate available MW, connection probability, planning approval, or which
          sites deserve capital.
        </p>
      </Reveal>
    </MarketingSection>
  );
}
