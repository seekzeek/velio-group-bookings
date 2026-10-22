"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { ChevronLeft, Minus, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Card, Cta, Field, inputClass } from "@/components/bits";
import { Cover } from "@/components/cover";
import { InvitePanel } from "@/components/invite-panel";
import { PageShell } from "@/components/page-shell";
import { PhotoUploader } from "@/components/photo-uploader";
import { SpotsLine } from "@/components/spots-line";
import { api, type Activity, type Category } from "@/lib/api";
import { isApiError } from "@/lib/errors";
import { categoryLabels, formatMoney, timezoneLabel, timezones } from "@/lib/format";
import { useUser } from "@/lib/user-context";

const schema = z.object({
  title: z.string().trim().min(3, "Give it a name of at least 3 characters.").max(80),
  description: z.string().trim().max(2000),
  category: z.enum(["outdoors", "nights_out", "food_and_drink", "classes", "other"]),
  date: z.string().min(1, "Pick a date."),
  time: z.string().min(1, "Pick a start time."),
  timezone: z.string().min(1),
  location: z.string().trim().min(1, "Say where to meet.").max(200),
  currency: z.string().length(3),
  price: z.number({ error: "Enter a price." }).min(0, "Price can't be negative."),
  capacity: z.number({ error: "Enter a number of spots." }).int().min(1, "At least one spot.").max(500),
});

type FormValues = z.infer<typeof schema>;

const defaultTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

export default function CreateActivityPage() {
  const { userId } = useUser();
  const [published, setPublished] = useState<Activity | null>(null);
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { title: "", description: "", category: "outdoors", date: "", time: "18:00", timezone: timezones.includes(defaultTimezone) ? defaultTimezone : "Africa/Lagos", location: "", currency: "USD", price: 0, capacity: 12 },
  });
  const values = form.watch();

  const create = useMutation({
    mutationFn: (v: FormValues) =>
      api.createActivity(userId!, {
        title: v.title,
        description: v.description,
        category: v.category,
        location: v.location,
        startsAtLocal: `${v.date}T${v.time}`,
        timezone: v.timezone,
        price: { amountMinor: Math.round(v.price * 100), currency: v.currency.toUpperCase() },
        capacity: v.capacity,
      }),
    onSuccess: ({ activity }) => setPublished(activity),
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

  if (published) {
    return (
      <PageShell>
        <div className="mx-auto flex max-w-xl flex-col gap-6 pt-4">
          <div className="flex flex-col gap-2">
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-brand-tint px-2.5 py-1 text-xs font-bold text-brand-deep">Published</span>
            <h1 className="text-3xl sm:text-4xl">{published.title} is live. Now fill it.</h1>
            <p className="text-body">It&apos;s on Explore for anyone to book. The fastest way to fill it is still people you know.</p>
          </div>
          {published.invitesEnabled ? (
            <Card className="p-5">
              <InvitePanel activity={published} hostMode />
            </Card>
          ) : (
            <Card className="p-5 text-sm text-body">Invites aren&apos;t on for this activity, so it fills from Explore alone.</Card>
          )}
          <Link href={`/host?activity=${published.id}`} className="text-center text-sm font-bold text-brand">
            Watch bookings come in live
          </Link>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell wide>
      <div className="grid gap-8 lg:grid-cols-[1.3fr_1fr]">
        <section className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <Link href="/host" className="inline-flex items-center gap-1 text-sm font-bold text-brand">
              <ChevronLeft className="size-4" /> My plans
            </Link>
            <h1 className="text-3xl sm:text-4xl">New activity</h1>
            <p className="text-body">People book one spot each and bring friends through invites, so think in spots, not groups.</p>
          </div>

          <form className="flex flex-col gap-5" onSubmit={form.handleSubmit((v) => create.mutate(v))} noValidate>
            <fieldset className="flex flex-col gap-2">
              <legend className="text-sm font-bold text-ink">Photos</legend>
              <span className="text-xs text-muted-ink">Up to 6. The first one is the cover people see on Explore and in invites. You can add them once it&apos;s published.</span>
              <PhotoUploader activity={null} />
            </fieldset>

            <Field label="Name" htmlFor="title" error={form.formState.errors.title?.message}>
              <input id="title" {...form.register("title")} placeholder="Sunset Kayaking" className={inputClass} aria-invalid={!!form.formState.errors.title} />
            </Field>
            <Field label="What happens" htmlFor="desc" error={form.formState.errors.description?.message}>
              <textarea id="desc" rows={3} {...form.register("description")} placeholder="Two hours on calm water as the sun goes down. Boats, paddles and a guide included." className={`${inputClass} h-auto py-3`} />
            </Field>
            <Field label="Category" htmlFor="category" hint="Drives the filters on Explore and the illustrated cover when there are no photos.">
              <select id="category" {...form.register("category")} className={inputClass}>
                {(Object.keys(categoryLabels) as Category[]).map((c) => (
                  <option key={c} value={c}>
                    {categoryLabels[c]}
                  </option>
                ))}
              </select>
            </Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Date" htmlFor="date" error={form.formState.errors.date?.message}>
                <input id="date" type="date" {...form.register("date")} className={inputClass} aria-invalid={!!form.formState.errors.date} />
              </Field>
              <Field label="Starts at" htmlFor="time" error={form.formState.errors.time?.message}>
                <input id="time" type="time" {...form.register("time")} className={inputClass} />
              </Field>
              <Field label="Time zone of the venue" htmlFor="tz">
                <select id="tz" {...form.register("timezone")} className={inputClass}>
                  {timezones.map((tz) => (
                    <option key={tz} value={tz}>
                      {timezoneLabel(tz)}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <span className="-mt-3 text-xs text-muted-ink">Guests always see the time where the activity happens, wherever they are.</span>
            <Field label="Where to meet" htmlFor="where" error={form.formState.errors.location?.message}>
              <input id="where" {...form.register("location")} placeholder="Harbour jetty, pier 3" className={inputClass} aria-invalid={!!form.formState.errors.location} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Price per spot" htmlFor="price" hint="Shown to guests. Collected by you on the day." error={form.formState.errors.price?.message}>
                <div className="flex gap-2">
                  <select aria-label="Currency" {...form.register("currency")} className={`${inputClass} w-28`}>
                    {["USD", "NGN", "GBP", "EUR", "KES", "ZAR"].map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                  <input id="price" type="number" step="0.01" min="0" inputMode="decimal" {...form.register("price", { valueAsNumber: true })} className={inputClass} />
                </div>
              </Field>
              <Field label="Spots" htmlFor="spots" hint="How many people you can take in total, across every group." error={form.formState.errors.capacity?.message}>
                <div className="flex items-center gap-2">
                  <button type="button" aria-label="One fewer spot" onClick={() => form.setValue("capacity", Math.max(1, Number(values.capacity) - 1))} className="flex size-12 items-center justify-center rounded-[14px] border border-[#C9CDD3] bg-surface">
                    <Minus className="size-4" />
                  </button>
                  <input id="spots" type="number" min={1} max={500} inputMode="numeric" {...form.register("capacity", { valueAsNumber: true })} className={`${inputClass} text-center`} />
                  <button type="button" aria-label="One more spot" onClick={() => form.setValue("capacity", Math.min(500, Number(values.capacity) + 1))} className="flex size-12 items-center justify-center rounded-[14px] border border-[#C9CDD3] bg-surface">
                    <Plus className="size-4" />
                  </button>
                </div>
              </Field>
            </div>
            {form.formState.errors.root && (
              <div role="alert" className="rounded-2xl bg-warning-bg p-4 text-sm font-semibold text-warning-text">
                {form.formState.errors.root.message}
              </div>
            )}
            <div className="flex flex-col gap-2">
              <Cta type="submit" disabled={create.isPending}>
                {create.isPending ? "Publishing…" : "Publish activity"}
              </Cta>
              <span className="text-center text-xs text-muted-ink">Anyone can find and book it once it&apos;s published.</span>
            </div>
          </form>
        </section>

        <aside className="lg:pt-24">
          <span className="text-xs font-bold uppercase tracking-wide text-muted-ink">How guests will see it</span>
          <article className="mt-3 overflow-hidden rounded-[20px] bg-surface shadow-[var(--shadow-card)]">
            <div className="relative h-[170px]">
              <Cover illustration={values.category === "outdoors" ? "kayak" : values.category === "nights_out" ? "speakeasy" : values.category === "food_and_drink" ? "market" : values.category === "classes" ? "pottery" : "other"} />
              <span className="absolute left-3 top-3 rounded-full bg-surface/95 px-2.5 py-1 text-xs font-bold">{categoryLabels[values.category]}</span>
            </div>
            <div className="flex flex-col gap-3 p-5">
              <div className="flex items-start justify-between gap-3">
                <span className="text-lg font-bold">{values.title || "Your activity"}</span>
                <span className="font-bold">{formatMoney({ amountMinor: Math.round(Number(values.price || 0) * 100), currency: values.currency || "USD" })}</span>
              </div>
              <span className="text-sm text-body">
                {values.date ? new Date(`${values.date}T${values.time || "00:00"}`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }) : "Date"} · {values.time || "Time"} · you
              </span>
              <SpotsLine spotsLeft={Number(values.capacity) || 0} capacity={Number(values.capacity) || 0} short />
              <span className="flex h-12 items-center justify-center rounded-2xl bg-brand text-[15px] font-bold text-white">Book a spot</span>
            </div>
          </article>
        </aside>
      </div>
    </PageShell>
  );
}
