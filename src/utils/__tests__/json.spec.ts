import { parseJson, stringifyUnknown } from "@/utils/json";

describe("utils/json", () => {
  it("parses valid JSON text", () => {
    expect(parseJson(JSON.stringify({ ok: true }))).toEqual({ ok: true });
  });

  it("returns undefined when JSON text is invalid", () => {
    expect(parseJson("{invalid")).toBeUndefined();
  });

  it("stringifies unknown values for log payloads", () => {
    expect(stringifyUnknown("raw")).toBe("raw");
    expect(stringifyUnknown(null)).toBe("");
    expect(stringifyUnknown(undefined)).toBe("");
    expect(stringifyUnknown({ ok: true })).toBe(JSON.stringify({ ok: true }));
  });

  it("returns fallback text for circular values", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    expect(stringifyUnknown(circular)).toBe("[Circular or Non-serializable]");
  });
});
