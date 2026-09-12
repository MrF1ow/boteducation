-- Self-hosted leftover cleanup PR-01: one school per deploy has no Free cap
-- and no access cutoff. Drop the #658 enforcement engine and clear leftover
-- lockouts. Keep entitlements, enrollments, plans, and subscriptions.

DROP TRIGGER IF EXISTS enforce_course_plan_limit ON public.courses;
DROP TRIGGER IF EXISTS enforce_student_plan_limit ON public.tenant_users;

DROP FUNCTION IF EXISTS public.enforce_course_plan_limit();
DROP FUNCTION IF EXISTS public.enforce_student_plan_limit();
DROP FUNCTION IF EXISTS public.assert_plan_limit_headroom(uuid, text);
DROP FUNCTION IF EXISTS public.get_tenant_plan_usage(uuid);

UPDATE public.tenants
SET access_cutoff_at = NULL
WHERE access_cutoff_at IS NOT NULL;
