import { Reveal } from "@/components/marketing/reveal";
import { Eyebrow, MarketingSection } from "@/components/marketing/section";

const OUTCOMES = [
  "Find areas worth investigating earlier",
  "Stop weak sites when evidence is missing",
  "Compare opportunities on one standard",
  "Keep the decision attached into the Project",
];

export function ValueSection() {
  return (
    <MarketingSection>
      <Reveal>
        <Eyebrow>The problem</Eyebrow>
        <h2 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight sm:text-[40px] sm:leading-[1.15]">
          Weak opportunities survive too long when evidence is hard to compare.
        </h2>
        <p className="mt-5 max-w-2xl text-base leading-7 text-muted">
          Screening notes live in GIS exports, emails and slides. Missing evidence can look like a
          pass. Grid context sits apart from the site itself. The reason a location was kept — or
          should have been stopped — is easy to lose between first look and project development.
        </p>
        <p className="mt-4 max-w-2xl text-base leading-7 text-ink">
          Noxheim keeps geographic screening, evidence coverage and the development record in one
          workspace, so teams spend diligence on sites that still deserve it.
        </p>
      </Reveal>

      <Reveal delay={80}>
        <ul className="mt-12 grid gap-3 sm:grid-cols-2">
          {OUTCOMES.map((label) => (
            <li
              key={label}
              className="rounded-md border border-line bg-surface px-4 py-4 text-sm font-medium leading-6"
            >
              {label}
            </li>
          ))}
        </ul>
      </Reveal>
    </MarketingSection>
  );
}
