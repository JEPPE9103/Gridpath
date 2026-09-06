-- Local/ephemeral Supabase only. SELECT-only contract checks.
-- Never run against Design Partner Cloud / production.

select
  to_regprocedure('public.list_source_health()') is not null as has_list_source_health,
  to_regprocedure('private.begin_source_ingestion_run(text,text)') is not null as has_begin_run,
  to_regprocedure('private.complete_source_ingestion_run(uuid,text,uuid,boolean,integer,integer,integer,text,text,jsonb)') is not null as has_complete_run,
  to_regprocedure('public.monitor_reconcile_workflow_alerts()') is not null as has_reconcile,
  to_regprocedure('private.apply_observation_snapshot_changes(uuid, uuid, boolean, text, text)') is not null as has_apply_changes,
  exists (select 1 from pg_extension where extname = 'postgis') as has_postgis,
  exists (select 1 from storage.buckets where id = 'project-documents') as has_project_documents_bucket;
