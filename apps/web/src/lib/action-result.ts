export type ActionResult<T = undefined> =
  | { ok: true; message?: string; data?: T }
  | { ok: false; message: string; fieldErrors?: Record<string, string> };

export function ok<T = undefined>(message?: string, data?: T): ActionResult<T> {
  return { ok: true, ...(message ? { message } : {}), ...(data !== undefined ? { data } : {}) };
}

export function fail(message: string, fieldErrors?: Record<string, string>): ActionResult<never> {
  return { ok: false, message, ...(fieldErrors ? { fieldErrors } : {}) };
}

/** Converte erros do Zod em mensagens por campo (a primeira de cada campo). */
export function zodFieldErrors(issues: { path: PropertyKey[]; message: string }[]): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path.map(String).join(".");
    if (!errors[key]) errors[key] = issue.message;
  }
  return errors;
}
