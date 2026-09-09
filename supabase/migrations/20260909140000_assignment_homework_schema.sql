-- Revive unused assignment tables for BotEducation homework.
-- grades.submission_id currently FKs to exam_submissions. Homework scores
-- must not write through that constraint.

-- ── assignments ────────────────────────────────────────────────────────────

ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS body text,
  ADD COLUMN IF NOT EXISTS due_at timestamptz,
  ADD COLUMN IF NOT EXISTS late_policy jsonb NOT NULL DEFAULT '{"kind":"reject"}'::jsonb,
  ADD COLUMN IF NOT EXISTS max_score numeric NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS rubric jsonb,
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS published boolean NOT NULL DEFAULT true;

UPDATE public.assignments
SET body = description
WHERE body IS NULL AND description IS NOT NULL;

UPDATE public.assignments
SET due_at = due_date
WHERE due_at IS NULL AND due_date IS NOT NULL;

ALTER TABLE public.assignments
  DROP CONSTRAINT IF EXISTS assignments_late_policy_kind;

ALTER TABLE public.assignments
  ADD CONSTRAINT assignments_late_policy_kind
  CHECK (late_policy->>'kind' IN ('reject', 'accept', 'accept_until', 'penalize'));

ALTER TABLE public.assignments
  DROP CONSTRAINT IF EXISTS assignments_max_score_positive;

ALTER TABLE public.assignments
  ADD CONSTRAINT assignments_max_score_positive
  CHECK (max_score > 0);

CREATE INDEX IF NOT EXISTS idx_assignments_course_id ON public.assignments(course_id);
CREATE INDEX IF NOT EXISTS idx_assignments_due_at ON public.assignments(course_id, due_at);

CREATE OR REPLACE FUNCTION public.sync_assignment_legacy_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.body IS NOT NULL THEN
    NEW.description := NEW.body;
  ELSIF NEW.description IS NOT NULL THEN
    NEW.body := NEW.description;
  END IF;
  IF NEW.due_at IS NOT NULL THEN
    NEW.due_date := NEW.due_at;
  ELSIF NEW.due_date IS NOT NULL THEN
    NEW.due_at := NEW.due_date;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_assignment_legacy_columns ON public.assignments;
CREATE TRIGGER trg_sync_assignment_legacy_columns
  BEFORE INSERT OR UPDATE ON public.assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_assignment_legacy_columns();

DROP POLICY IF EXISTS "Authenticated users can view assignments" ON public.assignments;

DROP POLICY IF EXISTS "Students can view published enrolled assignments" ON public.assignments;
CREATE POLICY "Students can view published enrolled assignments"
  ON public.assignments FOR SELECT TO authenticated
  USING (
    published = true
    AND public.has_course_access((SELECT auth.uid()), course_id)
  );

-- ── submissions ──────────────────────────────────────────────────────────────

ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS body text,
  ADD COLUMN IF NOT EXISTS files jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft';

UPDATE public.submissions
SET submitted_at = submission_date
WHERE submitted_at IS NULL AND submission_date IS NOT NULL;

ALTER TABLE public.submissions
  DROP CONSTRAINT IF EXISTS submissions_status_check;

ALTER TABLE public.submissions
  ADD CONSTRAINT submissions_status_check
  CHECK (status IN ('draft', 'submitted', 'late'));

CREATE UNIQUE INDEX IF NOT EXISTS submissions_assignment_student_unique
  ON public.submissions (assignment_id, student_id);

CREATE OR REPLACE FUNCTION public.sync_submission_legacy_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.submitted_at IS NOT NULL THEN
    NEW.submission_date := NEW.submitted_at;
  ELSIF NEW.submission_date IS NOT NULL THEN
    NEW.submitted_at := NEW.submission_date;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_submission_legacy_columns ON public.submissions;
CREATE TRIGGER trg_sync_submission_legacy_columns
  BEFORE INSERT OR UPDATE ON public.submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_submission_legacy_columns();

CREATE OR REPLACE FUNCTION public.student_may_resubmit(p_assignment_id integer, p_status text)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_status IS NULL OR p_status = 'draft' THEN true
    ELSE EXISTS (
      SELECT 1
      FROM public.assignments a
      WHERE a.assignment_id = p_assignment_id
        AND (
          a.late_policy->>'kind' IN ('accept', 'penalize')
          OR (
            a.late_policy->>'kind' = 'accept_until'
            AND (a.late_policy->>'until') IS NOT NULL
            AND (a.late_policy->>'until')::timestamptz > now()
          )
        )
    )
  END;
$$;

DROP POLICY IF EXISTS "Students can view own submissions" ON public.submissions;
CREATE POLICY "Students can view own submissions"
  ON public.submissions FOR SELECT TO authenticated
  USING (
    student_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.assignments a
      WHERE a.assignment_id = submissions.assignment_id
        AND a.published = true
        AND public.has_course_access((SELECT auth.uid()), a.course_id)
    )
  );

DROP POLICY IF EXISTS "Students can create own submissions" ON public.submissions;
CREATE POLICY "Students can create own submissions"
  ON public.submissions FOR INSERT TO authenticated
  WITH CHECK (
    student_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.assignments a
      WHERE a.assignment_id = submissions.assignment_id
        AND a.published = true
        AND public.has_course_access((SELECT auth.uid()), a.course_id)
    )
  );

DROP POLICY IF EXISTS "Students can update own unlocked submissions" ON public.submissions;
CREATE POLICY "Students can update own unlocked submissions"
  ON public.submissions FOR UPDATE TO authenticated
  USING (
    student_id = (SELECT auth.uid())
    AND public.student_may_resubmit(assignment_id, status)
  )
  WITH CHECK (
    student_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.assignments a
      WHERE a.assignment_id = submissions.assignment_id
        AND a.published = true
        AND public.has_course_access((SELECT auth.uid()), a.course_id)
    )
  );

-- ── grades: retarget FK off exam_submissions, or add assignment_grades ───────────

DO $$
DECLARE
  leftover_exam_grades integer;
BEGIN
  SELECT count(*) INTO leftover_exam_grades
  FROM public.grades g
  WHERE g.submission_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.exam_submissions e
      WHERE e.submission_id = g.submission_id
    );

  IF leftover_exam_grades > 0 THEN
    CREATE TABLE IF NOT EXISTS public.assignment_grades (
      grade_id integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
      submission_id integer NOT NULL REFERENCES public.submissions(submission_id) ON DELETE CASCADE,
      student_id uuid NOT NULL,
      course_id integer NOT NULL REFERENCES public.courses(course_id),
      score numeric NOT NULL,
      feedback text,
      graded_at timestamptz DEFAULT CURRENT_TIMESTAMP,
      graded_by uuid REFERENCES auth.users(id),
      published boolean NOT NULL DEFAULT false,
      source text NOT NULL DEFAULT 'human',
      CONSTRAINT assignment_grades_source_check CHECK (source IN ('human', 'ai')),
      CONSTRAINT assignment_grades_score_nonneg CHECK (score >= 0),
      CONSTRAINT assignment_grades_submission_unique UNIQUE (submission_id)
    );

    ALTER TABLE public.assignment_grades ENABLE ROW LEVEL SECURITY;
    REVOKE ALL ON public.assignment_grades FROM anon;
    REVOKE TRUNCATE ON public.assignment_grades FROM authenticated;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.assignment_grades TO authenticated;

    CREATE POLICY "Students can view published assignment grades"
      ON public.assignment_grades FOR SELECT TO authenticated
      USING (
        student_id = (SELECT auth.uid())
        AND published = true
      );

    CREATE POLICY "Tenant staff can manage assignment grades"
      ON public.assignment_grades FOR ALL TO authenticated
      USING (EXISTS (
        SELECT 1 FROM public.courses c
        WHERE c.course_id = assignment_grades.course_id
          AND public.is_staff_of(c.tenant_id)
      ))
      WITH CHECK (EXISTS (
        SELECT 1 FROM public.courses c
        WHERE c.course_id = assignment_grades.course_id
          AND public.is_staff_of(c.tenant_id)
      ));
  ELSE
    ALTER TABLE public.grades DROP CONSTRAINT IF EXISTS grades_submission_id_fkey;
    ALTER TABLE public.grades
      ADD CONSTRAINT grades_submission_id_fkey
      FOREIGN KEY (submission_id) REFERENCES public.submissions(submission_id);

    ALTER TABLE public.grades
      ADD COLUMN IF NOT EXISTS score numeric,
      ADD COLUMN IF NOT EXISTS graded_by uuid REFERENCES auth.users(id),
      ADD COLUMN IF NOT EXISTS published boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'human';

    UPDATE public.grades
    SET score = grade
    WHERE score IS NULL AND grade IS NOT NULL;

    ALTER TABLE public.grades DROP CONSTRAINT IF EXISTS grades_source_check;
    ALTER TABLE public.grades
      ADD CONSTRAINT grades_source_check
      CHECK (source IN ('human', 'ai'));

    ALTER TABLE public.grades DROP CONSTRAINT IF EXISTS grades_grade_check;
    ALTER TABLE public.grades DROP CONSTRAINT IF EXISTS grades_score_nonneg;
    ALTER TABLE public.grades
      ADD CONSTRAINT grades_score_nonneg
      CHECK (score IS NULL OR score >= 0);

    CREATE UNIQUE INDEX IF NOT EXISTS grades_submission_unique
      ON public.grades (submission_id)
      WHERE submission_id IS NOT NULL;

    CREATE OR REPLACE FUNCTION public.sync_grade_score_columns()
    RETURNS trigger
    LANGUAGE plpgsql
    SET search_path = public
    AS $fn$
    BEGIN
      IF NEW.score IS NOT NULL THEN
        NEW.grade := NEW.score;
      ELSIF NEW.grade IS NOT NULL THEN
        NEW.score := NEW.grade;
      END IF;
      RETURN NEW;
    END;
    $fn$;

    DROP TRIGGER IF EXISTS trg_sync_grade_score_columns ON public.grades;
    CREATE TRIGGER trg_sync_grade_score_columns
      BEFORE INSERT OR UPDATE ON public.grades
      FOR EACH ROW
      EXECUTE FUNCTION public.sync_grade_score_columns();

    DROP POLICY IF EXISTS "Students can view own grades" ON public.grades;
    CREATE POLICY "Students can view published own grades"
      ON public.grades FOR SELECT TO authenticated
      USING (
        student_id = (SELECT auth.uid())
        AND published = true
      );
  END IF;
END $$;

-- ── professor bots ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.course_professor_bots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id integer NOT NULL REFERENCES public.courses(course_id) ON DELETE CASCADE,
  name text NOT NULL,
  system_prompt text NOT NULL DEFAULT '',
  rubric_rules text NOT NULL DEFAULT '',
  late_policy jsonb NOT NULL DEFAULT '{"kind":"reject"}'::jsonb,
  model text NOT NULL DEFAULT 'grok-4',
  tool_allowlist text[] NOT NULL DEFAULT ARRAY[]::text[],
  mcp_token_id bigint REFERENCES public.mcp_api_tokens(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT course_professor_bots_course_name_unique UNIQUE (course_id, name),
  CONSTRAINT course_professor_bots_late_policy_kind
    CHECK (late_policy->>'kind' IN ('reject', 'accept', 'accept_until', 'penalize'))
);

CREATE INDEX IF NOT EXISTS idx_course_professor_bots_course_id
  ON public.course_professor_bots(course_id);

ALTER TABLE public.course_professor_bots ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.course_professor_bots FROM anon;
REVOKE ALL ON public.course_professor_bots FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_professor_bots TO authenticated;

CREATE POLICY "Tenant staff can manage professor bots"
  ON public.course_professor_bots FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.courses c
    WHERE c.course_id = course_professor_bots.course_id
      AND public.is_staff_of(c.tenant_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.courses c
    WHERE c.course_id = course_professor_bots.course_id
      AND public.is_staff_of(c.tenant_id)
  ));

-- ── MCP token course scope ──────────────────────────────────────────────────

ALTER TABLE public.mcp_api_tokens
  ADD COLUMN IF NOT EXISTS course_ids integer[],
  ADD COLUMN IF NOT EXISTS token_role text NOT NULL DEFAULT 'professor';

ALTER TABLE public.mcp_api_tokens
  DROP CONSTRAINT IF EXISTS mcp_api_tokens_token_role_check;

ALTER TABLE public.mcp_api_tokens
  ADD CONSTRAINT mcp_api_tokens_token_role_check
  CHECK (token_role IN ('professor', 'admin'));

DROP FUNCTION IF EXISTS public.validate_mcp_api_token(text);

CREATE FUNCTION public.validate_mcp_api_token(token_input text)
RETURNS TABLE (
  user_id uuid,
  email text,
  user_role text,
  token_id bigint,
  course_ids integer[],
  token_role text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  token_hash_input text;
BEGIN
  token_hash_input := encode(digest(token_input, 'sha256'), 'hex');

  RETURN QUERY
  SELECT
    t.user_id,
    u.email::text,
    tu.role::text,
    t.id,
    t.course_ids,
    t.token_role
  FROM public.mcp_api_tokens t
  JOIN auth.users u ON u.id = t.user_id
  JOIN public.tenant_users tu ON tu.user_id = t.user_id AND tu.status = 'active'
  WHERE t.token_hash = token_hash_input
    AND t.is_active = true
    AND (t.expires_at IS NULL OR t.expires_at > now())
    AND tu.role IN ('teacher', 'admin')
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_mcp_api_token(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_mcp_api_token(text) TO service_role;

-- ── auto-publish setting ────────────────────────────────────────────────────

INSERT INTO public.tenant_settings (tenant_id, setting_key, setting_value)
SELECT t.id, 'auto_publish_grades', '{"enabled": false}'::jsonb
FROM public.tenants t
ON CONFLICT (tenant_id, setting_key) DO NOTHING;

-- ── course announcements stay on notifications ────────────────────────────────

CREATE OR REPLACE FUNCTION public.post_course_announcement(
  p_course_id integer,
  p_title text,
  p_body text
)
RETURNS bigint
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
  v_id bigint;
BEGIN
  SELECT tenant_id INTO v_tenant_id
  FROM public.courses
  WHERE course_id = p_course_id;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'course not found';
  END IF;

  IF NOT public.is_staff_of(v_tenant_id) THEN
    RAISE EXCEPTION 'not staff of course tenant';
  END IF;

  INSERT INTO public.notifications (
    title,
    content,
    notification_type,
    priority,
    target_type,
    target_course_id,
    delivery_channels,
    status,
    sent_at,
    created_by,
    tenant_id
  ) VALUES (
    p_title,
    p_body,
    'announcement',
    'normal',
    'course',
    p_course_id,
    ARRAY['in_app']::text[],
    'sent',
    now(),
    (SELECT auth.uid()),
    v_tenant_id
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.student_may_resubmit(integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.post_course_announcement(integer, text, text) TO authenticated;

-- ── calendar view ────────────────────────────────────────────────────────────

DROP VIEW IF EXISTS public.course_calendar_items;
CREATE VIEW public.course_calendar_items AS
SELECT
  a.course_id,
  'assignment'::text AS item_kind,
  a.assignment_id AS item_id,
  a.title,
  a.due_at
FROM public.assignments a
UNION ALL
SELECT
  e.course_id,
  'exam'::text AS item_kind,
  e.exam_id AS item_id,
  e.title,
  e.exam_date AS due_at
FROM public.exams e;

ALTER VIEW public.course_calendar_items SET (security_invoker = true);

REVOKE ALL ON public.course_calendar_items FROM anon;
GRANT SELECT ON public.course_calendar_items TO authenticated;
GRANT SELECT ON public.course_calendar_items TO service_role;
