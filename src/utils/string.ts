export function toKebabCase(value: string): string {
  return value
    .trim()
    .replace(/([A-Z])(?=[A-Z][a-z])/g, "$1-")
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replaceAll(/[-_.\s]+/g, "-")
    .replaceAll(/[^\w-]/g, "")
    .replaceAll(/-+/g, "-")
    .replace(/(^-)|(-$)/g, "")
    .toLowerCase();
}
