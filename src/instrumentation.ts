/**
 * Dev/self-hosted heartbeat: once a minute, send whatever is due. On a
 * serverless host this does nothing useful; point a cron at /api/cron/dispatch
 * instead. Set MESSAGING_HEARTBEAT=off to disable.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.MESSAGING_HEARTBEAT === "off") return;
  const g = globalThis as unknown as { __phHeartbeat?: ReturnType<typeof setInterval> };
  if (g.__phHeartbeat) return;
  const { runDueJobs } = await import("./lib/messaging/dispatcher");
  g.__phHeartbeat = setInterval(() => {
    runDueJobs().catch((err) => console.error("[messaging heartbeat]", err));
  }, 60_000);
  g.__phHeartbeat.unref?.();
}
