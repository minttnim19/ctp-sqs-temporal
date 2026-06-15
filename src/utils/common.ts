import { parseJson } from "@/utils/json";
import { isPlainObject } from "@/utils/object";

export function safelyParse<T>(text: string | undefined, fallback: T = {} as T): T {
  if (!text) return fallback;
  return (parseJson(text) as T | undefined) ?? fallback;
}

export function unwrapSnsEnvelope(body: string | undefined): string | undefined {
  if (!body) return body;
  const obj = parseJson(body);
  if (isPlainObject(obj)) {
    const maybeType = obj["Type"];
    const maybeMsg = obj["Message"];

    if (typeof maybeType === "string" && "TopicArn" in obj && typeof maybeMsg === "string") {
      return maybeMsg;
    }
  }
  return body;
}
