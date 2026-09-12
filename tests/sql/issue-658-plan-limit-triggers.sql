-- Leftover cleanup PR-01: plan-limit triggers are gone.
-- Rolled back, so it leaves the seeded database untouched.
--
--   docker exec -i supabase_db_lms-front psql -U postgres -d postgres -P pager=off \
--     < tests/sql/issue-658-plan-limit-triggers.sql

begin;

do $$
declare
  free_tenant constant uuid := '00000000-0000-0000-0000-000000000001';
  author uuid;
  new_id int;
begin
  if exists (
    select 1 from pg_trigger
    where tgname in ('enforce_course_plan_limit', 'enforce_student_plan_limit')
  ) then
    raise exception 'plan-limit triggers still exist';
  end if;

  if to_regprocedure('public.get_tenant_plan_usage(uuid)') is not null then
    raise exception 'get_tenant_plan_usage still exists';
  end if;

  select author_id into author
  from public.courses
  where tenant_id = free_tenant
  limit 1;

  insert into public.courses (title, status, tenant_id, author_id)
  values ('PR01 sql sixth course', 'draft', free_tenant, author)
  returning course_id into new_id;

  if new_id is null then
    raise exception 'sixth course insert failed after trigger drop';
  end if;

  delete from public.courses where course_id = new_id;

  raise notice 'PASS: plan-limit triggers dropped; course insert is not refused';
end $$;

rollback;
