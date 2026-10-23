"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Button, ButtonLink, Card, Chip, Dot, Field, Notice, Select, formInputClass, inputClass } from "@/components/bits";
import { Cover } from "@/components/cover";
import { CircleButton, Cross, Tick } from "@/components/mobile/bits";
import { Crumb, PageShell } from "@/components/page-shell";
import { DatePicker, TimePicker, formatPickedDate, formatPickedTime } from "@/components/pickers";
import { PhotoPicker, type StagedPhoto, type UploadProgress } from "@/components/photo-uploader";
import { api, type Activity, type Category, type Invite } from "@/lib/api";
import { isApiError } from "@/lib/errors";
import { track } from "@/lib/events";
import { categoryLabels, formatMoney, timezoneLabel, timezones } from "@/lib/format";
import { useUser } from "@/lib/user-context";

const schema = z
  .object({
    title: z.string().trim().min(3, "Give it a name of at least 3 characters.").max(80, "Keep the name under 80 characters."),
    description: z.string().trim().max(2000, "Keep it under 2000 characters."),
    category: z.enum(["outdoors", "nights_out", "food_and_drink", "classes", "other"]),
    date: z.string().min(1, "Pick a date."),
    time: z.string().min(1, "Pick a start time."),
    timezone: z.string().min(1),
    location: z.string().trim().min(1, "Say where to meet.").max(200, "Keep it under 200 characters."),
    currency: z.string().length(3),
    price: z
      .string()
      .trim()
      .min(1, "Enter a price, or 0 if it's free.")
      .regex(/^\d{1,6}([.,]\d{1,2})?$/, "Enter a price like 45 or 45.50."),
    capacity: z
      .string()
      .trim()
      .min(1, "Enter how many spots.")
      .regex(/^\d+$/, "Whole numbers only.")
      .refine((v) => Number(v) >= 1 && Number(v) <= 500, "Between 1 and 500 spots."),
  })
  .refine((v) => !v.date || !v.time || new Date(`${v.date}T${v.time}`) > new Date(), { path: ["time"], message: "That time has already passed." });

type FormValues = z.infer<typeof schema>;

const toMinor = (price: string) => Math.round(Number(price.replace(",", ".")) * 100);
const toCount = (value: string) => (/^\d+$/.test(value.trim()) ? Number(value) : 0);

const defaultTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
const illustrationFor = (c: Category) => (c === "outdoors" ? "kayak" : c === "nights_out" ? "speakeasy" : c === "food_and_drink" ? "market" : c === "classes" ? "pottery" : "other");

/** New activity: the form with a live preview of the Explore card, then the published page. */
export default function CreateActivityPage() {
  const { userId } = useUser();
  const [published, setPublished] = useState<Activity | null>(null);
  const [staged, setStaged] = useState<StagedPhoto[]>([]);
  const [uploading, setUploading] = useState<UploadProgress | null>(null);
  const [photoProblem, setPhotoProblem] = useState<string | null>(null);
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: { title: "", description: "", category: "outdoors", date: "", time: "18:00", timezone: timezones.includes(defaultTimezone) ? defaultTimezone : "Africa/Lagos", location: "", currency: "USD", price: "0", capacity: "12" },
  });
  const values = form.watch();

  const create = useMutation({
    mutationFn: async (v: FormValues) => {
      const { activity } = await api.createActivity(userId!, {
        title: v.title,
        description: v.description,
        category: v.category,
        location: v.location,
        startsAtLocal: `${v.date}T${v.time}`,
        timezone: v.timezone,
        price: { amountMinor: toMinor(v.price), currency: v.currency.toUpperCase() },
        capacity: Number(v.capacity),
      });
      // The activity exists from here on, so a failed photo is reported on the published page rather than failing the publish.
      const photos = [...activity.photos];
      for (const [index, item] of staged.entries()) {
        setUploading({ index, fraction: 0 });
        try {
          const { photo } = await api.uploadPhoto(userId!, activity.id, item.file, (fraction) => setUploading({ index, fraction }));
          photos.push(photo);
        } catch (err) {
          setPhotoProblem(isApiError(err) ? err.message : "One photo didn't upload. You can add it from live attendance.");
        }
      }
      setUploading(null);
      return { ...activity, photos };
    },
    onSuccess: (activity) => {
      staged.forEach((p) => URL.revokeObjectURL(p.url));
      setPublished(activity);
    },
    onError: (err) => {
      if (isApiError(err) && err.code === "VALIDATION") {
        const fields = (err.details?.fields as Record<string, string> | undefined) ?? {};
        const known: (keyof FormValues)[] = ["title", "description", "category", "date", "time", "timezone", "location", "currency", "price", "capacity"];
        for (const [key, message] of Object.entries(fields)) {
          const name = (key === "startsAtLocal" ? "date" : key === "price.amountMinor" ? "price" : key) as keyof FormValues;
          if (known.includes(name)) form.setError(name, { message });
        }
      } else {
        form.setError("root", { message: isApiError(err, "UNAUTHENTICATED") ? "Pick who you are at the top of the page first." : "Something went wrong on our side. Try again." });
      }
    },
  });

  if (published) return <Published activity={published} photoProblem={photoProblem} />;

  const e = form.formState.errors;
  return (
    <PageShell flush>
      <div className="flex flex-wrap gap-8 px-5 pt-3 sm:px-0 sm:pt-0">
        <section className="flex min-w-0 flex-[2_1_560px] flex-col gap-6">
          <div className="flex flex-col gap-2">
            <Crumb href="/plans?tab=hosting" className="hidden sm:inline-flex">
              My plans
            </Crumb>
            <div className="flex items-center justify-between gap-3">
              <h1 className="text-[26px] tracking-[-0.025em] sm:text-[40px] sm:leading-[1.02] sm:tracking-[-0.03em]">New activity</h1>
              <CircleButton href="/plans?tab=hosting" label="Close" className="sm:hidden">
                <Cross />
              </CircleButton>
            </div>
            <p className="text-sm text-body sm:text-base">People book one spot each and bring friends through invites, so think in spots, not groups.</p>
          </div>

          <form className="flex flex-col gap-5 sm:gap-6 sm:rounded-[20px] sm:bg-surface sm:p-6 sm:shadow-[var(--shadow-card)]" onSubmit={form.handleSubmit((v) => create.mutate(v))} noValidate>
            <fieldset className="flex flex-col gap-2.5">
              <legend className="text-sm font-bold text-ink">Photos</legend>
              <span className="text-xs text-muted-ink">Up to 6. The first one is the cover people see on Explore and in invites. Drag to reorder.</span>
              <PhotoPicker photos={staged} onChange={setStaged} uploading={uploading} disabled={create.isPending} />
              <span className="text-xs text-muted-ink">JPG, PNG or WebP, up to 10 MB each. No photos? We&apos;ll use an illustrated cover for your activity&apos;s category.</span>
            </fieldset>

            <Field label="Name" htmlFor="title" error={e.title?.message}>
              <input id="title" {...form.register("title")} placeholder="Sunset Kayaking" className={`${formInputClass} text-base`} aria-invalid={!!e.title} />
            </Field>
            <Field label="What happens" htmlFor="desc" error={e.description?.message}>
              <textarea id="desc" rows={3} {...form.register("description")} placeholder="Two hours on calm water as the sun goes down. Boats, paddles and a guide included." className="w-full resize-y rounded-xl border-[1.5px] border-[#C9CDD3] bg-surface px-3.5 py-3 text-[15px] leading-relaxed text-ink outline-none placeholder:text-muted-ink focus:border-brand" />
            </Field>
            <Field label="Category" htmlFor="category" hint="Drives the filters on Explore and the illustrated cover when there are no photos.">
              <Select id="category" size="field" {...form.register("category")}>
                {(Object.keys(categoryLabels) as Category[]).map((c) => (
                  <option key={c} value={c}>
                    {categoryLabels[c]}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="flex flex-col gap-1.5">
              <div className="flex flex-wrap gap-3">
                <div className="min-w-0 flex-[1_1_160px]">
                  <Field label="Date" htmlFor="date" error={e.date?.message}>
                    <Controller control={form.control} name="date" render={({ field }) => <DatePicker id="date" value={field.value} onChange={field.onChange} invalid={!!e.date} />} />
                  </Field>
                </div>
                <div className="min-w-0 flex-[1_1_140px]">
                  <Field label="Starts at" htmlFor="time" error={e.time?.message}>
                    <Controller control={form.control} name="time" render={({ field }) => <TimePicker id="time" value={field.value} onChange={field.onChange} invalid={!!e.time} />} />
                  </Field>
                </div>
                <div className="min-w-0 flex-[1_1_200px]">
                  <Field label="Time zone of the venue" htmlFor="tz">
                    <Select id="tz" size="field" {...form.register("timezone")}>
                      {timezones.map((tz) => (
                        <option key={tz} value={tz}>
                          {timezoneLabel(tz)}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>
              </div>
              <span className="text-xs text-muted-ink">Guests always see the time where the activity happens, wherever they are.</span>
            </div>
            <Field label="Where to meet" htmlFor="where" error={e.location?.message}>
              <input id="where" {...form.register("location")} placeholder="Harbour jetty, pier 3" className={formInputClass} aria-invalid={!!e.location} />
            </Field>
            <div className="flex flex-wrap gap-3">
              <div className="min-w-0 flex-[1_1_200px]">
                <Field label="Price per spot" htmlFor="price" hint="Shown to guests. Collected by you on the day." error={e.price?.message}>
                  <div className="flex gap-2">
                    <Select aria-label="Currency" size="field" {...form.register("currency")} className="w-[104px] shrink-0">
                      {["USD", "NGN", "GBP", "EUR", "KES", "ZAR"].map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </Select>
                    <input id="price" inputMode="decimal" placeholder="0.00" {...form.register("price")} className={formInputClass} aria-invalid={!!e.price} />
                  </div>
                </Field>
              </div>
              <div className="min-w-0 flex-[1_1_200px]">
                <Field label="Spots" htmlFor="spots" hint="How many people you can take in total, across every group." error={e.capacity?.message}>
                  <div className="flex items-center gap-2">
                    <button type="button" aria-label="One fewer spot" onClick={() => form.setValue("capacity", String(Math.max(1, toCount(values.capacity) - 1)), { shouldValidate: true })} className="flex size-[50px] shrink-0 items-center justify-center rounded-xl border-[1.5px] border-[#C9CDD3] bg-surface text-[22px] font-semibold text-ink hover:bg-ground">
                      −
                    </button>
                    <input id="spots" inputMode="numeric" {...form.register("capacity")} className="h-[50px] w-20 rounded-xl border-[1.5px] border-[#C9CDD3] bg-surface text-center text-lg font-bold text-ink outline-none focus:border-brand aria-invalid:border-scarcity-text" aria-invalid={!!e.capacity} />
                    <button type="button" aria-label="One more spot" onClick={() => form.setValue("capacity", String(Math.min(500, toCount(values.capacity) + 1)), { shouldValidate: true })} className="flex size-[50px] shrink-0 items-center justify-center rounded-xl border-[1.5px] border-[#C9CDD3] bg-surface text-[22px] font-semibold text-ink hover:bg-ground">
                      +
                    </button>
                  </div>
                </Field>
              </div>
            </div>
            {e.root && (
              <div role="alert" className="rounded-2xl bg-warning-bg p-4 text-sm font-semibold text-warning-text">
                {e.root.message}
              </div>
            )}
          </form>
          <div className="sticky bottom-0 z-10 -mx-5 flex items-center gap-4 bg-surface px-5 pb-6 pt-3 shadow-[0_-1px_0_var(--line)] sm:static sm:mx-0 sm:flex-wrap sm:bg-transparent sm:p-0 sm:shadow-none">
            <Button size="publish" className="h-14 w-full text-[17px] sm:h-[54px] sm:w-auto sm:text-base" onClick={form.handleSubmit((v) => create.mutate(v))} disabled={create.isPending}>
              {uploading ? `Uploading photo ${uploading.index + 1} of ${staged.length}…` : create.isPending ? "Publishing…" : "Publish activity"}
            </Button>
            <span className="hidden text-sm text-muted-ink sm:inline">Anyone can find and book it once it&apos;s published.</span>
          </div>
        </section>

        <aside className="hidden min-w-0 flex-[1_1_320px] flex-col gap-2.5 sm:flex lg:sticky lg:top-[88px] lg:self-start">
          <span className="text-xs font-bold uppercase tracking-[0.06em] text-muted-ink">How guests will see it</span>
          <article className="overflow-hidden rounded-[20px] bg-surface shadow-[var(--shadow-card)]">
            <div className="relative h-[170px]">
              {staged[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={staged[0].url} alt="" className="h-full w-full object-cover" />
              ) : (
                <Cover illustration={illustrationFor(values.category)} />
              )}
              <span className="pointer-events-none absolute bottom-3.5 left-3.5 rounded-full bg-surface px-2.5 py-[5px] text-xs font-bold">{categoryLabels[values.category]}</span>
            </div>
            <div className="flex flex-col gap-2.5 px-5 pb-5 pt-[18px]">
              <div className="flex items-start justify-between gap-3">
                <span className="text-lg font-bold">{values.title || "Your activity"}</span>
                <span className="font-bold">{formatMoney({ amountMinor: /^\d{1,6}([.,]\d{1,2})?$/.test(values.price.trim()) ? toMinor(values.price) : 0, currency: values.currency || "USD" })}</span>
              </div>
              <span className="text-sm text-body">
                {values.date ? formatPickedDate(values.date).replace(/ \d{4}$/, "") : "Date"} · {values.time ? formatPickedTime(values.time) : "Time"} · you
              </span>
              <div className="flex items-center justify-between pt-1">
                <span className="inline-flex items-center gap-2.5 text-sm font-bold text-brand-deep">
                  <Dot spotsLeft={toCount(values.capacity)} /> {toCount(values.capacity)} of {toCount(values.capacity)} left
                </span>
                <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-muted-ink">Live</span>
              </div>
              <div className="h-1 overflow-hidden rounded-sm bg-line" />
              <span className="mt-1 flex h-11 items-center justify-center rounded-xl bg-brand text-[15px] font-bold text-white">Book a spot</span>
            </div>
          </article>
        </aside>
      </div>
    </PageShell>
  );
}

/** After a vouch: the link only that person can claim, with copy, the share sheet, and another go. */
function VouchSent({ invite, copied, onCopy, onShare, onAgain }: { invite: Invite; copied: boolean; onCopy: () => void; onShare: () => void; onAgain: () => void }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-[#F7F8F7] p-4">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand text-white">
          <Tick />
        </span>
        <div className="flex flex-col gap-1">
          <span className="text-base font-bold text-ink">Vouch sent</span>
          <span className="text-sm text-body">Only the number or email you entered can claim it, so send them this link however you like. It&apos;s also under My invites.</span>
        </div>
      </div>
      <label htmlFor="hostVouchLink" className="text-xs font-bold uppercase tracking-[0.06em] text-muted-ink">
        Their link · code {invite.codeDisplay}
      </label>
      <div className="flex gap-2">
        <input id="hostVouchLink" readOnly value={invite.url} className={`${inputClass} min-w-0 bg-surface`} />
        <Button size="field" variant="outline" className="px-3.5 text-sm" onClick={onCopy}>
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="row" className="flex-1" onClick={onShare}>
          Share link
        </Button>
        <Button size="row" variant="outline" className="flex-1" onClick={onAgain}>
          Vouch for someone else
        </Button>
      </div>
    </div>
  );
}

/** "Sunset Kayaking is live. Now fill it." Share link, vouch for someone, watch bookings. */
function Published({ activity, photoProblem }: { activity: Activity; photoProblem: string | null }) {
  const { userId, anonId } = useUser();
  const [link, setLink] = useState<Invite | null>(null);
  const [copied, setCopied] = useState(false);
  const [contact, setContact] = useState("");
  const [sent, setSent] = useState<Invite | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [vouchOpen, setVouchOpen] = useState(false);
  const [vouchCopied, setVouchCopied] = useState(false);

  async function copyVouch(invite: Invite) {
    try {
      await navigator.clipboard.writeText(invite.url);
    } catch {
      window.prompt("Copy this link", invite.url);
    }
    setVouchCopied(true);
    track({ name: "invite_link_copied", anonId, userId, activityId: activity.id, inviteCode: invite.code });
  }

  async function shareVouch(invite: Invite) {
    track({ name: "invite_link_shared", anonId, userId, activityId: activity.id, inviteCode: invite.code });
    if (navigator.share) await navigator.share({ title: activity.title, text: `${activity.title}: I vouched for you`, url: invite.url }).catch(() => undefined);
    else await copyVouch(invite);
  }

  const resetVouch = () => {
    setSent(null);
    setContact("");
    setVouchCopied(false);
  };

  const copy = useMutation({
    mutationFn: async () => link ?? (await api.createInvite(userId!, { rail: "public", activityId: activity.id, platform: "web" })).invite,
    onSuccess: async (invite) => {
      setLink(invite);
      try {
        await navigator.clipboard.writeText(invite.url);
      } catch {
        window.prompt("Copy this link", invite.url);
      }
      setCopied(true);
      track({ name: "invite_link_copied", anonId, userId, activityId: activity.id, inviteCode: invite.code });
    },
  });

  const vouch = useMutation({
    mutationFn: () => api.createInvite(userId!, { rail: "vouch", activityId: activity.id, recipientContact: contact, platform: "web" }),
    onSuccess: ({ invite }) => {
      setSent(invite);
      setError(null);
    },
    onError: (err) => setError(isApiError(err, "VALIDATION") ? "Enter a phone number or email." : isApiError(err) ? err.message : "Something went wrong. Try again."),
  });

  return (
    <PageShell width={760} flush>
      <div className="flex flex-col sm:hidden">
        <div className="flex justify-end px-5 pt-3">
          <CircleButton href="/plans?tab=hosting" label="Close">
            <Cross />
          </CircleButton>
        </div>
        <div className="flex flex-col gap-3 px-5 pt-8">
          <span className="inline-flex items-center gap-2 text-[13px] font-bold text-brand-deep">
            <Tick size={16} /> Published
          </span>
          <h1 className="text-[32px] leading-[1.02] tracking-[-0.03em]">{activity.title} is live. Now fill it.</h1>
          <p className="text-[15px] leading-relaxed text-body">Anyone can find it on Explore. People you know fill it fastest.</p>
          {photoProblem && <Notice title="One photo didn't make it" body={`${photoProblem} The rest are up.`} />}
        </div>
        <div className="flex flex-col gap-3 px-5 pt-6">
          {activity.invitesEnabled ? (
            <>
              <Button size="cta" block variant={copied ? "tint" : "primary"} className="shadow-none" onClick={() => copy.mutate()} disabled={copy.isPending}>
                {copied ? "Link copied" : "Share the link"}
              </Button>
              {!vouchOpen ? (
                <Button size="wide" block variant="outline" onClick={() => setVouchOpen(true)}>
                  Vouch for someone
                </Button>
              ) : sent ? (
                <VouchSent invite={sent} copied={vouchCopied} onCopy={() => copyVouch(sent)} onShare={() => shareVouch(sent)} onAgain={resetVouch} />
              ) : (
                <form
                  className="flex flex-col gap-2.5 rounded-[20px] bg-surface p-[18px] shadow-[var(--shadow-card)]"
                  onSubmit={(ev) => {
                    ev.preventDefault();
                    vouch.mutate();
                  }}
                >
                  <span className="text-[15px] font-bold">Vouch for someone</span>
                  <span className="text-[13px] leading-snug text-muted-ink">A personal invite with your name on it. They start their own group.</span>
                  <label htmlFor="mVouch" className="sr-only">
                    Their phone number or email
                  </label>
                  <input id="mVouch" value={contact} onChange={(ev) => setContact(ev.target.value)} placeholder="Phone number or email" className={`${inputClass} h-12 text-base`} aria-invalid={!!error} />
                  {error && (
                    <span role="alert" className="text-[13px] font-semibold text-scarcity-text">
                      {error}
                    </span>
                  )}
                  <Button type="submit" size="row" block disabled={vouch.isPending || !contact}>
                    {vouch.isPending ? "Sending…" : "Send vouch"}
                  </Button>
                </form>
              )}
            </>
          ) : (
            <p className="text-sm text-body">Invites aren&apos;t on for this activity, so it fills from Explore alone.</p>
          )}
          <Link href={`/host?activity=${activity.id}`} className="inline-flex min-h-11 items-center self-center text-[15px] font-bold text-brand">
            Watch bookings come in
          </Link>
        </div>
      </div>
      <div className="hidden flex-col gap-6 px-5 sm:flex sm:px-0">
        <div className="flex flex-col gap-3">
          <Chip tone="ok" className="w-fit">
            Published
          </Chip>
          <h1 className="text-[34px] leading-[1.02] tracking-[-0.03em] sm:text-[44px]">{activity.title} is live. Now fill it.</h1>
          <p className="text-base text-body">It&apos;s on Explore for anyone to book. The fastest way to fill it is still people you know.</p>
        </div>
        {photoProblem && <Notice title="One photo didn't make it" body={`${photoProblem} The rest are up. You can add more from live attendance.`} />}
        {activity.invitesEnabled ? (
          <>
            <Card className="flex flex-col gap-3 p-6">
              <span className="text-base font-bold">Share a link anywhere</span>
              <span className="text-sm text-body">Anyone with it can book until the spots are gone.</span>
              <div className="flex flex-wrap gap-2">
                <input aria-label="Share link" readOnly value={link?.url ?? ""} placeholder="Copy to create your link" className={`${inputClass} h-12 min-w-0 flex-[1_1_240px] bg-[#F7F8F7]`} />
                <Button size="row" variant={copied ? "tint" : "primary"} onClick={() => copy.mutate()} disabled={copy.isPending}>
                  {copied ? "Link copied" : "Copy link"}
                </Button>
              </div>
            </Card>
            <Card className="flex flex-col gap-3 p-6">
              <span className="text-base font-bold">Vouch for someone</span>
              <span className="text-sm text-body">A personal invite for one person, with your name on it. They start their own group.</span>
              {sent ? (
                <VouchSent invite={sent} copied={vouchCopied} onCopy={() => copyVouch(sent)} onShare={() => shareVouch(sent)} onAgain={resetVouch} />
              ) : (
              <form
                className="flex flex-wrap gap-2"
                onSubmit={(ev) => {
                  ev.preventDefault();
                  vouch.mutate();
                }}
              >
                <label htmlFor="vouch" className="sr-only">
                  Their phone number or email
                </label>
                <input id="vouch" value={contact} onChange={(ev) => setContact(ev.target.value)} placeholder="Phone number or email" className={`${inputClass} h-12 min-w-0 flex-[1_1_240px]`} aria-invalid={!!error} />
                <Button type="submit" size="row" variant="outline" disabled={vouch.isPending || !contact}>
                  {vouch.isPending ? "Sending…" : "Send vouch"}
                </Button>
              </form>
              )}
              {error && !sent && (
                <span role="alert" className="text-[13px] font-semibold text-scarcity-text">
                  {error}
                </span>
              )}
            </Card>
          </>
        ) : (
          <Card className="p-6 text-sm text-body">Invites aren&apos;t on for this activity, so it fills from Explore alone.</Card>
        )}
        <ButtonLink href={`/host?activity=${activity.id}`} size="row" className="self-start">
          Watch bookings come in live
        </ButtonLink>
      </div>
    </PageShell>
  );
}
