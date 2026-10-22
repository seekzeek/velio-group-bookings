"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardSkeleton, Chip, ErrorState } from "@/components/bits";
import { PageShell } from "@/components/page-shell";
import { api, type Goal } from "@/lib/api";
import { isApiError } from "@/lib/errors";

const pct = (v: number | null) => (v === null ? "no data" : `${Math.round(v * 1000) / 10}%`);

function StatusChip({ status }: { status: Goal["status"] }) {
  if (status === "on_target") return <Chip tone="ok">On target</Chip>;
  if (status === "trigger_fired") return <Chip tone="warn">Trigger fired</Chip>;
  return <Chip tone="dim">Not enough data</Chip>;
}

export default function AdminPage() {
  const [source, setSource] = useState<"live" | "scenario">("scenario");
  const [force, setForce] = useState(false);
  const [queriesOpen, setQueriesOpen] = useState(false);
  const report = useQuery({ queryKey: ["admin-health", source, force], queryFn: () => api.adminHealth({ source, minSample: force ? 0 : undefined }), refetchInterval: 30_000 });
  const data = report.data;

  return (
    <PageShell wide>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className="text-xs font-bold uppercase tracking-wide text-muted-ink">Admin</span>
          <h1 className="text-3xl sm:text-4xl">Group invites · feature health</h1>
          <p className="mt-1 text-body">Every goal from the scope, against its target. Triggers only count above the cohort minimums from the tracking plan.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm font-semibold text-muted-ink">
            Data
            <select className="h-10 rounded-xl border border-line bg-surface px-3 text-sm font-semibold text-ink" value={source} onChange={(e) => setSource(e.target.value as "live" | "scenario")}>
              <option value="scenario">Part 4 scenario · last 30 days</option>
              <option value="live">Live demo data</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm font-semibold text-muted-ink">
            <input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} /> Ignore minimums
          </label>
        </div>
      </div>

      {data && data.source !== source && <p className="mt-4 text-sm font-semibold text-warning-text">The scenario database isn&apos;t configured on the backend, so this is live data.</p>}

      {report.isPending && (
        <div className="mt-6 grid gap-5 lg:grid-cols-3">
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
          <div role="alert" className={`flex flex-col gap-3 rounded-2xl p-4 sm:flex-row sm:items-center sm:justify-between ${data.triggers.length ? "bg-warning-bg text-warning-text" : "bg-brand-tint text-brand-deep"}`}>
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
            <button type="button" onClick={() => setQueriesOpen((o) => !o)} className="shrink-0 text-sm font-bold underline-offset-2 hover:underline">
              {queriesOpen ? "Hide the diagnosis queries" : "Open the diagnosis queries"}
            </button>
          </div>
          {queriesOpen && (
            <Card className="flex flex-col gap-4 p-5">
              <span className="font-bold">Diagnosis queries</span>
              {data.diagnosisQueries.map((q, i) => (
                <div key={q.title} className="flex flex-col gap-1">
                  <span className="text-sm font-semibold text-body">
                    {i + 1}. {q.title}
                  </span>
                  <pre className="overflow-x-auto rounded-xl bg-ground p-3 text-xs text-body">{q.sql}</pre>
                </div>
              ))}
              <span className="text-xs text-muted-ink">
                The full set runs with <code>npm run diagnostics</code> in the backend.
              </span>
            </Card>
          )}

          <Card className="overflow-hidden">
            <h2 className="px-5 pt-5 text-xl">Goals</h2>
            <div className="overflow-x-auto">
              <table className="mt-3 w-full text-sm">
                <thead className="bg-ground text-left text-xs font-bold uppercase tracking-wide text-muted-ink">
                  <tr>
                    <th className="px-5 py-3">Goal</th>
                    <th className="px-5 py-3">Now</th>
                    <th className="px-5 py-3">Target</th>
                    <th className="px-5 py-3">Trigger</th>
                    <th className="px-5 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {data.goals.map((g) => (
                    <tr key={g.key}>
                      <td className="px-5 py-3 font-bold text-ink">{g.label}</td>
                      <td className="px-5 py-3 font-heading text-lg font-bold">
                        {g.currentDisplay}
                        {g.status === "no_data" && g.sampleSize > 0 && <span className="block text-xs font-normal text-muted-ink">{g.sampleSize} of {g.minSample} needed</span>}
                      </td>
                      <td className="px-5 py-3 text-body">{g.targetDisplay}</td>
                      <td className="px-5 py-3 text-body">{g.trigger}</td>
                      <td className="px-5 py-3">
                        <StatusChip status={g.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="grid gap-5 lg:grid-cols-3">
            <Card className="flex flex-col gap-4 p-5">
              <h2 className="text-lg">Claim rate by rail</h2>
              {(["vouch", "public"] as const).map((rail) => {
                const v = data.claimRateByRail[rail];
                return (
                  <div key={rail} className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-semibold text-body">{rail === "vouch" ? "Vouch" : "Public link"}</span>
                      <strong>{pct(v)}</strong>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-line">
                      <div className="h-full bg-brand" style={{ width: `${Math.min(100, (v ?? 0) * 100)}%` }} />
                    </div>
                    <span className="text-xs text-muted-ink">{data.claimRateByRail.opens[rail]} unique opens</span>
                  </div>
                );
              })}
              <span className="text-xs text-muted-ink">{data.claimRateByRail.definition}</span>
            </Card>
            <Card className="flex flex-col gap-2 p-5">
              <h2 className="text-lg">Opens that landed on a full activity</h2>
              <span className="font-heading text-4xl font-bold">{pct(data.opensOnFullShare)}</span>
              <span className="text-sm text-body">Guests who might have come but found no spot. The first place to look for the drop-off.</span>
            </Card>
            <Card className="flex flex-col gap-2 p-5">
              <h2 className="text-lg">Holdout read</h2>
              <span className="font-heading text-4xl font-bold">
                Week {data.holdout.weeksElapsed} of {data.holdout.weeksPlanned}
              </span>
              <span className="text-sm text-body">{data.holdout.note}</span>
              {data.holdout.summary.length > 0 && (
                <table className="mt-2 text-xs">
                  <thead className="text-left text-muted-ink">
                    <tr>
                      <th className="pr-3">Variant</th>
                      <th className="pr-3">Activities</th>
                      <th className="pr-3">Avg attendees</th>
                      <th>Fill</th>
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
