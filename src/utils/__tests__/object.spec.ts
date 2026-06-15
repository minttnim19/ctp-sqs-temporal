import {
  getNonEmptyString,
  getNumberField,
  getStringField,
  isPlainObject,
  toRecord,
} from "@/utils/object";

describe("utils/object", () => {
  it("detects plain objects", () => {
    expect(isPlainObject({ ok: true })).toBe(true);
    expect(isPlainObject([])).toBe(false);
    expect(isPlainObject(null)).toBe(false);
    expect(isPlainObject("value")).toBe(false);
  });

  it("casts object values to records", () => {
    expect(toRecord({ id: 1 })).toEqual({ id: 1 });
    expect(toRecord(["x"])).toEqual(["x"]);
    expect(toRecord(null)).toBeUndefined();
    expect(toRecord("value")).toBeUndefined();
  });

  it("gets typed fields from records", () => {
    const record = { text: "hello", count: 3, other: false };

    expect(getStringField(record, "text")).toBe("hello");
    expect(getStringField(record, "count")).toBeUndefined();
    expect(getNumberField(record, "count")).toBe(3);
    expect(getNumberField(record, "text")).toBeUndefined();
  });

  it("gets non-empty strings", () => {
    expect(getNonEmptyString("hello")).toBe("hello");
    expect(getNonEmptyString("   ")).toBeUndefined();
    expect(getNonEmptyString(123)).toBeUndefined();
  });
});
