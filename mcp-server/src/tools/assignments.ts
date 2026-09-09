import { z } from "zod";
import type { LmsServer } from "../server-types.js";
import { LmsSession } from "../session.js";
import { ok, errorResult, PaginationSchema, ResponseFormat } from "../format.js";
import {
  assignmentCreateRow,
  parseAutoPublishSetting,
  parseLatePolicy,
  publishedFlagForGradeWrite,
} from "../assignment-policy.js";

const LatePolicySchema = z.union([
  z.object({ kind: z.literal("reject") }),
  z.object({ kind: z.literal("accept") }),
  z.object({ kind: z.literal("accept_until"), until: z.string() }),
  z.object({ kind: z.literal("penalize"), percent_per_day: z.number() }),
]);

function trySession(
  ctx: unknown,
): { session: LmsSession } | { error: ReturnType<typeof errorResult> } {
  try {
    return { session: LmsSession.fromContext(ctx) };
  } catch (err) {
    return { error: errorResult(err instanceof Error ? err.message : String(err)) };
  }
}

async function courseIdForAssignment(
  session: LmsSession,
  assignmentId: number,
): Promise<number> {
  const { data, error } = await session
    .getClient()
    .from("assignments")
    .select("course_id")
    .eq("assignment_id", assignmentId)
    .maybeSingle();
  if (error || !data) throw new Error(`Assignment ${assignmentId} not found`);
  session.assertCourseInScope(data.course_id);
  return data.course_id;
}

async function autoPublishEnabled(session: LmsSession): Promise<boolean> {
  const { data } = await session
    .getClient()
    .from("tenant_settings")
    .select("setting_value")
    .eq("tenant_id", session.getTenantId())
    .eq("setting_key", "auto_publish_grades")
    .maybeSingle();
  return parseAutoPublishSetting(data?.setting_value);
}

export function registerAssignmentTools(server: LmsServer) {
  server.tool(
    {
      name: "lms_create_assignment",
      description:
        "Create a homework assignment on a course. due_at is ISO-8601. late_policy kinds are reject, accept, accept_until, penalize.",
      schema: z.object({
        course_id: z.number(),
        title: z.string().min(1).max(100),
        body: z.string().optional(),
        due_at: z.string().optional(),
        late_policy: LatePolicySchema.optional(),
        max_score: z.number().positive().optional(),
        rubric: z.unknown().optional(),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (input, ctx) => {
      const loaded = trySession(ctx);
      if ("error" in loaded) return loaded.error;
      const { session } = loaded;
      try {
        session.assertCourseInScope(input.course_id);
        await session.verifyCourseAccess(input.course_id);
        const { data, error } = await session
          .getClient()
          .from("assignments")
          .insert(assignmentCreateRow(input, session.getUserId()))
          .select("assignment_id, course_id, title, due_at, max_score")
          .single();
        if (error || !data) return errorResult(error?.message ?? "Create failed");
        return ok(data, JSON.stringify(data));
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    },
  );

  server.tool(
    {
      name: "lms_update_assignment",
      description: "Update a homework assignment's title, body, due date, late policy, or rubric.",
      schema: z.object({
        assignment_id: z.number(),
        title: z.string().min(1).max(100).optional(),
        body: z.string().optional(),
        due_at: z.string().nullable().optional(),
        late_policy: LatePolicySchema.optional(),
        max_score: z.number().positive().optional(),
        rubric: z.unknown().optional(),
        published: z.boolean().optional(),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (input, ctx) => {
      const loaded = trySession(ctx);
      if ("error" in loaded) return loaded.error;
      const { session } = loaded;
      try {
        const courseId = await courseIdForAssignment(session, input.assignment_id);
        await session.verifyCourseAccess(courseId);
        const patch: Record<string, unknown> = {};
        if (input.title !== undefined) patch.title = input.title;
        if (input.body !== undefined) patch.body = input.body;
        if (input.due_at !== undefined) patch.due_at = input.due_at;
        if (input.late_policy !== undefined) patch.late_policy = parseLatePolicy(input.late_policy);
        if (input.max_score !== undefined) patch.max_score = input.max_score;
        if (input.rubric !== undefined) patch.rubric = input.rubric;
        if (input.published !== undefined) patch.published = input.published;
        const { data, error } = await session
          .getClient()
          .from("assignments")
          .update(patch)
          .eq("assignment_id", input.assignment_id)
          .select("assignment_id, title, due_at, published")
          .single();
        if (error || !data) return errorResult(error?.message ?? "Update failed");
        return ok(data, JSON.stringify(data));
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    },
  );

  server.tool(
    {
      name: "lms_set_deadline",
      description: "Set or clear an assignment due_at timestamp.",
      schema: z.object({
        assignment_id: z.number(),
        due_at: z.string().nullable(),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (input, ctx) => {
      const loaded = trySession(ctx);
      if ("error" in loaded) return loaded.error;
      const { session } = loaded;
      try {
        const courseId = await courseIdForAssignment(session, input.assignment_id);
        await session.verifyCourseAccess(courseId);
        const { data, error } = await session
          .getClient()
          .from("assignments")
          .update({ due_at: input.due_at })
          .eq("assignment_id", input.assignment_id)
          .select("assignment_id, due_at")
          .single();
        if (error || !data) return errorResult(error?.message ?? "Deadline update failed");
        return ok(data, JSON.stringify(data));
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    },
  );

  server.tool(
    {
      name: "lms_list_submissions",
      description: "List homework submissions for an assignment.",
      schema: z.object({
        ...PaginationSchema,
        assignment_id: z.number(),
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (input, ctx) => {
      const loaded = trySession(ctx);
      if ("error" in loaded) return loaded.error;
      const { session } = loaded;
      try {
        const courseId = await courseIdForAssignment(session, input.assignment_id);
        await session.verifyCourseAccess(courseId);
        const { data, error, count } = await session
          .getClient()
          .from("submissions")
          .select("submission_id, student_id, status, submitted_at, body", { count: "exact" })
          .eq("assignment_id", input.assignment_id)
          .order("submitted_at", { ascending: false })
          .range(input.offset, input.offset + input.limit - 1);
        if (error) return errorResult(error.message);
        const output = { total: count ?? 0, submissions: data ?? [] };
        if (input.response_format === ResponseFormat.JSON) {
          return ok(output, JSON.stringify(output, null, 2));
        }
        return ok(output, `Found ${output.total} submissions.`);
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    },
  );

  server.tool(
    {
      name: "lms_get_submission",
      description: "Get one homework submission by submission_id.",
      schema: z.object({ submission_id: z.number() }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (input, ctx) => {
      const loaded = trySession(ctx);
      if ("error" in loaded) return loaded.error;
      const { session } = loaded;
      try {
        const { data, error } = await session
          .getClient()
          .from("submissions")
          .select("submission_id, assignment_id, student_id, status, submitted_at, body, files")
          .eq("submission_id", input.submission_id)
          .maybeSingle();
        if (error || !data) return errorResult("Submission not found");
        await courseIdForAssignment(session, data.assignment_id);
        return ok(data, JSON.stringify(data));
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    },
  );

  server.tool(
    {
      name: "lms_grade_assignment_submission",
      description:
        "Grade a homework submission. Leaves published=false unless tenant auto_publish_grades is on. Call lms_publish_grade to release a draft.",
      schema: z.object({
        submission_id: z.number(),
        score: z.number(),
        feedback: z.string().optional(),
        published: z.boolean().optional(),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (input, ctx) => {
      const loaded = trySession(ctx);
      if ("error" in loaded) return loaded.error;
      const { session } = loaded;
      try {
        const { data: sub, error: subErr } = await session
          .getClient()
          .from("submissions")
          .select("submission_id, assignment_id, student_id")
          .eq("submission_id", input.submission_id)
          .maybeSingle();
        if (subErr || !sub) return errorResult("Submission not found");
        const courseId = await courseIdForAssignment(session, sub.assignment_id);
        await session.verifyCourseAccess(courseId);
        const auto = await autoPublishEnabled(session);
        const published = publishedFlagForGradeWrite(auto, input.published);
        const gradeRow = {
          submission_id: sub.submission_id,
          student_id: sub.student_id,
          course_id: courseId,
          score: input.score,
          feedback: input.feedback ?? null,
          graded_by: session.getUserId(),
          published,
          source: "ai",
        };
        const existing = await session
          .getClient()
          .from("grades")
          .select("grade_id")
          .eq("submission_id", sub.submission_id)
          .maybeSingle();
        const written = existing.data?.grade_id
          ? await session
              .getClient()
              .from("grades")
              .update(gradeRow)
              .eq("grade_id", existing.data.grade_id)
              .select("grade_id, submission_id, score, published")
              .single()
          : await session
              .getClient()
              .from("grades")
              .insert(gradeRow)
              .select("grade_id, submission_id, score, published")
              .single();
        const { data, error } = written;
        if (error || !data) return errorResult(error?.message ?? "Grade failed");
        const note = published
          ? "Grade is published (auto_publish_grades is on)."
          : "Grade is a draft. Call lms_publish_grade to release it.";
        return ok(data, `${note}\n${JSON.stringify(data)}`);
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    },
  );

  server.tool(
    {
      name: "lms_publish_grade",
      description: "Publish a draft homework grade so the student can read the score.",
      schema: z.object({
        grade_id: z.number().optional(),
        submission_id: z.number().optional(),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (input, ctx) => {
      const loaded = trySession(ctx);
      if ("error" in loaded) return loaded.error;
      const { session } = loaded;
      if (input.grade_id === undefined && input.submission_id === undefined) {
        return errorResult("Provide grade_id or submission_id");
      }
      try {
        let query = session.getClient().from("grades").select("grade_id, submission_id, course_id, published");
        if (input.grade_id !== undefined) query = query.eq("grade_id", input.grade_id);
        if (input.submission_id !== undefined) query = query.eq("submission_id", input.submission_id);
        const { data: row, error: findErr } = await query.maybeSingle();
        if (findErr || !row) return errorResult("Grade not found");
        session.assertCourseInScope(row.course_id);
        await session.verifyCourseAccess(row.course_id);
        const { data, error } = await session
          .getClient()
          .from("grades")
          .update({ published: true })
          .eq("grade_id", row.grade_id)
          .select("grade_id, score, published")
          .single();
        if (error || !data) return errorResult(error?.message ?? "Publish failed");
        return ok(data, JSON.stringify(data));
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    },
  );

  server.tool(
    {
      name: "lms_post_announcement",
      description: "Post an in-app course announcement. Does not send email.",
      schema: z.object({
        course_id: z.number(),
        title: z.string().min(1),
        body: z.string().min(1),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (input, ctx) => {
      const loaded = trySession(ctx);
      if ("error" in loaded) return loaded.error;
      const { session } = loaded;
      try {
        session.assertCourseInScope(input.course_id);
        await session.verifyCourseAccess(input.course_id);
        const { data, error } = await session.getClient().rpc("post_course_announcement", {
          p_course_id: input.course_id,
          p_title: input.title,
          p_body: input.body,
        });
        if (error) return errorResult(error.message);
        return ok({ notification_id: data }, `Posted announcement ${data}`);
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    },
  );

  server.tool(
    {
      name: "lms_get_gradebook",
      description: "List homework grades and exam scores for a course.",
      schema: z.object({
        ...PaginationSchema,
        course_id: z.number(),
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (input, ctx) => {
      const loaded = trySession(ctx);
      if ("error" in loaded) return loaded.error;
      const { session } = loaded;
      try {
        session.assertCourseInScope(input.course_id);
        await session.verifyCourseAccess(input.course_id);
        const supabase = session.getClient();
        const [hw, examRows] = await Promise.all([
          supabase
            .from("grades")
            .select("grade_id, student_id, score, published, submission_id")
            .eq("course_id", input.course_id),
          supabase
            .from("exams")
            .select("exam_id, exam_scores(score_id, student_id, score)")
            .eq("course_id", input.course_id),
        ]);
        const output = {
          homework: hw.data ?? [],
          exams: examRows.data ?? [],
        };
        return ok(output, JSON.stringify(output, null, 2));
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    },
  );

  server.tool(
    {
      name: "lms_list_roster",
      description: "List students enrolled in a course. Alias of the enrollment roster.",
      schema: z.object({
        ...PaginationSchema,
        course_id: z.number(),
        status: z.enum(["active", "disabled"]).optional(),
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (input, ctx) => {
      const loaded = trySession(ctx);
      if ("error" in loaded) return loaded.error;
      const { session } = loaded;
      try {
        session.assertCourseInScope(input.course_id);
        await session.verifyCourseAccess(input.course_id);
        let query = session
          .getClient()
          .from("enrollments")
          .select("enrollment_id, status, enrollment_date, user_id", { count: "exact" })
          .eq("course_id", input.course_id)
          .order("enrollment_date", { ascending: false })
          .range(input.offset, input.offset + input.limit - 1);
        if (input.status) query = query.eq("status", input.status);
        const { data, error, count } = await query;
        if (error) return errorResult(error.message);
        const output = { total: count ?? 0, roster: data ?? [] };
        return ok(output, JSON.stringify(output, null, 2));
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    },
  );
}
