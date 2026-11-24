/**
 * Class composition helper. Keeps component call-sites declarative without
 * pulling in a runtime dependency. Falsy values are dropped.
 */
export type ClassValue = string | false | null | undefined;

export function cn(...values: ClassValue[]): string {
  return values.filter(Boolean).join(" ");
}
