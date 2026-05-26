import { safelyParse, unwrapSnsEnvelope } from "@/utils/common";

describe("utils/common - safelyParse", () => {
  it("returns fallback when input is undefined", () => {
    expect(safelyParse(undefined, { a: 1 })).toEqual({ a: 1 });
  });

  it("returns parsed object when JSON is valid", () => {
    expect(safelyParse<{ x: number }>(JSON.stringify({ x: 42 }))).toEqual({ x: 42 });
  });

  it("returns fallback when JSON is invalid", () => {
    expect(safelyParse("{invalid", 123)).toBe(123);
  });
});

describe("utils/common - unwrapSnsEnvelope", () => {
  it("returns undefined body", () => {
    expect(unwrapSnsEnvelope(undefined)).toBe(undefined);
  });

  it("returns same body when not SNS envelope", () => {
    const body = JSON.stringify({ foo: "bar" });
    expect(unwrapSnsEnvelope(body)).toBe(body);
  });

  it("returns Message field when SNS-like envelope", () => {
    const msg = JSON.stringify({ payload: 1 });
    const body = JSON.stringify({
      Type: "Notification",
      MessageId: "mid",
      TopicArn: "arn:aws:sns:...",
      Message: msg,
    });
    expect(unwrapSnsEnvelope(body)).toBe(msg);
  });

  it("returns original body when parse fails", () => {
    const body = "{not-json";
    expect(unwrapSnsEnvelope(body)).toBe(body);
  });

  it("returns original when parsed is array", () => {
    const body = JSON.stringify([1, 2, 3]);
    expect(unwrapSnsEnvelope(body)).toBe(body);
  });

  it("returns original when Type exists but TopicArn/Message invalid", () => {
    const body = JSON.stringify({ Type: "Notification", Message: 123, Other: true });
    expect(unwrapSnsEnvelope(body)).toBe(body);
  });
});
