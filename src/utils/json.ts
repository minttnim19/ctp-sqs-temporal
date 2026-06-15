export function parseJson(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return undefined;
  }
}

export function stringifyUnknown(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";

  try {
    return JSON.stringify(value);
  } catch {
    return "[Circular or Non-serializable]";
  }
}
