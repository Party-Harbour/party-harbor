import type { Event } from "@/db/schema";
import { EVENT_STATUSES } from "@/db/schema";
import { COMMON_TIME_ZONES, defaultTimeZone, utcToWall } from "@/lib/dates";
import { THEMES } from "@/lib/themes";
import type { FormAction } from "@/lib/action-state";
import { ActionForm } from "./action-form";
import { Button, EVENT_STATUS_LABEL, Field, Select, TextArea, inputClass } from "./ui";

export function EventForm({
  event,
  action,
  submitLabel,
}: {
  event?: Event;
  action: FormAction;
  submitLabel: string;
}) {
  const tz = event?.timezone ?? defaultTimeZone();
  const zones = COMMON_TIME_ZONES.includes(tz) ? COMMON_TIME_ZONES : [tz, ...COMMON_TIME_ZONES];
  const wall = (d: Date | null | undefined) => (d ? utcToWall(d, tz) : "");

  return (
    <ActionForm action={action} className="space-y-5">
      <Field label="Title" name="title" defaultValue={event?.title ?? ""} required maxLength={120} />
      <Field label="Description" name="description">
        <TextArea id="f-description" name="description" defaultValue={event?.description ?? ""} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Starts"
          name="startsAt"
          type="datetime-local"
          defaultValue={wall(event?.startsAt)}
          required
        />
        <Field label="Ends (optional)" name="endsAt" type="datetime-local" defaultValue={wall(event?.endsAt)} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Time zone" name="timezone">
          <Select id="f-timezone" name="timezone" defaultValue={tz}>
            {zones.map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label="RSVP deadline (optional)"
          name="rsvpDeadline"
          type="datetime-local"
          defaultValue={wall(event?.rsvpDeadline)}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Venue name" name="venueName" defaultValue={event?.venueName ?? ""} />
        <Field label="Address" name="venueAddress" defaultValue={event?.venueAddress ?? ""} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Theme" name="theme" hint="Sets the look of the guest page and cover art.">
          <Select id="f-theme" name="theme" defaultValue={event?.theme ?? "coastal"}>
            {Object.values(THEMES).map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label="Cover photo link (optional)"
          name="coverImageUrl"
          type="url"
          placeholder="https://…"
          defaultValue={event?.coverImageUrl ?? ""}
          hint="Leave blank for themed artwork, or pick an uploaded photo on the Photos tab."
        />
      </div>
      <Field label="What to bring" name="whatToBring">
        <TextArea id="f-whatToBring" name="whatToBring" defaultValue={event?.whatToBring ?? ""} />
      </Field>
      {event ? (
        <Field label="Status" name="status">
          <Select id="f-status" name="status" defaultValue={event.status} className={inputClass}>
            {EVENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {EVENT_STATUS_LABEL[s]}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}
      <div className="flex gap-2">
        <Button type="submit">{submitLabel}</Button>
      </div>
    </ActionForm>
  );
}
