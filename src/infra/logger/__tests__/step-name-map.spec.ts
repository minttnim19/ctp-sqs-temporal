import { resolveStepName, STEP_NAME_RULES } from "@/infra/logger/step-name-map";

describe("resolveStepName", () => {
  const originalRules = [...STEP_NAME_RULES];

  beforeEach(() => {
    STEP_NAME_RULES.splice(0, STEP_NAME_RULES.length, ...originalRules);
  });

  afterEach(() => {
    STEP_NAME_RULES.splice(0, STEP_NAME_RULES.length, ...originalRules);
  });

  it("returns activity when no endpoint provided", () => {
    expect(resolveStepName("MY_ACTIVITY")).toBe("MY_ACTIVITY");
  });

  it("returns activity when endpoint is undefined", () => {
    expect(resolveStepName("MY_ACTIVITY", undefined)).toBe("MY_ACTIVITY");
  });

  it("returns activity when no rules are configured", () => {
    expect(STEP_NAME_RULES).toEqual([]);
    expect(resolveStepName("x", "/orders/create", "POST")).toBe("x");
  });
});

describe("resolveStepName with configured rules", () => {
  beforeEach(() => {
    STEP_NAME_RULES.splice(
      0,
      STEP_NAME_RULES.length,
      { type: "exact", endpoint: "/orders/create", method: "POST", step_name: "CREATE_ORDER" },
      { type: "exact", endpoint: "/orders/cancel", method: "POST", step_name: "CANCEL_ORDER" },
      { type: "regex", pattern: /^\/orders\/\d+\/pay$/, method: "POST", step_name: "PAY_ORDER" },
    );
  });

  afterEach(() => {
    STEP_NAME_RULES.splice(0, STEP_NAME_RULES.length);
  });

  it("exact match POST /orders/create -> CREATE_ORDER", () => {
    expect(resolveStepName("x", "/orders/create", "POST")).toBe("CREATE_ORDER");
  });

  it("exact match POST /orders/cancel -> CANCEL_ORDER", () => {
    expect(resolveStepName("x", "/orders/cancel", "POST")).toBe("CANCEL_ORDER");
  });

  it("wrong method for exact rule -> falls through to activity", () => {
    expect(resolveStepName("x", "/orders/create", "GET")).toBe("x");
  });

  it("no method provided -> matches exact rule regardless of rule.method", () => {
    expect(resolveStepName("x", "/orders/create")).toBe("CREATE_ORDER");
  });

  it("regex match /orders/123/pay POST -> PAY_ORDER", () => {
    expect(resolveStepName("x", "/orders/123/pay", "POST")).toBe("PAY_ORDER");
  });

  it("regex no match (non-digit id) -> returns activity", () => {
    expect(resolveStepName("x", "/orders/abc/pay", "POST")).toBe("x");
  });

  it("full URL is normalized to path before matching", () => {
    expect(resolveStepName("x", "https://api.example.com/orders/create", "POST")).toBe(
      "CREATE_ORDER",
    );
  });

  it("URL with query string stripped before matching", () => {
    expect(resolveStepName("x", "/orders/create?foo=bar", "POST")).toBe("CREATE_ORDER");
  });

  it("path without leading slash gets slash prepended", () => {
    expect(resolveStepName("x", "orders/create", "POST")).toBe("CREATE_ORDER");
  });

  it("invalid absolute URL string -> treated as path, no rule matches -> returns activity", () => {
    expect(resolveStepName("x", ":::invalid", "POST")).toBe("x");
  });

  it("invalid http:// URL triggers catch and uses raw value as path", () => {
    // "http://[" starts with "http://" but new URL("http://[") throws Invalid URL
    expect(resolveStepName("x", "http://[", "POST")).toBe("x");
  });

  it("empty string endpoint → returns activity", () => {
    expect(resolveStepName("x", "")).toBe("x");
  });

  it("unknown path → returns activity", () => {
    expect(resolveStepName("MY_ACT", "/unknown/path", "POST")).toBe("MY_ACT");
  });

  it("returns activity when matching rule has an empty step name", () => {
    STEP_NAME_RULES.splice(0, STEP_NAME_RULES.length, {
      type: "exact",
      endpoint: "/empty-step",
      method: "POST",
      step_name: "",
    });

    expect(resolveStepName("MY_ACT", "/empty-step", "POST")).toBe("MY_ACT");
  });

  it("STEP_NAME_RULES can contain configured rules", () => {
    expect(STEP_NAME_RULES).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "exact",
          endpoint: "/orders/create",
          step_name: "CREATE_ORDER",
        }),
        expect.objectContaining({
          type: "exact",
          endpoint: "/orders/cancel",
          step_name: "CANCEL_ORDER",
        }),
        expect.objectContaining({ type: "regex", step_name: "PAY_ORDER" }),
      ]),
    );
  });
});
