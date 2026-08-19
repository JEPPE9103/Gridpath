import type { Alert } from "@/types";

export const alerts: Alert[] = [
  {
    id: "alert-gavle-headroom",
    severity: "critical",
    title: "Grid capacity data updated — Indicative headroom reduced",
    summary:
      "Vattenfall Eldistribution revised indicative information affecting Gävle BESS.",
    detail:
      "Previous indication: ~25 MW headroom at the Gävle 130 kV node. New indication: ~12 MW. The 20 MW bidirectional request is no longer covered by the public signal. This is indicative information, not an official rejection. Formal grid operator assessment is still required.",
    operator: "Vattenfall Eldistribution",
    projectId: "gavle-bess",
    timestamp: "2026-08-18T09:14:00+02:00",
    ctaLabel: "Review",
    href: "/projects/gavle-bess?tab=grid",
  },
  {
    id: "alert-uppsala-deadline",
    severity: "critical",
    title: "Connection application deadline in 18 days",
    summary: "Svenska kraftnät completeness deadline for Uppsala Wind North is 5 September 2026.",
    detail:
      "Missing: Network Impact Assessment, Landowner Agreement, Environmental Permit. If these are not filed, the application risks being treated as incomplete and delayed to the next window.",
    operator: "Svenska kraftnät",
    projectId: "uppsala-wind-north",
    timestamp: "2026-08-18T08:30:00+02:00",
    ctaLabel: "Review application",
    href: "/projects/uppsala-wind-north?tab=connection",
  },
  {
    id: "alert-gavle-cost",
    severity: "warning",
    title: "Reinforcement cost estimate revised upward +40%",
    summary: "Gävle BESS working assumption increased from SEK 20m to SEK 28m.",
    detail:
      "The figure is an indicative study assumption, not a connection offer. It changes the project’s development case and should be reviewed before further engineering spend.",
    operator: "Vattenfall Eldistribution",
    projectId: "gavle-bess",
    timestamp: "2026-08-17T15:40:00+02:00",
    ctaLabel: "Review",
    href: "/projects/gavle-bess?tab=grid",
  },
  {
    id: "alert-sundsvall-overdue",
    severity: "warning",
    title: "Grid enquiry response overdue from network operator",
    summary: "E.ON Energidistribution has not replied to the Sundsvall Solar enquiry.",
    detail:
      "Enquiry submitted 18 May 2026. Internal 60-day response SLA elapsed on 17 July. No formal reply is on file. Follow-up with the operator is recommended.",
    operator: "E.ON Energidistribution",
    projectId: "sundsvall-solar",
    timestamp: "2026-08-16T08:50:00+02:00",
    ctaLabel: "Review",
    href: "/projects/sundsvall-solar?tab=connection",
  },
  {
    id: "alert-goteborg-study",
    severity: "info",
    title: "Grid study response received",
    summary: "Göteborg Energi issued a preliminary study note for Göteborg EV Hub.",
    detail:
      "The note is an official working document, not a connection offer. The formal study report remains outstanding, with a target of 12 September 2026.",
    operator: "Göteborg Energi",
    projectId: "goteborg-ev",
    timestamp: "2026-08-13T14:25:00+02:00",
    ctaLabel: "Review",
    href: "/projects/goteborg-ev?tab=connection",
  },
  {
    id: "alert-lulea-reinforcement",
    severity: "info",
    title: "Regional reinforcement may improve connection outlook",
    summary: "Vattenfall 400 kV northern programme is relevant to Luleå Wind.",
    detail:
      "This is indicative planning information. It does not create capacity and does not change the current Weak screen. Use it to time a later re-screen, not to justify detailed engineering now.",
    operator: "Vattenfall Eldistribution",
    projectId: "lulea-wind",
    timestamp: "2026-08-15T09:40:00+02:00",
    ctaLabel: "Review",
    href: "/projects/lulea-wind?tab=grid",
  },
  {
    id: "alert-falun-improved",
    severity: "positive",
    title: "Capacity outlook improved for Falun BESS",
    summary: "Updated Vattenfall publication shows additional indicative headroom at Falun 20 kV.",
    detail:
      "Previous indication ~8 MW. New indication ~16 MW, covering the 10 MW bidirectional request. Outlook is now Favourable. This remains indicative until the enquiry is formally answered.",
    operator: "Vattenfall Eldistribution",
    projectId: "falun-bess",
    timestamp: "2026-08-14T12:05:00+02:00",
    ctaLabel: "Review",
    href: "/projects/falun-bess?tab=grid",
  },
];
