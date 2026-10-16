// Błędy serwera (strony, akcje, trasy API) trafiają do app_errors – bez danych osobowych (src/lib/error-report.ts).
import type { Instrumentation } from "next";

export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  // Import w bloku warunku na NEXT_RUNTIME, żeby sterownik bazy nie trafił do paczki Edge.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const error = err as Error & { digest?: string };
    // Przekierowania i „nie znaleziono” to nie błędy.
    if (error?.digest?.startsWith("NEXT_REDIRECT") || error?.digest?.startsWith("NEXT_HTTP_ERROR_FALLBACK")) return;
    const { reportError } = await import("./lib/error-report");
    await reportError({
      kind: "serwer",
      route: `${request.method} ${context.routePath}`.slice(0, 200),
      message: `${error?.name ?? "Error"}: ${error?.message ?? ""}`,
      digest: error?.digest,
    });
  }
};
