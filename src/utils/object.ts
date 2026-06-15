export type UnknownRecord = Record<string, unknown>;

export function toRecord(value: unknown): UnknownRecord | undefined {
  return typeof value === "object" && value !== null ? (value as UnknownRecord) : undefined;
}

export function isPlainObject(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function getStringField(
  source: UnknownRecord | undefined,
  field: string,
): string | undefined {
  const value = source?.[field];
  return typeof value === "string" ? value : undefined;
}

export function getNumberField(
  source: UnknownRecord | undefined,
  field: string,
): number | undefined {
  const value = source?.[field];
  return typeof value === "number" ? value : undefined;
}

export function getNonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}
