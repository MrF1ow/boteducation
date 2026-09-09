import { describe, expect, it } from "vitest";
import { incomingHeader } from "./session.js";

describe("incomingHeader", () => {
  it("reads Hono RequestContext.request.header()", () => {
    const ctx = {
      request: {
        header: (name: string) =>
          name === "x-mcp-course-ids" ? "1001" : undefined,
      },
    };
    expect(incomingHeader(ctx, "x-mcp-course-ids")).toBe("1001");
  });

  it("reads the Web Request on request.raw.headers", () => {
    const headers = new Headers({ "x-mcp-course-ids": "4,7" });
    const ctx = { request: { raw: { headers } } };
    expect(incomingHeader(ctx, "x-mcp-course-ids")).toBe("4,7");
  });

  it("falls back to a headers record when the Hono request has no value", () => {
    const ctx = {
      request: { header: () => undefined },
      headers: { "x-mcp-course-ids": "1001" },
    };
    expect(incomingHeader(ctx, "x-mcp-course-ids")).toBe("1001");
  });
});
