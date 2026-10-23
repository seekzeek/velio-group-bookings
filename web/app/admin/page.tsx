"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardSkeleton, Chip, ErrorState, Eyebrow } from "@/components/bits";
import { PageShell } from "@/components/page-shell";
import { api, type Goal } from "@/lib/api";
import { isApiError } from "@/lib/errors";

const pct = (v: number | null) => (v === null ? "no data" : `${Math.round(v * 1000) / 10}%`);

function StatusChip({ status }: { status: Goal["status"] }) {
  if (status === "on_target") return <Chip tone="ok">On target</Chip>;
  if (status === "trigger_fired") return <Chip tone="fired">Trigger fired</Chip>;
  return <Chip tone="dim">Not enough data</Chip>;
}

/** Feature health, with the dark admin header from the canvas. */
export default function AdminPage() {
  const [source, setSource] = useState<"live" | "scenario">("scenario");
  const [force, setForce] = useState(false);
  const [queriesOpen, setQueriesOpen] = useState(false);
  const report = useQuery({ queryKey: ["admin-health", source, force], queryFn: () => api.adminHealth({ source, minSample: force ? 0 : undefined }), refetchInterval: 30_000 });
  const data = report.data;

  return (
    <PageShell dark>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-[30px] leading-[1.02] tracking-[-0.03em] sm:text-[36px]">Group invites · feature health</h1>
          <span className="text-sm text-body">Every goal from the scope, against its target. {data?.source === "scenario" ? "Sample numbers matching the 30-day scenario." : "Live numbers from this database."}</span>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2.5 text-sm text-muted-ink">
            Data
            <span className="relative inline-flex">
              <select className="h-10 cursor-pointer appearance-none rounded-[10px] border-[1.5px] border-[#C9CDD3] bg-surface pl-3 pr-9 text-sm font-semibold text-ink outline-none" value={source} onChange={(e) => setSource(e.target.value as "live" | "scenario")}>
                <option value="scenario">Part 4 scenario · last 30 days</option>
                <option value="live">Live demo data</option>
              </select>
              <svg className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-ink" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </span>
          </label>
          <label className="flex items-center gap-2 text-sm text-muted-ink">
            <input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} /> Ignore cohort minimums
          </label>
        </div>
      </div>

      {data && data.source !== source && <p className="mt-4 text-sm font-semibold text-warning-text">The scenario database isn&apos;t configured on the backend, so this is live data.</p>}

      {report.isPending && (
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <CardSkeleton lines={2} />
          <CardSkeleton lines={2} />
          <CardSkeleton lines={2} />
        </div>
      )}
      {report.isError && (
        <div className="mt-6">
          <ErrorState code={isApiError(report.error) ? report.error.code : "TRY_AGAIN"} />
        </div>
      )}

      {data && (
        <div className="mt-6 flex flex-col gap-6">
          <div role="alert" className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl px-5 py-4 ${data.triggers.length ? "bg-warning-bg text-warning-text" : "bg-brand-tint text-brand-deep"}`}>
            <span className="text-sm">
              {data.triggers.length ? (
                <>
                  <strong>
                    {data.triggers.length} trigger{data.triggers.length === 1 ? "" : "s"} fired.
                  </strong>{" "}
                  {data.triggers.map((t) => t.message).join(" ")}
                </>
              ) : (
                <strong>No triggers fired in the last {data.window.days} days.</strong>
              )}
            </span>
            <button type="button" onClick={() => setQueriesOpen((o) => !o)} className="inline-flex min-h-10 items-center text-sm font-bold">
              {queriesOpen ? "Hide the diagnosis queries" : "Open the diagnosis queries"}
            </button>
          </div>
          {queriesOpen && (
            <Card radius={16} className="flex flex-col gap-2 px-5 py-[18px] text-sm text-body">
              <span className="font-bold text-ink">Diagnosis queries</span>
              {data.diagnosisQueries.map((q, i) => (
                <div key={q.title} className="flex flex-col gap-1">
                  <span>
                    {i + 1}. {q.title}
                  </span>
                  <pre className="overflow-x-auto rounded-xl bg-ground p-3 text-xs">{q.sql}</pre>
                </div>
              ))}
              <span className="text-xs text-muted-ink">
                The full set runs with <code>npm run diagnostics</code> in the backend.
              </span>
            </Card>
          )}

          <section className="flex flex-col gap-3">
            <Eyebrow>Goals</Eyebrow>
            <Card className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-sm">
                <thead className="text-left text-xs font-bold uppercase tracking-[0.06em] text-muted-ink">
                  <tr className="border-b border-[#EEF0F2]">
                    <th className="px-5 py-4 font-bold">Goal</th>
                    <th className="px-3 py-4 font-bold">Now</th>
                    <th className="px-3 py-4 font-bold">Target</th>
                    <th className="px-3 py-4 font-bold">Trigger</th>
                    <th className="px-5 py-4 font-bold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.goals.map((g) => (
                    <tr key={g.key} className="border-b border-[#EEF0F2] last:border-0">
                      <td className="px-5 py-3.5 font-bold text-ink">{g.label}</td>
                      <td className="px-3 py-3.5 text-lg font-bold text-ink">
                        {g.currentDisplay}
                        {g.status === "no_data" && g.sampleSize > 0 && (
                          <span className="block text-xs font-normal text-muted-ink">
                            {g.sampleSize} of {g.minSample} needed
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3.5 text-body">{g.targetDisplay}</td>
                      <td className="px-3 py-3.5 text-body">{g.trigger}</td>
                      <td className="px-5 py-3.5">
                        <StatusChip status={g.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </section>

          <section className="flex flex-col gap-3">
            <Eyebrow>By platform</Eyebrow>
            <Card className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-sm">
                <thead className="text-left text-xs font-bold uppercase tracking-[0.06em] text-muted-ink">
                  <tr className="border-b border-[#EEF0F2]">
                    <th className="px-5 py-3.5 font-bold">Platform</th>
                    <th className="px-3 py-3.5 font-bold">Activity views</th>
                    <th className="px-3 py-3.5 font-bold">Booking attempts</th>
                    <th className="px-3 py-3.5 font-bold">Bookings</th>
                    <th className="px-3 py-3.5 font-bold">Invite opens</th>
                    <th className="px-3 py-3.5 font-bold">Claims</th>
                    <th className="px-5 py-3.5 font-bold">Opens that claimed</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byPlatform.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-5 py-4 text-body">
                        Nothing in the window yet.
                      </td>
                    </tr>
                  )}
                  {data.byPlatform.map((p) => (
                    <tr key={p.platform} className="border-b border-[#EEF0F2] last:border-0">
                      <td className="px-5 py-3 font-bold capitalize text-ink">{p.platform}</td>
                      <td className="px-3 py-3 text-body">{p.views}</td>
                      <td className="px-3 py-3 text-body">{p.bookingAttempts}</td>
                      <td className="px-3 py-3 text-body">{p.bookings}</td>
                      <td className="px-3 py-3 text-body">{p.inviteOpens}</td>
                      <td className="px-3 py-3 text-body">{p.claims}</td>
                      <td className="px-5 py-3 font-bold text-ink">{p.inviteOpens > 0 ? pct(p.claims / p.inviteOpens) : "no data"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <span className="block px-5 pb-4 text-xs text-muted-ink">Counts of events in the window by the platform the client reported. The same split is on every Prometheus counter as a <code>platform</code> label, and the SQL views <code>invite_opens</code> and <code>invite_funnel</code> carry it per invite.</span>
            </Card>
          </section>

          <div className="flex flex-wrap gap-4">
            <Card className="flex min-w-0 flex-[1_1_260px] flex-col gap-3.5 p-5">
              <Eyebrow>Claim rate by rail</Eyebrow>
              {(["vouch", "public"] as const).map((rail) => {
                const v = data.claimRateByRail[rail];
                return (
                  <div key={rail} className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-body">{rail === "vouch" ? "Vouch" : "Public link"}</span>
                      <strong>{pct(v)}</strong>
                    </div>
                    <div className="h-1 overflow-hidden rounded-sm bg-line">
                      <div className="h-full bg-brand" style={{ width: `${Math.min(100, (v ?? 0) * 100)}%` }} />
                    </div>
                  </div>
                );
              })}
              <span className="text-xs text-muted-ink">{data.claimRateByRail.definition}</span>
            </Card>
            <Card className="flex min-w-0 flex-[1_1_260px] flex-col gap-2 p-5">
              <Eyebrow>Opens that landed on a full activity</Eyebrow>
              <span className="text-[40px] font-bold leading-none tracking-tight">{pct(data.opensOnFullShare)}</span>
              <span className="text-sm leading-relaxed text-body">Guests who might have come but found no spot. The first place to look for the drop-off.</span>
            </Card>
            <Card className="flex min-w-0 flex-[1_1_260px] flex-col gap-2 p-5">
              <Eyebrow>Holdout read</Eyebrow>
              <span className="text-[40px] font-bold leading-none tracking-tight">
                Week {data.holdout.weeksElapsed} of {data.holdout.weeksPlanned}
              </span>
              <span className="text-sm leading-relaxed text-body">{data.holdout.note}</span>
              {data.holdout.summary.length > 0 && (
                <table className="mt-1 text-xs">
                  <thead className="text-left text-muted-ink">
                    <tr>
                      <th className="pr-3 font-semibold">Variant</th>
                      <th className="pr-3 font-semibold">Activities</th>
                      <th className="pr-3 font-semibold">Avg attendees</th>
                      <th className="font-semibold">Fill</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.holdout.summary.map((s) => (
                      <tr key={s.variant}>
                        <td className="pr-3 font-semibold capitalize">{s.variant}</td>
                        <td className="pr-3">{s.activities}</td>
                        <td className="pr-3">{s.avgAttendees}</td>
                        <td>{pct(s.avgFillRate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
          </div>
        </div>
      )}
    </PageShell>
  );
}
