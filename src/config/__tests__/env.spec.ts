import { normalizeBoolFromEnv, normalizeCsvEnv, resolveQueueNames } from "@/config/env";

describe("config/env", () => {
  describe("resolveQueueNames", () => {
    it("splits a comma-separated string into an array", () => {
      expect(resolveQueueNames({ SQS_QUEUE_NAMES: "q1,q2,q3" } as any)).toEqual(["q1", "q2", "q3"]);
    });

    it("trims whitespace from each queue name", () => {
      expect(resolveQueueNames({ SQS_QUEUE_NAMES: " q1 , q2 " } as any)).toEqual(["q1", "q2"]);
    });

    it("returns empty array for empty string", () => {
      expect(resolveQueueNames({ SQS_QUEUE_NAMES: "" } as any)).toEqual([]);
    });

    it("returns empty array for whitespace-only string", () => {
      expect(resolveQueueNames({ SQS_QUEUE_NAMES: "   " } as any)).toEqual([]);
    });

    it("returns empty array when SQS_QUEUE_NAMES is undefined", () => {
      expect(resolveQueueNames({} as any)).toEqual([]);
    });

    it("filters out empty segments from double commas", () => {
      expect(resolveQueueNames({ SQS_QUEUE_NAMES: "q1,,q2" } as any)).toEqual(["q1", "q2"]);
    });

    it("uses env default when called with no argument", () => {
      // Calling with no argument exercises the default parameter branch (envObj = env)
      const result = resolveQueueNames();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("env schema parsing — BoolFromEnv", () => {
    let savedEnv: NodeJS.ProcessEnv;

    beforeEach(() => {
      savedEnv = { ...process.env };
    });

    afterEach(() => {
      for (const key of Object.keys(process.env)) {
        if (!(key in savedEnv)) delete process.env[key];
      }
      Object.assign(process.env, savedEnv);
    });

    it("parses 'true' as boolean true", async () => {
      await jest.isolateModulesAsync(async () => {
        process.env.LOG_TO_FILE = "true";
        const { env } = await import("@/config/env");
        expect(env.LOG_TO_FILE).toBe(true);
      });
    });

    it("parses '1' as boolean true", async () => {
      await jest.isolateModulesAsync(async () => {
        process.env.LOG_TO_FILE = "1";
        const { env } = await import("@/config/env");
        expect(env.LOG_TO_FILE).toBe(true);
      });
    });

    it("parses 'yes' as boolean true", async () => {
      await jest.isolateModulesAsync(async () => {
        process.env.LOG_TO_FILE = "yes";
        const { env } = await import("@/config/env");
        expect(env.LOG_TO_FILE).toBe(true);
      });
    });

    it("parses 'on' as boolean true", async () => {
      await jest.isolateModulesAsync(async () => {
        process.env.LOG_TO_FILE = "on";
        const { env } = await import("@/config/env");
        expect(env.LOG_TO_FILE).toBe(true);
      });
    });

    it("parses 'y' as boolean true", async () => {
      await jest.isolateModulesAsync(async () => {
        process.env.LOG_TO_FILE = "y";
        const { env } = await import("@/config/env");
        expect(env.LOG_TO_FILE).toBe(true);
      });
    });

    it("parses 'false' as boolean false", async () => {
      await jest.isolateModulesAsync(async () => {
        process.env.LOG_TO_FILE = "false";
        const { env } = await import("@/config/env");
        expect(env.LOG_TO_FILE).toBe(false);
      });
    });

    it("parses '0' as boolean false", async () => {
      await jest.isolateModulesAsync(async () => {
        process.env.LOG_TO_FILE = "0";
        const { env } = await import("@/config/env");
        expect(env.LOG_TO_FILE).toBe(false);
      });
    });

    it("parses 'no' as boolean false", async () => {
      await jest.isolateModulesAsync(async () => {
        process.env.LOG_TO_FILE = "no";
        const { env } = await import("@/config/env");
        expect(env.LOG_TO_FILE).toBe(false);
      });
    });

    it("parses 'off' as boolean false", async () => {
      await jest.isolateModulesAsync(async () => {
        process.env.LOG_TO_FILE = "off";
        const { env } = await import("@/config/env");
        expect(env.LOG_TO_FILE).toBe(false);
      });
    });

    it("parses 'n' as boolean false", async () => {
      await jest.isolateModulesAsync(async () => {
        process.env.LOG_TO_FILE = "n";
        const { env } = await import("@/config/env");
        expect(env.LOG_TO_FILE).toBe(false);
      });
    });

    it("parses '' (empty string) as boolean false", async () => {
      await jest.isolateModulesAsync(async () => {
        process.env.LOG_TO_FILE = "";
        const { env } = await import("@/config/env");
        expect(env.LOG_TO_FILE).toBe(false);
      });
    });

    it("throws ZodError for unrecognized boolean string", async () => {
      await jest.isolateModulesAsync(async () => {
        process.env.LOG_TO_FILE = "maybe";
        await expect(import("@/config/env")).rejects.toThrow();
      });
    });

    it("returns non-string values unchanged in normalizer", () => {
      expect(normalizeBoolFromEnv(true)).toBe(true);
      expect(normalizeBoolFromEnv(undefined)).toBeUndefined();
    });
  });

  describe("env schema parsing — CsvToStringArray", () => {
    let savedEnv: NodeJS.ProcessEnv;

    beforeEach(() => {
      savedEnv = { ...process.env };
    });

    afterEach(() => {
      for (const key of Object.keys(process.env)) {
        if (!(key in savedEnv)) delete process.env[key];
      }
      Object.assign(process.env, savedEnv);
    });

    it("parses comma-separated string to array", () => {
      expect(normalizeCsvEnv("sandbox,uat,prod")).toEqual(["sandbox", "uat", "prod"]);
    });

    it("trims whitespace from CSV items", () => {
      expect(normalizeCsvEnv(" sandbox , uat ")).toEqual(["sandbox", "uat"]);
    });

    it("filters out empty segments", () => {
      expect(normalizeCsvEnv("sandbox,,prod")).toEqual(["sandbox", "prod"]);
    });

    it("returns empty array for empty string", () => {
      expect(normalizeCsvEnv("")).toEqual([]);
    });

    it("returns empty array for non-string values in normalizer", () => {
      expect(normalizeCsvEnv(undefined)).toEqual([]);
      expect(normalizeCsvEnv(["sandbox"])).toEqual([]);
    });
  });
});
