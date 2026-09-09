import { describe, expect, it } from "vitest";
import {
  assignmentCreateRow,
  isCourseInScope,
  parseAutoPublishSetting,
  parseCourseIdsHeader,
  parseLatePolicy,
  publishedFlagForGradeWrite,
} from "../assignment-policy.js";
import { isToolAllowedForRole } from "../tool-policy.js";

describe("lms_create_assignment payload", () => {
  it("defaults late_policy to reject and publishes the assignment", () => {
    const row = assignmentCreateRow(
      { course_id: 4, title: "Essay 1" },
      "user-1",
    );
    expect(row.late_policy).toEqual({ kind: "reject" });
    expect(row.published).toBe(true);
    expect(row.created_by).toBe("user-1");
    expect(row.max_score).toBe(100);
  });

  it("parses a penalize late policy from the model input", () => {
    const row = assignmentCreateRow(
      {
        course_id: 4,
        title: "Essay 1",
        late_policy: { kind: "penalize", percent_per_day: 10 },
      },
      "user-1",
    );
    expect(parseLatePolicy(row.late_policy)).toEqual({
      kind: "penalize",
      percent_per_day: 10,
    });
  });
});

describe("lms_grade_assignment_submission publish gate", () => {
  it("leaves the grade a draft when auto-publish is off", () => {
    expect(publishedFlagForGradeWrite(false, undefined)).toBe(false);
    expect(publishedFlagForGradeWrite(false, true)).toBe(false);
    expect(parseAutoPublishSetting({ enabled: false })).toBe(false);
  });

  it("publishes when auto_publish_grades is on", () => {
    expect(publishedFlagForGradeWrite(true, false)).toBe(true);
    expect(parseAutoPublishSetting({ enabled: true })).toBe(true);
  });
});

describe("course-scope deny", () => {
  it("allows any course when the token has no course_ids", () => {
    expect(isCourseInScope(null, 2)).toBe(true);
  });

  it("rejects a course outside the PAT scope", () => {
    expect(isCourseInScope([1], 2)).toBe(false);
    expect(isCourseInScope([1], 1)).toBe(true);
  });

  it("parses the internal X-Mcp-Course-Ids header", () => {
    expect(parseCourseIdsHeader("1,2")).toEqual([1, 2]);
    expect(parseCourseIdsHeader("")).toBeNull();
  });
});

describe("professor maps to the teacher allow-list", () => {
  it("lets a teacher call assignment tools and not admin-only deletes", () => {
    expect(isToolAllowedForRole("teacher", "lms_create_assignment")).toBe(true);
    expect(isToolAllowedForRole("teacher", "lms_grade_assignment_submission")).toBe(true);
    expect(isToolAllowedForRole("teacher", "lms_publish_grade")).toBe(true);
    expect(isToolAllowedForRole("teacher", "lms_delete_course")).toBe(false);
    expect(isToolAllowedForRole("teacher", "lms_archive_course")).toBe(false);
  });
});
