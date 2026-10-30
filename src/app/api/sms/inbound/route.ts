import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";

const STOP_WORDS = /^\s*(stop|stopall|unsubscribe|cancel|end|quit)\b/i;
const START_WORDS = /^\s*(start|unstop|yes)\b/i;

/** Twilio signs requests with HMAC-SHA1 over the full URL plus sorted POST params. */
function validTwilioSignature(req: NextRequest, params: URLSearchParams, authToken: string): boolean {
  const signature = req.headers.get("x-twilio-signature");
  if (!signature) return false;
  const url = process.env.TWILIO_WEBHOOK_URL ?? req.url;
  const data = url + [...params.keys()].sort().map((k) => k + params.get(k)).join("");
  const expected = createHmac("sha1", authToken).update(data).digest("base64");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Inbound SMS webhook. Handles STOP / START keywords by updating consent on
 * every contact with that number, and logs everything else for the host.
 */
export async function POST(req: NextRequest) {
  const params = new URLSearchParams(await req.text());
  const provider = (process.env.MESSAGING_PROVIDER ?? "log").toLowerCase();
  if (provider === "twilio") {
    const token = process.env.TWILIO_AUTH_TOKEN;
    if (!token || !validTwilioSignature(req, params, token)) {
      return NextResponse.json({ error: "bad signature" }, { status: 403 });
    }
  }

  const from = params.get("From") ?? "";
  const body = params.get("Body") ?? "";
  if (!from) return NextResponse.json({ error: "missing From" }, { status: 400 });

  const db = await getDb();
  let action = "sms.inbound";
  if (STOP_WORDS.test(body)) {
    await db.update(schema.contacts).set({ consentState: "opted_out" }).where(eq(schema.contacts.phoneE164, from));
    action = "sms.opt_out";
  } else if (START_WORDS.test(body)) {
    await db.update(schema.contacts).set({ consentState: "opted_in" }).where(eq(schema.contacts.phoneE164, from));
    action = "sms.opt_in";
  }
  await db.insert(schema.auditLog).values({ actor: `sms:${from}`, action, metadata: { body: body.slice(0, 500) } });

  // Carriers handle the STOP confirmation text themselves; reply with nothing.
  return new NextResponse("<Response></Response>", { headers: { "Content-Type": "text/xml" } });
}
