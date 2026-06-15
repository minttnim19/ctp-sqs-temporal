import { toKebabCase } from "@/utils/string";

describe("toKebabCase", () => {
  it("converts common activity names to kebab-case", () => {
    expect(toKebabCase("myActivity")).toBe("my-activity");
    expect(toKebabCase("externalAPIActivity")).toBe("external-api-activity");
    expect(toKebabCase("Dummy Workflow.Dispatcher")).toBe("dummy-workflow-dispatcher");
  });
});
