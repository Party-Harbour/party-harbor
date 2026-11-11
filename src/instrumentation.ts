/**
 * Dev/self-hosted heartbeat: once a minute, send whatever is due. Skipped on
 * Vercel, where instances freeze between requests: there a scheduler calls
 * /api/cron/dispatch instead (see docs/hosting.md). Set MESSAGING_HEARTBEAT=off
 * to disable it anywhere else.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.MESSAGING_HEARTBEAT === "off" || process.env.VERCEL) return;
  const g = globalThis as unknown as { __phHeartbeat?: ReturnType<typeof setInterval> };
  if (g.__phHeartbeat) return;
  const { runDueJobs } = await import("./lib/messaging/dispatcher");
  const { runDueDigests } = await import("./lib/digest");
  g.__phHeartbeat = setInterval(() => {
    runDueJobs().catch((err) => console.error("[messaging heartbeat]", err));
    runDueDigests().catch((err) => console.error("[digest heartbeat]", err));
  }, 60_000);
  g.__phHeartbeat.unref?.();
}
