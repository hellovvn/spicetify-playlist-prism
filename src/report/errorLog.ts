// Remembers Prism's last few warnings/errors (only "[Prism]" console lines,
// only in memory, only on the Prism page's bundle), so a bug report can include them.
// Nothing is saved to disk. Lines are scrubbed when the report is built (scrubText).

import { LOG_PREFIX } from "../log";
import { logContext, pushRecent } from "./report";

let recent: string[] = [];
let installed = false;

/** Wraps console.warn/error once; the originals still run unchanged. */
export function startErrorLog(): void {
  if (installed) return;
  installed = true;
  for (const level of ["warn", "error"] as const) {
    const original = console[level].bind(console);
    console[level] = (...args: unknown[]) => {
      try {
        const first = args[0];
        if (typeof first === "string" && first.startsWith(LOG_PREFIX)) {
          const error = args.find((a) => a instanceof Error) as Error | undefined;
          const text = logContext(first.slice(LOG_PREFIX.length)) + (error ? `: ${error.message}` : "");
          recent = pushRecent(recent, text);
        }
      } catch {
        // Never let the log break logging.
      }
      original(...args);
    };
  }
}

export function recentErrors(): string[] {
  return [...recent];
}
