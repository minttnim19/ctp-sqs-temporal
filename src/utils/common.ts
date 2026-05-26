export function safelyParse<T>(text: string | undefined, fallback: T = {} as T): T {
  try {
    if (!text) return fallback;
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

export function unwrapSnsEnvelope(body: string | undefined): string | undefined {
  if (!body) return body;
  try {
    const obj = JSON.parse(body) as Record<string, unknown> | unknown[];
    if (obj && typeof obj === "object" && !Array.isArray(obj)) {
      const maybeType = obj["Type"];
      const maybeMsg = obj["Message"];

      if (typeof maybeType === "string" && "TopicArn" in obj && typeof maybeMsg === "string") {
        return maybeMsg;
      }
    }
    return body;
  } catch {
    return body;
  }
}
