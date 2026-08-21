// Import global stylesheet so Vitest + Vite will process and inject it for tests
import "../../theme.css";

// Apply the same top-level html class used in index.html so tests receive the
// same background gradient styling.
if (typeof document !== "undefined" && document.documentElement) {
  document.documentElement.classList.add("bg-gradient");
}

// You can add other global test setup here (e.g. testing-library matchers)
// Suppress MSW redundant-start warnings which may be emitted when worker
// is started more than once in different places. We only filter that exact
// message to avoid silencing unrelated warnings.
const originalWarn = console.warn.bind(console);
console.warn = (...args: any[]) => {
  try {
    const msg = String(args[0] ?? "");
    if (msg.includes('Found a redundant "worker.start()" call')) {
      return;
    }
  } catch (e) {
    // ignore
  }
  originalWarn(...args);
};
