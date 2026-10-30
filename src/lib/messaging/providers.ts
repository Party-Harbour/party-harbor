import "server-only";

export type SendResult = {
  providerMessageId: string | null;
  status: string;
};

export interface SmsProvider {
  readonly name: string;
  send(input: { to: string; body: string; idempotencyKey: string }): Promise<SendResult>;
}

/** Local development: records the send and prints it, nothing leaves the machine. */
class LogProvider implements SmsProvider {
  readonly name = "log";
  async send({ to, body }: { to: string; body: string }): Promise<SendResult> {
    console.log(`[sms:log] → ${to}\n${body.replace(/^/gm, "    ")}`);
    return { providerMessageId: `log-${Date.now().toString(36)}`, status: "logged" };
  }
}

/** Twilio via its REST API. Needs TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_FROM. */
class TwilioProvider implements SmsProvider {
  readonly name = "twilio";
  constructor(
    private sid: string,
    private token: string,
    private from: string,
  ) {}
  async send({ to, body }: { to: string; body: string }): Promise<SendResult> {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${this.sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: "Basic " + Buffer.from(`${this.sid}:${this.token}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: to, From: this.from, Body: body }),
    });
    const json = (await res.json().catch(() => ({}))) as { sid?: string; status?: string; message?: string };
    if (!res.ok) throw new Error(`Twilio ${res.status}: ${json.message ?? "send failed"}`);
    return { providerMessageId: json.sid ?? null, status: json.status ?? "queued" };
  }
}

export function getSmsProvider(): SmsProvider {
  const which = (process.env.MESSAGING_PROVIDER ?? "log").toLowerCase();
  if (which === "twilio") {
    const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM } = process.env;
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM) {
      throw new Error("MESSAGING_PROVIDER=twilio needs TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_FROM");
    }
    return new TwilioProvider(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM);
  }
  return new LogProvider();
}
