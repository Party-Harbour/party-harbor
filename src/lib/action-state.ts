export type ActionState = {
  error?: string;
  message?: string;
  ok?: boolean;
} | null;

export type FormAction = (state: ActionState, formData: FormData) => Promise<ActionState>;

export function str(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v.trim() : "";
}

export function optional(formData: FormData, key: string): string | null {
  const v = str(formData, key);
  return v === "" ? null : v;
}

export function int(formData: FormData, key: string, fallback = 0): number {
  const v = Number.parseInt(str(formData, key), 10);
  return Number.isFinite(v) ? v : fallback;
}
