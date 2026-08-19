import type { GridChange } from "@/types";

export const changes: GridChange[] = [
  {
    id: "chg-vf-capacity",
    source: "Vattenfall Eldistribution",
    detectedAt: "2026-08-18T09:14:00+02:00",
    type: "Capacity",
    title: "Vattenfall capacity publication updated",
    summary:
      "Public hosting-capacity map refreshed for Gävleborg and Dalarna. Gävle 130 kV headroom reduced; Falun 20 kV headroom increased. Figures are indicative.",
    affectedProjectIds: ["gavle-bess", "falun-bess"],
  },
  {
    id: "chg-elv-guidance",
    source: "Ellevio",
    detectedAt: "2026-08-15T11:20:00+02:00",
    type: "Requirements",
    title: "Ellevio connection guidance changed",
    summary:
      "Updated completeness checklist for 70 kV applications. Protection coordination note is now required before study kickoff.",
    affectedProjectIds: ["vasteras-storage"],
  },
  {
    id: "chg-vf-reinf",
    source: "Vattenfall Eldistribution",
    detectedAt: "2026-08-17T15:40:00+02:00",
    type: "Reinforcement",
    title: "Reinforcement timeline and cost assumptions changed",
    summary:
      "Gävle area 130 kV programme working cost increased +40%. Northern 400 kV programme still described as 2031–2033 for material local effect.",
    affectedProjectIds: ["gavle-bess", "lulea-wind"],
  },
  {
    id: "chg-study-req",
    source: "Vattenfall Eldistribution",
    detectedAt: "2026-08-12T10:00:00+02:00",
    type: "Requirements",
    title: "Grid study requirement changed",
    summary:
      "Study data packs for storage must now include a 15-minute import/export envelope for winter peak. Affects open studies and late-stage screens.",
    affectedProjectIds: ["gavle-bess", "orebro-bess", "malmo-bess"],
  },
  {
    id: "chg-falun-cap",
    source: "Vattenfall Eldistribution",
    detectedAt: "2026-08-14T12:05:00+02:00",
    type: "Capacity",
    title: "New capacity information published — Falun 20 kV",
    summary:
      "Updated bus-level indicative headroom at Falun. Covers the 10 MW bidirectional request on current public information.",
    affectedProjectIds: ["falun-bess"],
  },
  {
    id: "chg-svk-deadline",
    source: "Svenska kraftnät",
    detectedAt: "2026-08-18T08:30:00+02:00",
    type: "Deadlines",
    title: "Application completeness deadline approaching",
    summary:
      "SVK-APP-2026-0044 must be complete by 5 September 2026. Missing NIA, landowner agreement and environmental permit.",
    affectedProjectIds: ["uppsala-wind-north"],
  },
  {
    id: "chg-eon-sla",
    source: "E.ON Energidistribution",
    detectedAt: "2026-08-16T08:50:00+02:00",
    type: "Operator updates",
    title: "E.ON enquiry handling update",
    summary:
      "No change to published SLAs, but the Sundsvall enquiry has exceeded the 60-day internal tracking target. Malmö and Örebro are not yet in enquiry.",
    affectedProjectIds: ["sundsvall-solar"],
  },
  {
    id: "chg-ge-note",
    source: "Göteborg Energi",
    detectedAt: "2026-08-13T14:25:00+02:00",
    type: "Operator updates",
    title: "Preliminary grid study note issued",
    summary:
      "Working note received for the 12 MW EV hub. Formal report still outstanding.",
    affectedProjectIds: ["goteborg-ev"],
  },
  {
    id: "chg-north-400",
    source: "Svenska kraftnät",
    detectedAt: "2026-08-12T16:00:00+02:00",
    type: "Reinforcement",
    title: "Northern 400 kV programme update",
    summary:
      "Planning document restates earliest material effect in Norrbotten in the early 2030s. Relevant to Luleå Wind and Kiruna Industrial Park as context, not as contracted capacity.",
    affectedProjectIds: ["lulea-wind", "kiruna-industrial"],
  },
];
