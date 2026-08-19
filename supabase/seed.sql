-- NOXHEIM DEVELOPMENT SEED DATA
-- All project, capacity, reinforcement, cost, deadline and grid information
-- is fictional and illustrative.
-- It must never be treated as current grid information.
-- Operator names are used only as fictional counterparties in this demo dataset.
-- This seed does not contain, and must not be read as, data supplied by
-- Vattenfall, Ellevio, E.ON, Svenska kraftnät or Göteborg Energi.

-- Deterministic IDs (local development only).
-- Organization
--   a0000000-0000-4000-8000-000000000001  NorthGrid Development AB
-- Grid operators
--   ...000011  Vattenfall Eldistribution
--   ...000012  Ellevio
--   ...000013  E.ON Energidistribution
--   ...000014  Svenska kraftnät
--   ...000015  Göteborg Energi
-- Projects  ...000101–000111
-- Sites     ...000201–000211

insert into public.grid_operators (id, name, country_code) values
  ('a0000000-0000-4000-8000-000000000011', 'Vattenfall Eldistribution', 'SE'),
  ('a0000000-0000-4000-8000-000000000012', 'Ellevio', 'SE'),
  ('a0000000-0000-4000-8000-000000000013', 'E.ON Energidistribution', 'SE'),
  ('a0000000-0000-4000-8000-000000000014', 'Svenska kraftnät', 'SE'),
  ('a0000000-0000-4000-8000-000000000015', 'Göteborg Energi', 'SE');

insert into public.organizations (id, name, slug) values
  (
    'a0000000-0000-4000-8000-000000000001',
    'NorthGrid Development AB',
    'northgrid-development-ab'
  );

insert into public.projects (
  id,
  organization_id,
  grid_operator_id,
  name,
  slug,
  location,
  region,
  technology,
  import_mw,
  export_mw,
  voltage_level,
  connection_stage,
  connection_outlook,
  confidence,
  target_cod,
  description
) values
  (
    'a0000000-0000-4000-8000-000000000101',
    'a0000000-0000-4000-8000-000000000001',
    'a0000000-0000-4000-8000-000000000011',
    'Gävle BESS',
    'gavle-bess',
    'Gävle',
    'Gävleborg',
    'battery_storage',
    20,
    20,
    '130 kV',
    'grid_study',
    'at_risk',
    'high',
    'Q3 2029',
    'Fictional 20 MW / 20 MW battery storage project used for local development. Illustrative grid-study example only.'
  ),
  (
    'a0000000-0000-4000-8000-000000000102',
    'a0000000-0000-4000-8000-000000000001',
    'a0000000-0000-4000-8000-000000000012',
    'Västerås Storage',
    'vasteras-storage',
    'Västerås',
    'Västmanland',
    'battery_storage',
    30,
    30,
    '70 kV',
    'application',
    'favourable',
    'high',
    'Q2 2028',
    'Fictional 30 MW / 30 MW battery storage project used for local development. Illustrative application-stage example only.'
  ),
  (
    'a0000000-0000-4000-8000-000000000103',
    'a0000000-0000-4000-8000-000000000001',
    'a0000000-0000-4000-8000-000000000013',
    'Sundsvall Solar',
    'sundsvall-solar',
    'Sundsvall',
    'Västernorrland',
    'solar',
    0,
    80,
    '130 kV',
    'enquiry',
    'possible',
    'medium',
    'Q2 2030',
    'Fictional 80 MW solar project used for local development. Illustrative enquiry-stage example only.'
  ),
  (
    'a0000000-0000-4000-8000-000000000104',
    'a0000000-0000-4000-8000-000000000001',
    'a0000000-0000-4000-8000-000000000014',
    'Uppsala Wind North',
    'uppsala-wind-north',
    'Tierp / Uppsala N',
    'Uppsala',
    'wind',
    0,
    120,
    '220 kV',
    'application',
    'at_risk',
    'medium',
    'Q4 2031',
    'Fictional 120 MW wind project used for local development. Demo “needs attention” is represented as connection_outlook = at_risk.'
  ),
  (
    'a0000000-0000-4000-8000-000000000105',
    'a0000000-0000-4000-8000-000000000001',
    'a0000000-0000-4000-8000-000000000013',
    'Örebro BESS',
    'orebro-bess',
    'Örebro',
    'Örebro',
    'battery_storage',
    15,
    15,
    '40 kV',
    'screened',
    'possible',
    'medium',
    'Q1 2029',
    'Fictional 15 MW / 15 MW battery storage project used for local development. Illustrative screened-stage example only.'
  ),
  (
    'a0000000-0000-4000-8000-000000000106',
    'a0000000-0000-4000-8000-000000000001',
    'a0000000-0000-4000-8000-000000000011',
    'Falun BESS',
    'falun-bess',
    'Falun',
    'Dalarna',
    'battery_storage',
    10,
    10,
    '20 kV',
    'enquiry',
    'favourable',
    'high',
    'Q4 2028',
    'Fictional 10 MW / 10 MW battery storage project used for local development. Illustrative favourable-enquiry example only.'
  ),
  (
    'a0000000-0000-4000-8000-000000000107',
    'a0000000-0000-4000-8000-000000000001',
    'a0000000-0000-4000-8000-000000000011',
    'Luleå Wind',
    'lulea-wind',
    'Luleå',
    'Norrbotten',
    'wind',
    0,
    65,
    '130 kV',
    'prospect',
    'weak',
    'low',
    'Q3 2032',
    'Fictional 65 MW wind prospect used for local development. Illustrative weak-screen example only.'
  ),
  (
    'a0000000-0000-4000-8000-000000000108',
    'a0000000-0000-4000-8000-000000000001',
    'a0000000-0000-4000-8000-000000000013',
    'Malmö BESS',
    'malmo-bess',
    'Malmö',
    'Skåne',
    'battery_storage',
    30,
    30,
    '130 kV',
    'screened',
    'possible',
    'medium',
    'Q2 2029',
    'Fictional 30 MW / 30 MW battery storage project used for local development. Illustrative screened-stage example only.'
  ),
  (
    'a0000000-0000-4000-8000-000000000109',
    'a0000000-0000-4000-8000-000000000001',
    'a0000000-0000-4000-8000-000000000011',
    'Jönköping Solar',
    'jonkoping-solar',
    'Jönköping',
    'Jönköping',
    'solar',
    0,
    45,
    '130 kV',
    'offer',
    'favourable',
    'high',
    'Q3 2028',
    'Fictional 45 MW solar project used for local development. Illustrative offer-stage example only.'
  ),
  (
    'a0000000-0000-4000-8000-000000000110',
    'a0000000-0000-4000-8000-000000000001',
    'a0000000-0000-4000-8000-000000000015',
    'Göteborg EV Hub',
    'goteborg-ev-hub',
    'Göteborg',
    'Västra Götaland',
    'ev_infrastructure',
    12,
    0,
    '10 kV',
    'grid_study',
    'possible',
    'medium',
    'Q1 2028',
    'Fictional 12 MW EV charging hub used for local development. Illustrative grid-study example only.'
  ),
  (
    'a0000000-0000-4000-8000-000000000111',
    'a0000000-0000-4000-8000-000000000001',
    'a0000000-0000-4000-8000-000000000011',
    'Kiruna Industrial Park',
    'kiruna-industrial-park',
    'Kiruna',
    'Norrbotten',
    'industrial',
    40,
    0,
    '130 kV',
    'agreement',
    'favourable',
    'high',
    'Q2 2028',
    'Fictional 40 MW industrial electrification project used for local development. Illustrative agreement-stage example only.'
  );

-- One primary site per project. Geometry is WGS84 Point(longitude, latitude).
insert into public.project_sites (
  id,
  project_id,
  name,
  location,
  geom,
  is_primary
) values
  (
    'a0000000-0000-4000-8000-000000000201',
    'a0000000-0000-4000-8000-000000000101',
    'Gävle BESS site',
    'Gävle',
    extensions.st_setsrid(extensions.st_makepoint(17.1413, 60.6749), 4326),
    true
  ),
  (
    'a0000000-0000-4000-8000-000000000202',
    'a0000000-0000-4000-8000-000000000102',
    'Västerås Storage site',
    'Västerås',
    extensions.st_setsrid(extensions.st_makepoint(16.5448, 59.6099), 4326),
    true
  ),
  (
    'a0000000-0000-4000-8000-000000000203',
    'a0000000-0000-4000-8000-000000000103',
    'Sundsvall Solar site',
    'Sundsvall',
    extensions.st_setsrid(extensions.st_makepoint(17.3069, 62.3908), 4326),
    true
  ),
  (
    'a0000000-0000-4000-8000-000000000204',
    'a0000000-0000-4000-8000-000000000104',
    'Uppsala Wind North site',
    'Tierp / Uppsala N',
    extensions.st_setsrid(extensions.st_makepoint(17.518, 60.342), 4326),
    true
  ),
  (
    'a0000000-0000-4000-8000-000000000205',
    'a0000000-0000-4000-8000-000000000105',
    'Örebro BESS site',
    'Örebro',
    extensions.st_setsrid(extensions.st_makepoint(15.2134, 59.2753), 4326),
    true
  ),
  (
    'a0000000-0000-4000-8000-000000000206',
    'a0000000-0000-4000-8000-000000000106',
    'Falun BESS site',
    'Falun',
    extensions.st_setsrid(extensions.st_makepoint(15.6355, 60.6065), 4326),
    true
  ),
  (
    'a0000000-0000-4000-8000-000000000207',
    'a0000000-0000-4000-8000-000000000107',
    'Luleå Wind site',
    'Luleå',
    extensions.st_setsrid(extensions.st_makepoint(22.1547, 65.5848), 4326),
    true
  ),
  (
    'a0000000-0000-4000-8000-000000000208',
    'a0000000-0000-4000-8000-000000000108',
    'Malmö BESS site',
    'Malmö',
    extensions.st_setsrid(extensions.st_makepoint(13.0038, 55.605), 4326),
    true
  ),
  (
    'a0000000-0000-4000-8000-000000000209',
    'a0000000-0000-4000-8000-000000000109',
    'Jönköping Solar site',
    'Jönköping',
    extensions.st_setsrid(extensions.st_makepoint(14.1618, 57.7826), 4326),
    true
  ),
  (
    'a0000000-0000-4000-8000-000000000210',
    'a0000000-0000-4000-8000-000000000110',
    'Göteborg EV Hub site',
    'Göteborg',
    extensions.st_setsrid(extensions.st_makepoint(11.9746, 57.7089), 4326),
    true
  ),
  (
    'a0000000-0000-4000-8000-000000000211',
    'a0000000-0000-4000-8000-000000000111',
    'Kiruna Industrial Park site',
    'Kiruna',
    extensions.st_setsrid(extensions.st_makepoint(20.2253, 67.8558), 4326),
    true
  );

-- Operational rows below are fictional demo workflow data only.
-- IDs: cases ...000301–000308, requirements ...000401+, alerts ...000501–000508,
-- documents ...000601–000614, events ...000701+.
-- owner_id is left null: the local auth user is created after reset by
-- npm run dev:bootstrap-auth.

insert into public.connection_cases (
  id,
  project_id,
  grid_operator_id,
  case_id,
  stage,
  status,
  submitted_at,
  next_milestone,
  deadline
) values
  (
    'a0000000-0000-4000-8000-000000000301',
    'a0000000-0000-4000-8000-000000000101',
    'a0000000-0000-4000-8000-000000000011',
    'VF-GS-2026-1842',
    'grid_study',
    'at_risk',
    '2025-11-12',
    'Study workshop / signed study agreement',
    '2026-09-30'
  ),
  (
    'a0000000-0000-4000-8000-000000000302',
    'a0000000-0000-4000-8000-000000000102',
    'a0000000-0000-4000-8000-000000000012',
    'ELV-APP-2026-0911',
    'application',
    'on_track',
    '2026-03-04',
    'Completeness confirmation',
    '2026-10-15'
  ),
  (
    'a0000000-0000-4000-8000-000000000303',
    'a0000000-0000-4000-8000-000000000103',
    'a0000000-0000-4000-8000-000000000013',
    'EON-ENQ-2026-2204',
    'enquiry',
    'overdue',
    '2026-05-18',
    'Operator enquiry response',
    '2026-07-17'
  ),
  (
    'a0000000-0000-4000-8000-000000000304',
    'a0000000-0000-4000-8000-000000000104',
    'a0000000-0000-4000-8000-000000000014',
    'SVK-APP-2026-0044',
    'application',
    'at_risk',
    '2026-01-20',
    'NIA and permit pack',
    '2026-09-05'
  ),
  (
    'a0000000-0000-4000-8000-000000000305',
    'a0000000-0000-4000-8000-000000000106',
    'a0000000-0000-4000-8000-000000000011',
    'VF-ENQ-2026-3102',
    'enquiry',
    'waiting',
    '2026-06-02',
    'Indicative operator assessment',
    '2026-09-01'
  ),
  (
    'a0000000-0000-4000-8000-000000000306',
    'a0000000-0000-4000-8000-000000000109',
    'a0000000-0000-4000-8000-000000000011',
    'VF-OFF-2026-0088',
    'offer',
    'on_track',
    '2026-02-02',
    'Offer acceptance',
    '2026-11-09'
  ),
  (
    'a0000000-0000-4000-8000-000000000307',
    'a0000000-0000-4000-8000-000000000110',
    'a0000000-0000-4000-8000-000000000015',
    'GE-GS-2026-0177',
    'grid_study',
    'waiting',
    '2026-04-11',
    'Formal study report',
    '2026-09-12'
  ),
  (
    'a0000000-0000-4000-8000-000000000308',
    'a0000000-0000-4000-8000-000000000111',
    'a0000000-0000-4000-8000-000000000011',
    'VF-AGR-2025-0091',
    'agreement',
    'on_track',
    '2025-06-18',
    'Agreement execution',
    '2026-09-30'
  );

-- Gävle BESS: 7 of 10 complete (~70% simple readiness). Remaining rows are
-- incomplete / missing / in_progress as specified for the demo checklist.
insert into public.project_requirements (
  id,
  project_id,
  connection_case_id,
  label,
  status
) values
  ('a0000000-0000-4000-8000-000000000401', 'a0000000-0000-4000-8000-000000000101', 'a0000000-0000-4000-8000-000000000301', 'Project description', 'complete'),
  ('a0000000-0000-4000-8000-000000000402', 'a0000000-0000-4000-8000-000000000101', 'a0000000-0000-4000-8000-000000000301', 'Land rights', 'complete'),
  ('a0000000-0000-4000-8000-000000000403', 'a0000000-0000-4000-8000-000000000101', 'a0000000-0000-4000-8000-000000000301', 'Single-line diagram', 'complete'),
  ('a0000000-0000-4000-8000-000000000404', 'a0000000-0000-4000-8000-000000000101', 'a0000000-0000-4000-8000-000000000301', 'Load profile', 'incomplete'),
  ('a0000000-0000-4000-8000-000000000405', 'a0000000-0000-4000-8000-000000000101', 'a0000000-0000-4000-8000-000000000301', 'Technical appendix', 'missing'),
  ('a0000000-0000-4000-8000-000000000406', 'a0000000-0000-4000-8000-000000000101', 'a0000000-0000-4000-8000-000000000301', 'Permit timeline', 'in_progress'),
  ('a0000000-0000-4000-8000-000000000407', 'a0000000-0000-4000-8000-000000000101', 'a0000000-0000-4000-8000-000000000301', 'Grid study agreement', 'complete'),
  ('a0000000-0000-4000-8000-000000000408', 'a0000000-0000-4000-8000-000000000101', 'a0000000-0000-4000-8000-000000000301', 'Site access memo', 'complete'),
  ('a0000000-0000-4000-8000-000000000409', 'a0000000-0000-4000-8000-000000000101', 'a0000000-0000-4000-8000-000000000301', 'Protection settings note', 'complete'),
  ('a0000000-0000-4000-8000-000000000410', 'a0000000-0000-4000-8000-000000000101', 'a0000000-0000-4000-8000-000000000301', 'Point of connection sketch', 'complete'),
  ('a0000000-0000-4000-8000-000000000411', 'a0000000-0000-4000-8000-000000000104', 'a0000000-0000-4000-8000-000000000304', 'Project description', 'complete'),
  ('a0000000-0000-4000-8000-000000000412', 'a0000000-0000-4000-8000-000000000104', 'a0000000-0000-4000-8000-000000000304', 'Screening memo', 'complete'),
  ('a0000000-0000-4000-8000-000000000413', 'a0000000-0000-4000-8000-000000000104', 'a0000000-0000-4000-8000-000000000304', 'Application form', 'in_progress'),
  ('a0000000-0000-4000-8000-000000000414', 'a0000000-0000-4000-8000-000000000104', 'a0000000-0000-4000-8000-000000000304', 'Network Impact Assessment', 'missing'),
  ('a0000000-0000-4000-8000-000000000415', 'a0000000-0000-4000-8000-000000000104', 'a0000000-0000-4000-8000-000000000304', 'Landowner Agreement', 'missing'),
  ('a0000000-0000-4000-8000-000000000416', 'a0000000-0000-4000-8000-000000000104', 'a0000000-0000-4000-8000-000000000304', 'Environmental Permit', 'missing'),
  ('a0000000-0000-4000-8000-000000000417', 'a0000000-0000-4000-8000-000000000102', 'a0000000-0000-4000-8000-000000000302', 'Project description', 'complete'),
  ('a0000000-0000-4000-8000-000000000418', 'a0000000-0000-4000-8000-000000000102', 'a0000000-0000-4000-8000-000000000302', 'Land rights', 'complete'),
  ('a0000000-0000-4000-8000-000000000419', 'a0000000-0000-4000-8000-000000000102', 'a0000000-0000-4000-8000-000000000302', 'Single-line diagram', 'complete'),
  ('a0000000-0000-4000-8000-000000000420', 'a0000000-0000-4000-8000-000000000102', 'a0000000-0000-4000-8000-000000000302', 'Load profile', 'complete'),
  ('a0000000-0000-4000-8000-000000000421', 'a0000000-0000-4000-8000-000000000102', 'a0000000-0000-4000-8000-000000000302', 'Technical appendix', 'complete'),
  ('a0000000-0000-4000-8000-000000000422', 'a0000000-0000-4000-8000-000000000102', 'a0000000-0000-4000-8000-000000000302', 'Completeness checklist', 'in_progress'),
  ('a0000000-0000-4000-8000-000000000423', 'a0000000-0000-4000-8000-000000000106', 'a0000000-0000-4000-8000-000000000305', 'Project description', 'complete'),
  ('a0000000-0000-4000-8000-000000000424', 'a0000000-0000-4000-8000-000000000106', 'a0000000-0000-4000-8000-000000000305', 'Site coordinates pack', 'complete'),
  ('a0000000-0000-4000-8000-000000000425', 'a0000000-0000-4000-8000-000000000106', 'a0000000-0000-4000-8000-000000000305', 'Enquiry form', 'complete'),
  ('a0000000-0000-4000-8000-000000000426', 'a0000000-0000-4000-8000-000000000106', 'a0000000-0000-4000-8000-000000000305', 'Land rights', 'in_progress'),
  ('a0000000-0000-4000-8000-000000000427', 'a0000000-0000-4000-8000-000000000106', 'a0000000-0000-4000-8000-000000000305', 'Single-line diagram', 'not_started'),
  ('a0000000-0000-4000-8000-000000000428', 'a0000000-0000-4000-8000-000000000103', 'a0000000-0000-4000-8000-000000000303', 'Project description', 'complete'),
  ('a0000000-0000-4000-8000-000000000429', 'a0000000-0000-4000-8000-000000000103', 'a0000000-0000-4000-8000-000000000303', 'Enquiry pack', 'complete'),
  ('a0000000-0000-4000-8000-000000000430', 'a0000000-0000-4000-8000-000000000103', 'a0000000-0000-4000-8000-000000000303', 'Follow-up letter', 'in_progress'),
  ('a0000000-0000-4000-8000-000000000431', 'a0000000-0000-4000-8000-000000000103', 'a0000000-0000-4000-8000-000000000303', 'Land option', 'incomplete'),
  ('a0000000-0000-4000-8000-000000000432', 'a0000000-0000-4000-8000-000000000109', 'a0000000-0000-4000-8000-000000000306', 'Project description', 'complete'),
  ('a0000000-0000-4000-8000-000000000433', 'a0000000-0000-4000-8000-000000000109', 'a0000000-0000-4000-8000-000000000306', 'Connection offer review', 'complete'),
  ('a0000000-0000-4000-8000-000000000434', 'a0000000-0000-4000-8000-000000000109', 'a0000000-0000-4000-8000-000000000306', 'Commercial memo', 'in_progress'),
  ('a0000000-0000-4000-8000-000000000435', 'a0000000-0000-4000-8000-000000000109', 'a0000000-0000-4000-8000-000000000306', 'Offer acceptance pack', 'not_started'),
  ('a0000000-0000-4000-8000-000000000436', 'a0000000-0000-4000-8000-000000000110', 'a0000000-0000-4000-8000-000000000307', 'Project description', 'complete'),
  ('a0000000-0000-4000-8000-000000000437', 'a0000000-0000-4000-8000-000000000110', 'a0000000-0000-4000-8000-000000000307', 'Load profile', 'complete'),
  ('a0000000-0000-4000-8000-000000000438', 'a0000000-0000-4000-8000-000000000110', 'a0000000-0000-4000-8000-000000000307', 'Study input pack', 'in_progress'),
  ('a0000000-0000-4000-8000-000000000439', 'a0000000-0000-4000-8000-000000000110', 'a0000000-0000-4000-8000-000000000307', 'Site layout', 'incomplete'),
  ('a0000000-0000-4000-8000-000000000440', 'a0000000-0000-4000-8000-000000000111', 'a0000000-0000-4000-8000-000000000308', 'Project description', 'complete'),
  ('a0000000-0000-4000-8000-000000000441', 'a0000000-0000-4000-8000-000000000111', 'a0000000-0000-4000-8000-000000000308', 'Connection offer', 'complete'),
  ('a0000000-0000-4000-8000-000000000442', 'a0000000-0000-4000-8000-000000000111', 'a0000000-0000-4000-8000-000000000308', 'Agreement draft', 'in_progress'),
  ('a0000000-0000-4000-8000-000000000443', 'a0000000-0000-4000-8000-000000000111', 'a0000000-0000-4000-8000-000000000308', 'Execution copies', 'incomplete');

insert into public.alerts (
  id,
  organization_id,
  project_id,
  severity,
  status,
  title,
  summary,
  detail,
  cta_label,
  href,
  created_at
) values
  (
    'a0000000-0000-4000-8000-000000000501',
    'a0000000-0000-4000-8000-000000000001',
    'a0000000-0000-4000-8000-000000000101',
    'critical',
    'open',
    'Grid capacity data updated — indicative outlook reduced',
    'Fictional demo alert: indicative outlook for Gävle BESS was reduced in this dataset.',
    'All figures in this alert are fictional and illustrative. The previous demo indication was about 25 MW headroom; the current demo indication is about 12 MW, below the 20 MW bidirectional request. This is not operator-supplied information, not an official capacity statement, and not a rejection. Formal grid operator assessment is still required.',
    'Review',
    '/projects/gavle-bess?tab=grid',
    '2026-08-18T09:14:00+02:00'
  ),
  (
    'a0000000-0000-4000-8000-000000000502',
    'a0000000-0000-4000-8000-000000000001',
    'a0000000-0000-4000-8000-000000000101',
    'warning',
    'open',
    'Reinforcement cost assumption revised upward',
    'Fictional demo alert: Gävle BESS working cost assumption increased in this dataset.',
    'Illustrative study assumption only: fictional reinforcement cost moved from SEK 20m to SEK 28m. This is not a connection offer, not operator-supplied pricing, and not current grid information. Review before further engineering spend in the demo workflow.',
    'Review',
    '/projects/gavle-bess?tab=grid',
    '2026-08-17T15:40:00+02:00'
  ),
  (
    'a0000000-0000-4000-8000-000000000503',
    'a0000000-0000-4000-8000-000000000001',
    'a0000000-0000-4000-8000-000000000104',
    'critical',
    'open',
    'Connection application deadline in 18 days',
    'Fictional demo alert: Uppsala Wind North completeness deadline is 5 September 2026 in this dataset.',
    'Illustrative only. Missing demo items: Network Impact Assessment, Landowner Agreement, Environmental Permit. If these remain missing, the fictional application is treated as incomplete. This deadline is not an official operator notice.',
    'Review application',
    '/projects/uppsala-wind-north?tab=connection',
    '2026-08-18T08:30:00+02:00'
  ),
  (
    'a0000000-0000-4000-8000-000000000504',
    'a0000000-0000-4000-8000-000000000001',
    'a0000000-0000-4000-8000-000000000103',
    'warning',
    'open',
    'Grid operator response overdue',
    'Fictional demo alert: Sundsvall Solar enquiry response is overdue in this dataset.',
    'Illustrative workflow only. Demo enquiry submitted 18 May 2026 with an internal 60-day follow-up date of 17 July 2026. No reply is stored in this database. This is not a statement that E.ON Energidistribution failed to respond in the real world.',
    'Review',
    '/projects/sundsvall-solar?tab=connection',
    '2026-08-16T08:50:00+02:00'
  ),
  (
    'a0000000-0000-4000-8000-000000000505',
    'a0000000-0000-4000-8000-000000000001',
    'a0000000-0000-4000-8000-000000000106',
    'positive',
    'open',
    'Indicative project outlook improved',
    'Fictional demo alert: Falun BESS indicative outlook improved in this dataset.',
    'Illustrative only. Previous demo indication about 8 MW; current demo indication about 16 MW, covering the 10 MW bidirectional request. Outlook is Favourable in this seed. This remains fictional until a real enquiry is answered. Not operator-supplied capacity.',
    'Review',
    '/projects/falun-bess?tab=grid',
    '2026-08-14T12:05:00+02:00'
  ),
  (
    'a0000000-0000-4000-8000-000000000506',
    'a0000000-0000-4000-8000-000000000001',
    'a0000000-0000-4000-8000-000000000110',
    'info',
    'open',
    'Grid study note recorded',
    'Fictional demo alert: a preliminary study note was recorded for Göteborg EV Hub.',
    'Illustrative working document only, not a connection offer and not operator-supplied data. The formal study report remains outstanding in this demo, with a fictional target of 12 September 2026.',
    'Review',
    '/projects/goteborg-ev-hub?tab=connection',
    '2026-08-13T14:25:00+02:00'
  ),
  (
    'a0000000-0000-4000-8000-000000000507',
    'a0000000-0000-4000-8000-000000000001',
    'a0000000-0000-4000-8000-000000000107',
    'info',
    'open',
    'Regional reinforcement may improve connection outlook',
    'Fictional demo alert: a northern reinforcement programme is relevant to Luleå Wind in this dataset.',
    'Indicative planning information invented for local development. It does not create capacity and does not change the current Weak screen. Use it to time a later re-screen in the demo, not to justify engineering. Not operator-supplied.',
    'Review',
    '/projects/lulea-wind?tab=grid',
    '2026-08-15T09:40:00+02:00'
  ),
  (
    'a0000000-0000-4000-8000-000000000508',
    'a0000000-0000-4000-8000-000000000001',
    'a0000000-0000-4000-8000-000000000109',
    'info',
    'open',
    'Connection offer review window open',
    'Fictional demo alert: Jönköping Solar has an illustrative offer-acceptance window.',
    'The offer, dates and commercial terms in this seed are invented. This is not a real connection offer and was not issued by a grid operator. Demo acceptance target: 9 November 2026.',
    'Review',
    '/projects/jonkoping-solar?tab=connection',
    '2026-08-12T10:20:00+02:00'
  );

-- Document metadata only. No storage objects are created.
insert into public.documents (
  id,
  project_id,
  name,
  category,
  status,
  created_at,
  updated_at
) values
  ('a0000000-0000-4000-8000-000000000601', 'a0000000-0000-4000-8000-000000000101', 'Single-line diagram', 'technical', 'complete', '2026-03-02T10:00:00+01:00', '2026-03-02T10:00:00+01:00'),
  ('a0000000-0000-4000-8000-000000000602', 'a0000000-0000-4000-8000-000000000101', 'Load profile', 'technical', 'draft', '2026-07-01T09:00:00+02:00', '2026-08-10T11:00:00+02:00'),
  ('a0000000-0000-4000-8000-000000000603', 'a0000000-0000-4000-8000-000000000101', 'Grid study note', 'grid', 'complete', '2026-01-20T09:00:00+01:00', '2026-08-18T09:14:00+02:00'),
  ('a0000000-0000-4000-8000-000000000604', 'a0000000-0000-4000-8000-000000000101', 'Screening memo', 'permit', 'in_progress', '2026-08-01T09:00:00+02:00', '2026-08-01T09:00:00+02:00'),
  ('a0000000-0000-4000-8000-000000000605', 'a0000000-0000-4000-8000-000000000104', 'Network Impact Assessment', 'grid', 'missing', '2026-08-01T08:00:00+02:00', '2026-08-18T08:30:00+02:00'),
  ('a0000000-0000-4000-8000-000000000606', 'a0000000-0000-4000-8000-000000000104', 'Landowner agreement pack', 'land', 'missing', '2026-08-01T08:00:00+02:00', '2026-08-18T08:30:00+02:00'),
  ('a0000000-0000-4000-8000-000000000607', 'a0000000-0000-4000-8000-000000000104', 'Environmental permit', 'permit', 'missing', '2026-08-01T08:00:00+02:00', '2026-08-18T08:30:00+02:00'),
  ('a0000000-0000-4000-8000-000000000608', 'a0000000-0000-4000-8000-000000000102', 'Connection application pack', 'grid', 'complete', '2026-03-04T09:00:00+01:00', '2026-03-04T09:00:00+01:00'),
  ('a0000000-0000-4000-8000-000000000609', 'a0000000-0000-4000-8000-000000000102', 'Single-line diagram', 'technical', 'complete', '2026-02-18T10:00:00+01:00', '2026-02-18T10:00:00+01:00'),
  ('a0000000-0000-4000-8000-000000000610', 'a0000000-0000-4000-8000-000000000103', 'Connection enquiry letter', 'grid', 'complete', '2026-05-18T11:00:00+02:00', '2026-05-18T11:00:00+02:00'),
  ('a0000000-0000-4000-8000-000000000611', 'a0000000-0000-4000-8000-000000000106', 'Enquiry pack', 'grid', 'complete', '2026-06-02T09:30:00+02:00', '2026-06-02T09:30:00+02:00'),
  ('a0000000-0000-4000-8000-000000000612', 'a0000000-0000-4000-8000-000000000109', 'Connection offer', 'grid', 'complete', '2026-08-11T10:15:00+02:00', '2026-08-11T10:15:00+02:00'),
  ('a0000000-0000-4000-8000-000000000613', 'a0000000-0000-4000-8000-000000000109', 'Offer commercial memo', 'commercial', 'in_progress', '2026-08-13T16:40:00+02:00', '2026-08-13T16:40:00+02:00'),
  ('a0000000-0000-4000-8000-000000000614', 'a0000000-0000-4000-8000-000000000111', 'Accepted connection offer', 'commercial', 'complete', '2026-03-21T10:00:00+01:00', '2026-03-21T10:00:00+01:00');

insert into public.project_events (
  id,
  project_id,
  title,
  detail,
  source,
  occurred_at
) values
  (
    'a0000000-0000-4000-8000-000000000701',
    'a0000000-0000-4000-8000-000000000101',
    'Site screening completed',
    'Fictional screening of the Gävle industrial-fringe site. Illustrative only.',
    'NOXHEIM Analysis',
    '2025-06-18T10:00:00+02:00'
  ),
  (
    'a0000000-0000-4000-8000-000000000702',
    'a0000000-0000-4000-8000-000000000101',
    'Connection enquiry submitted',
    'Fictional enquiry recorded against VF-GS-2026-1842. Not an operator filing.',
    'Customer Data',
    '2025-09-02T09:00:00+02:00'
  ),
  (
    'a0000000-0000-4000-8000-000000000703',
    'a0000000-0000-4000-8000-000000000101',
    'Operator requested clarification',
    'Fictional clarification request on import/export profile. Demo workflow only.',
    'Indicative',
    '2025-10-21T14:00:00+02:00'
  ),
  (
    'a0000000-0000-4000-8000-000000000704',
    'a0000000-0000-4000-8000-000000000101',
    'Single-line diagram uploaded',
    'Metadata-only document row. No file was stored.',
    'Customer Data',
    '2026-03-02T10:00:00+01:00'
  ),
  (
    'a0000000-0000-4000-8000-000000000705',
    'a0000000-0000-4000-8000-000000000101',
    'Indicative grid information updated',
    'Fictional headroom indication reduced in this dataset. Not current grid information.',
    'NOXHEIM Analysis',
    '2026-08-18T09:14:00+02:00'
  ),
  (
    'a0000000-0000-4000-8000-000000000706',
    'a0000000-0000-4000-8000-000000000102',
    'Application pack submitted',
    'Fictional Ellevio application completeness pack for Västerås Storage.',
    'Customer Data',
    '2026-03-04T09:00:00+01:00'
  ),
  (
    'a0000000-0000-4000-8000-000000000707',
    'a0000000-0000-4000-8000-000000000102',
    'Completeness review started',
    'Illustrative on-track application review. Not an operator status.',
    'NOXHEIM Analysis',
    '2026-06-12T11:00:00+02:00'
  ),
  (
    'a0000000-0000-4000-8000-000000000708',
    'a0000000-0000-4000-8000-000000000103',
    'Connection enquiry submitted',
    'Fictional Sundsvall Solar enquiry dated 18 May 2026.',
    'Customer Data',
    '2026-05-18T11:00:00+02:00'
  ),
  (
    'a0000000-0000-4000-8000-000000000709',
    'a0000000-0000-4000-8000-000000000103',
    'Follow-up marked overdue',
    'Internal demo SLA elapsed. This does not mean a real operator missed a deadline.',
    'NOXHEIM Analysis',
    '2026-07-17T17:00:00+02:00'
  ),
  (
    'a0000000-0000-4000-8000-000000000710',
    'a0000000-0000-4000-8000-000000000104',
    'Transmission application opened',
    'Fictional Uppsala Wind North application window for the demo dataset.',
    'Customer Data',
    '2026-01-20T09:30:00+01:00'
  ),
  (
    'a0000000-0000-4000-8000-000000000711',
    'a0000000-0000-4000-8000-000000000104',
    'Missing application items flagged',
    'NIA, landowner agreement and environmental permit remain missing in this seed.',
    'NOXHEIM Analysis',
    '2026-08-18T08:30:00+02:00'
  ),
  (
    'a0000000-0000-4000-8000-000000000712',
    'a0000000-0000-4000-8000-000000000106',
    'Enquiry submitted',
    'Fictional Falun BESS enquiry. Illustrative favourable outlook only.',
    'Customer Data',
    '2026-06-02T09:30:00+02:00'
  ),
  (
    'a0000000-0000-4000-8000-000000000713',
    'a0000000-0000-4000-8000-000000000106',
    'Indicative outlook improved',
    'Fictional headroom indication increased in this dataset. Not operator-supplied.',
    'NOXHEIM Analysis',
    '2026-08-14T12:05:00+02:00'
  ),
  (
    'a0000000-0000-4000-8000-000000000714',
    'a0000000-0000-4000-8000-000000000109',
    'Connection offer recorded',
    'Fictional offer metadata for Jönköping Solar. Not a real offer.',
    'Indicative',
    '2026-08-11T10:15:00+02:00'
  ),
  (
    'a0000000-0000-4000-8000-000000000715',
    'a0000000-0000-4000-8000-000000000110',
    'Grid study inputs sent',
    'Fictional Göteborg EV Hub study pack. Illustrative only.',
    'Customer Data',
    '2026-04-11T13:00:00+02:00'
  ),
  (
    'a0000000-0000-4000-8000-000000000716',
    'a0000000-0000-4000-8000-000000000111',
    'Connection agreement in drafting',
    'Fictional Kiruna Industrial Park agreement workflow. Not executed.',
    'Customer Data',
    '2026-08-05T09:00:00+02:00'
  );
