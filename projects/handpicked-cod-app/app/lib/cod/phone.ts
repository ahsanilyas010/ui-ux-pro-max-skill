/**
 * Pakistani mobile number normalisation.
 * Accepts 03XXXXXXXXX, 3XXXXXXXXX, 923XXXXXXXXX, +923XXXXXXXXX, 00923XXXXXXXXX
 * (spaces, dashes, dots and brackets ignored). Landlines and short numbers are rejected.
 * Returns +923XXXXXXXXX or null.
 */
export function normalisePkMobile(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const digits = input.replace(/[^\d]/g, "");
  const match = /^(?:0092|92|0)?(3\d{9})$/.exec(digits);
  if (!match) return null;
  return `+92${match[1]}`;
}

/** Local display form: 03XX XXXXXXX */
export function formatPkMobileLocal(normalised: string): string {
  const m = /^\+92(3\d{2})(\d{7})$/.exec(normalised);
  return m ? `0${m[1]} ${m[2]}` : normalised;
}
