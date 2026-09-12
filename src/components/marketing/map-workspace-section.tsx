import { AppFrame } from "@/components/marketing/app-frame";
import { DeferredDiscoveryMap } from "@/components/marketing/deferred-discovery-map";
import { Reveal } from "@/components/marketing/reveal";
import { Eyebrow, MarketingSection } from "@/components/marketing/section";

const LAYERS = [
  "Search Areas",
  "Candidate Sites",
  "Opportunities",
  "Projects",
  "Local network · covering",
  "NUP · planning context",
];

export function MapWorkspaceSection() {
  return (
    <MarketingSection wide>
      <Reveal>
        <Eyebrow>Map</Eyebrow>
        <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight sm:text-[36px] sm:leading-[1.15]">
          One spatial workspace from screening to development.
        </h2>
        <p className="mt-4 max-w-xl text-base leading-7 text-muted">
          Search Areas, Candidate Sites, Opportunities, Projects and official Ei covering geography
          sit together on the Map.
        </p>
        <p className="mt-3 max-w-xl text-sm leading-6 text-muted">
          Covering geography is not available capacity. Protection and land-cover evidence sit on
          Evidence Coverage for each Candidate Site — not as extra map layers. Layer availability
          depends on the geography you search.
        </p>
      </Reveal>

      <Reveal delay={70}>
        <ul className="mt-8 flex flex-wrap gap-2">
          {LAYERS.map((layer) => (
            <li
              key={layer}
              className="rounded-md border border-line bg-surface px-3 py-1.5 text-[12px] font-medium"
            >
              {layer}
            </li>
          ))}
        </ul>
      </Reveal>

      <Reveal delay={100} fade>
        <div className="mt-6">
          <AppFrame path="/map">
            <div className="bg-canvas">
              <DeferredDiscoveryMap size="full" variant="workspace" />
              <p className="border-t border-line px-4 py-3 text-[11px] leading-5 text-muted">
                Sample Map. Official Ei covering is geographic context. Candidate Sites, Opportunities
                and Projects share the same workspace.
              </p>
            </div>
          </AppFrame>
        </div>
      </Reveal>
    </MarketingSection>
  );
}
