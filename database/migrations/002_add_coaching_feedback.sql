-- Adds the coaching_feedback column for existing deployments.
-- schema.sql was updated for fresh installs; run this against your
-- existing Supabase/Postgres database to add the column without
-- dropping data.

alter table submissions add column if not exists coaching_feedback text;
