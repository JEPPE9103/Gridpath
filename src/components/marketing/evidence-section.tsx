import { AppFrame } from "@/components/marketing/app-frame";
import { EvidenceStateMark, ProvenanceChip } from "@/components/marketing/provenance-chips";
import { Reveal } from "@/components/marketing/reveal";
import { Eyebrow, MarketingSection } from "@/components/marketing/section";
import { provenanceCustomerLabel } from "@/lib/opportunities/evidence-coverage";
import { SAMPLE_EVIDENCE_COVERAGE, SAMPLE_SELECTED_CANDIDATE } from "@/lib/demo/sample-discovery-preview";

const FENCES = [
  {
    title: "Screening ≠ engineering feasibility",
    copy: "A Candidate Site is an investigation target. It is not a load-flow study or a constructability verdict.",
  },
  {
    title: "Ranking ≠ official verdict",
    copy: "Investigation priority is Noxheim derived from evaluated evidence. Authorities do not rank these sites.",
  },
  {
    title: "Network covering ≠ available capacity",
    copy: "Official Ei geography shows which network area covers a location. It does not show available MW or a connection offer.",
  },
];

export function EvidenceSection() {
  return (
    <MarketingSection id="evidence">
      <div className="grid items-start gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <Reveal>
          <Eyebrow>Understand</Eyebrow>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-[36px] sm:leading-[1.15]">
            Noxheim does not hide missing evidence.
          </h2>
          <p className="mt-4 max-w-md text-base leading-7 text-muted">
            Every Candidate Site shows what was evaluated and what was not. Official Source,
            Customer Entered and Noxheim Derived stay labelled. Missing evidence is not treated as a
            pass.
          </p>
          <p className="mt-4 max-w-md text-sm leading-6 text-muted">
            {SAMPLE_SELECTED_CANDIDATE.name} in this sample has {SAMPLE_EVIDENCE_COVERAGE.summary}.
            Road access and detailed terrain remain not evaluated.
          </p>
        </Reveal>
        <Reveal delay={80} fade>
          <AppFrame path="/opportunities">
            <div className="bg-canvas p-4 sm:p-5">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-[11px] uppercase tracking-wide text-muted">
                  Evidence Coverage · {SAMPLE_SELECTED_CANDIDATE.name}
                </p>
                <span className="rounded-full bg-canvas px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted">
                  Sample
                </span>
              </div>
              <MarketingEvidenceCoverage />
            </div>
          </AppFrame>
        </Reveal>
      </div>

      <Reveal delay={60}>
        <div className="mt-12 grid gap-3 md:grid-cols-3">
          {FENCES.map((item) => (
            <article key={item.title} className="rounded-md border border-line bg-surface px-4 py-5">
              <h3 className="text-sm font-semibold leading-6">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted">{item.copy}</p>
            </article>
          ))}
        </div>
      </Reveal>
    </MarketingSection>
  );
}

function MarketingEvidenceCoverage() {
  return (
    <div className="rounded-md border border-line bg-surface p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-semibold">Evidence Coverage</p>
        <p className="text-xs text-muted">{SAMPLE_EVIDENCE_COVERAGE.summary}</p>
      </div>
      <ul className="mt-3 space-y-2">
        {SAMPLE_EVIDENCE_COVERAGE.items.map((item) => {
          const provenance = provenanceCustomerLabel(item.provenance);
          return (
            <li key={item.id}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="mt-0.5 text-xs text-muted">{item.summary}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {provenance ? <ProvenanceChip label={provenance} /> : null}
                  <EvidenceStateMark state={item.state} />
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
