import { NextResponse, type NextRequest } from "next/server";
import { getCurrentHost } from "@/lib/auth";
import { runDueDigests } from "@/lib/digest";
import { runDueJobs } from "@/lib/messaging/dispatcher";

/** A batch of texts can take a while; the platform default is too tight. */
export const maxDuration = 60;

/**
 * Heartbeat endpoint for an external scheduler (Vercel Cron, a systemd timer,
 * curl in a loop). It only *triggers* the dispatcher; the jobs table is the
 * source of truth, so a missed tick loses nothing.
 */
async function handle(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const presented =
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? req.headers.get("x-cron-secret");
  const authorized = (secret && presented === secret) || (await getCurrentHost()) !== null;
  if (!authorized) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const stats = await runDueJobs();
  const digests = await runDueDigests();
  return NextResponse.json({ ok: true, ...stats, digests });
}

export const GET = handle;
export const POST = handle;
