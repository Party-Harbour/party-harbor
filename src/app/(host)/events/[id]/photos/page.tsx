import Link from "next/link";
import { notFound } from "next/navigation";
import { approveAllPending, deletePhoto, setCoverPhoto, setPhotoState, updateGallerySettings } from "@/actions/photos";
import { ActionForm } from "@/components/action-form";
import { PhotoGrid, PhotoTile, smallActionClass, smallDangerClass } from "@/components/photo-tile";
import { PhotoUpload } from "@/components/photo-upload";
import { Button, Card, EmptyState, Field, Pill, SectionTitle, Select, Stat } from "@/components/ui";
import type { Event } from "@/db/schema";
import { formatDateTime } from "@/lib/dates";
import { listEventPhotos, maxPhotosPerEvent, type PhotoRow } from "@/lib/gallery";
import { photoUrl } from "@/lib/gallery/urls";
import { getEvent } from "@/lib/queries";

const POLICY_LABEL: Record<Event["galleryPolicy"], string> = {
  hidden: "Hidden from guests",
  view: "Guests can view",
  contribute: "Guests can view and add photos",
};

export default async function PhotosPage({ params, searchParams }: PageProps<"/events/[id]/photos">) {
  const { id } = await params;
  const { photos: uploaded, photoError } = await searchParams;
  const event = await getEvent(id);
  if (!event) notFound();
  const all = await listEventPhotos(id);
  const pending = all.filter((p) => p.state === "pending");
  const visible = all.filter((p) => p.state === "visible");
  const hidden = all.filter((p) => p.state === "hidden");
  const bytes = all.reduce((n, p) => n + p.bytes, 0);
  const returnTo = `/events/${id}/photos`;

  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <div className="space-y-6">
        {uploaded || photoError ? (
          <div className="space-y-2">
            {uploaded ? (
              <p role="status" className="rounded-md bg-sage/40 px-3 py-2 text-sm text-navy">
                {uploaded} photo{uploaded === "1" ? "" : "s"} added.
              </p>
            ) : null}
            {photoError ? (
              <p role="alert" className="rounded-md bg-coral/20 px-3 py-2 text-sm text-navy">
                {photoError}
              </p>
            ) : null}
          </div>
        ) : null}

        <Card>
          <SectionTitle>Add photos</SectionTitle>
          <PhotoUpload fields={{ eventId: id }} returnTo={returnTo} />
        </Card>

        {pending.length > 0 ? (
          <section>
            <div className="mb-3 flex items-center justify-between">
              <SectionTitle>Waiting for approval ({pending.length})</SectionTitle>
              <form action={approveAllPending}>
                <input type="hidden" name="eventId" value={id} />
                <Button type="submit" variant="ghost" className="border border-navy/20">
                  Approve all
                </Button>
              </form>
            </div>
            <PhotoGrid>
              {pending.map((p) => (
                <HostTile key={p.id} photo={p} eventId={id} event={event} />
              ))}
            </PhotoGrid>
          </section>
        ) : null}

        <section>
          <SectionTitle>Gallery ({visible.length})</SectionTitle>
          {visible.length === 0 ? (
            <EmptyState>
              No photos yet. Add some above{event.galleryPolicy === "contribute" ? ", or guests can add theirs from their invitation link" : ""}.
            </EmptyState>
          ) : (
            <PhotoGrid>
              {visible.map((p) => (
                <HostTile key={p.id} photo={p} eventId={id} event={event} />
              ))}
            </PhotoGrid>
          )}
        </section>

        {hidden.length > 0 ? (
          <details>
            <summary className="cursor-pointer text-sm font-medium text-navy/70">Hidden photos ({hidden.length})</summary>
            <div className="mt-3">
              <PhotoGrid>
                {hidden.map((p) => (
                  <HostTile key={p.id} photo={p} eventId={id} event={event} />
                ))}
              </PhotoGrid>
            </div>
          </details>
        ) : null}
      </div>

      <div className="space-y-4">
        <Card>
          <SectionTitle>Guest access</SectionTitle>
          <ActionForm action={updateGallerySettings.bind(null, id)} className="space-y-3">
            <Field label="On the invitation page" name="galleryPolicy">
              <Select id="f-galleryPolicy" name="galleryPolicy" defaultValue={event.galleryPolicy}>
                {(Object.keys(POLICY_LABEL) as Event["galleryPolicy"][]).map((p) => (
                  <option key={p} value={p}>
                    {POLICY_LABEL[p]}
                  </option>
                ))}
              </Select>
            </Field>
            <label className="flex min-h-10 items-center gap-2 text-sm text-navy">
              <input type="checkbox" name="galleryAutoApprove" defaultChecked={event.galleryAutoApprove} className="h-4 w-4 accent-navy" />
              Show guest photos right away (otherwise they wait for your approval)
            </label>
            <Button type="submit" variant="ghost" className="border border-navy/20">
              Save
            </Button>
          </ActionForm>
          <p className="mt-3 text-xs text-navy/60">
            Only households with a live invitation link can see the gallery. Photos are resized and stripped of location data when they arrive. Nothing is ever public.
          </p>
        </Card>
        <Card>
          <SectionTitle>Storage</SectionTitle>
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Photos" value={all.length} hint={`of ${maxPhotosPerEvent()} allowed`} />
            <Stat label="Size" value={formatBytes(bytes)} hint="after resizing" />
          </div>
          <div className="mt-3 text-xs text-navy/60">
            Cover: {event.coverPhotoId ? "a gallery photo" : event.coverImageUrl ? "the pasted link" : "themed artwork"}.{" "}
            {event.coverPhotoId ? (
              <form action={setCoverPhoto} className="inline">
                <input type="hidden" name="eventId" value={id} />
                <input type="hidden" name="photoId" value="" />
                <button type="submit" className="underline">
                  Clear cover photo
                </button>
              </form>
            ) : (
              <>
                Pick one with “Use as cover”, or paste a link on the{" "}
                <Link href={`/events/${id}/edit`} className="underline">
                  Edit
                </Link>{" "}
                tab.
              </>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function HostTile({ photo, eventId, event }: { photo: PhotoRow; eventId: string; event: Event }) {
  const isCover = event.coverPhotoId === photo.id;
  const byline = [photo.uploaderName ?? "Host", formatDateTime(photo.createdAt, event.timezone)].join(" · ");
  const action = (state: PhotoRow["state"], label: string, cls = smallActionClass) => (
    <form action={setPhotoState}>
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="photoId" value={photo.id} />
      <input type="hidden" name="state" value={state} />
      <button type="submit" className={cls}>
        {label}
      </button>
    </form>
  );
  return (
    <PhotoTile
      photo={photo}
      byline={photo.entryName ? `${byline} · entry: ${photo.entryName}` : byline}
      badge={
        isCover ? <Pill tone="info">Cover</Pill> : photo.state === "pending" ? <Pill tone="warn">Pending</Pill> : photo.state === "hidden" ? <Pill tone="neutral">Hidden</Pill> : null
      }
      actions={
        <>
          {photo.state === "pending" ? action("visible", "Approve") : null}
          {photo.state === "visible" ? action("hidden", "Hide") : null}
          {photo.state === "hidden" ? action("visible", "Show") : null}
          {photo.state === "visible" && !isCover ? (
            <form action={setCoverPhoto}>
              <input type="hidden" name="eventId" value={eventId} />
              <input type="hidden" name="photoId" value={photo.id} />
              <button type="submit" className={smallActionClass}>
                Use as cover
              </button>
            </form>
          ) : null}
          <a href={photoUrl(photo.id, "full", { download: true })} className={smallActionClass + " inline-flex items-center"}>
            Download
          </a>
          <form action={deletePhoto}>
            <input type="hidden" name="eventId" value={eventId} />
            <input type="hidden" name="photoId" value={photo.id} />
            <button type="submit" className={smallDangerClass}>
              Delete
            </button>
          </form>
        </>
      }
    />
  );
}

function formatBytes(n: number): string {
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
