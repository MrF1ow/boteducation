import { z } from "zod";
import type { LmsServer } from "../server-types.js";
import { LmsSession } from "../session.js";
import { ok, errorResult } from "../format.js";

/**
 * Self-enrollment tool. Delegates entirely to the self_enroll_school_course
 * RPC (SECURITY DEFINER, auth.uid()-scoped) — the same one
 * lib/hooks/use-enrollment.ts calls from the app. It writes a `free`
 * entitlement plus an enrollment row when the caller is an active member of
 * the course's tenant and the course is published. The RPC raises otherwise,
 * and its message is surfaced back to the student verbatim.
 */
export function registerEnrollTools(server: LmsServer) {
  server.tool(
    {
      name: "lms_enroll_in_course",
      description:
        "Self-enroll the caller in a published course of their school. Tenant members may enroll without a subscription. Use this when a student wants to start a course from lms_browse_catalog. Fails if the course is unpublished or belongs to another school.",
      schema: z.object({
        course_id: z.number().describe("The course ID to enroll in"),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (input, ctx) => {
      let session: LmsSession;
      try {
        session = LmsSession.fromContext(ctx);
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }

      try {
        const { error } = await session
          .getClient()
          .rpc("self_enroll_school_course", {
            _course_id: input.course_id,
          });

        if (error) return errorResult(error.message);

        return ok(
          { course_id: input.course_id, enrolled: true },
          `Enrolled in course ${input.course_id}.`
        );
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    }
  );
}
