-- Self-hosted leftover cleanup PR-02: a tenant member may enroll in a
-- published course of that tenant without a subscriptions row. Do not
-- consult plan_courses. Empty plan_courses used to mean "covers all" in
-- Browse and "covers none" in the subscription RPC join. Membership
-- enroll does not copy that split.

CREATE OR REPLACE FUNCTION public.self_enroll_school_course(_course_id integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    _user_id uuid := auth.uid();
    _tenant_id uuid;
BEGIN
    IF _user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    SELECT c.tenant_id
    INTO _tenant_id
    FROM public.courses AS c
    WHERE c.course_id = _course_id
      AND c.status = 'published';

    IF _tenant_id IS NULL THEN
        RAISE EXCEPTION 'Course is not available for enrollment';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.tenant_users AS tu
        WHERE tu.user_id = _user_id
          AND tu.tenant_id = _tenant_id
          AND tu.status = 'active'
    ) THEN
        RAISE EXCEPTION 'User is not an active member of this tenant';
    END IF;

    INSERT INTO public.entitlements (
        user_id,
        course_id,
        tenant_id,
        source_type,
        source_id,
        status,
        expires_at
    )
    VALUES (_user_id, _course_id, _tenant_id, 'free', NULL, 'active', NULL)
    ON CONFLICT (user_id, course_id, source_type, source_id) DO UPDATE SET
        status = 'active',
        revoked_at = NULL,
        expires_at = NULL,
        tenant_id = EXCLUDED.tenant_id;

    INSERT INTO public.enrollments (
        user_id,
        course_id,
        enrollment_date,
        status,
        tenant_id
    )
    VALUES (_user_id, _course_id, NOW(), 'active', _tenant_id)
    ON CONFLICT (user_id, course_id) DO UPDATE SET
        status = 'active',
        tenant_id = EXCLUDED.tenant_id;
END;
$function$;

COMMENT ON FUNCTION public.self_enroll_school_course(integer) IS
  'Tenant members self-enroll in a published course of their school. Writes entitlements (free) and enrollments. No subscription required.';

REVOKE ALL ON FUNCTION public.self_enroll_school_course(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.self_enroll_school_course(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.self_enroll_school_course(integer) TO service_role;

-- Leftover callers (public plan enroll) keep the old name. Same membership
-- rule. No subscription or plan_courses check.
CREATE OR REPLACE FUNCTION public.self_enroll_subscription_course(_course_id integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
    PERFORM public.self_enroll_school_course(_course_id);
END;
$function$;

REVOKE ALL ON FUNCTION public.self_enroll_subscription_course(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.self_enroll_subscription_course(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.self_enroll_subscription_course(integer) TO service_role;
