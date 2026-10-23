"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ActivityCard } from "@/components/activity-card";
import { CardSkeleton, ErrorState, Select, TextButton } from "@/components/bits";
import { MobileExplore } from "@/components/mobile/explore";
import { PageShell } from "@/components/page-shell";
import { api, type ActivityFilters, type Category } from "@/lib/api";
import { isApiError } from "@/lib/errors";
import { useUser } from "@/lib/user-context";
import { cn } from "@/lib/utils";

type Filter = "week" | Category | "group";

const filters: { key: Filter; label: string }[] = [
  { key: "week", label: "This week" },
  { key: "outdoors", label: "Outdoors" },
  { key: "food_and_drink", label: "Food and drink" },
  { key: "nights_out", label: "Nights out" },
  { key: "classes", label: "Classes" },
  { key: "group", label: "Has spots for a group" },
];

function endOfComingSunday() {
  const d = new Date();
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7 || 7));
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

export default function ExplorePage() {
  const { userId, ready } = useUser();
  const [active, setActive] = useState<Filter[]>([]);
  const [sort, setSort] = useState<ActivityFilters["sort"]>("soonest");

  const params: ActivityFilters = {
    sort,
    category: active.find((f) => f !== "week" && f !== "group") as Category | undefined,
    minSpotsLeft: active.includes("group") ? 4 : undefined,
    until: active.includes("week") ? endOfComingSunday() : undefined,
  };
  const queryKey = ["activities", params, userId];
  // Explore polls instead of opening a stream per card: browsers cap connections per origin, and six cards would use them all.
  const activities = useQuery({ queryKey, queryFn: () => api.activities(params, userId), enabled: ready, refetchInterval: 10_000 });

  const toggle = (key: Filter) =>
    setActive((current) => {
      const isCategory = key !== "week" && key !== "group";
      const without = current.filter((f) => (isCategory ? f === "week" || f === "group" : f !== key));
      return current.includes(key) ? without : [...without, key];
    });

  const errorCode = activities.isError ? (isApiError(activities.error) ? activities.error.code : "TRY_AGAIN") : null;

  return (
    <PageShell flush>
      <div className="sm:hidden">
        <MobileExplore rows={activities.data?.activities} pending={activities.isPending} error={errorCode} onRetry={() => activities.refetch()} filters={filters} active={active} toggle={toggle} />
      </div>
      <div className="hidden sm:block">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-[34px] leading-[1.02] tracking-[-0.03em] sm:text-[44px]">What are you doing this week?</h1>
          <p className="text-base text-body">Book a spot, then bring your people. Spots update live.</p>
        </div>
        <label className="flex flex-col gap-1.5 text-xs font-bold uppercase tracking-[0.06em] text-muted-ink">
          Sort
          <Select size="sort" value={sort} onChange={(e) => setSort(e.target.value as ActivityFilters["sort"])} className="min-w-[180px]">
            <option value="soonest">Soonest first</option>
            <option value="filling">Filling up fastest</option>
          </Select>
        </label>
      </div>

      <div role="group" aria-label="Filter activities" className="mt-6 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
        {filters.map((f) => {
          const pressed = active.includes(f.key);
          return (
            <button
              key={f.key}
              type="button"
              aria-pressed={pressed}
              onClick={() => toggle(f.key)}
              className={cn("h-10 shrink-0 rounded-full px-4 text-sm", pressed ? "bg-ink font-bold text-white" : "bg-surface font-semibold text-ink shadow-[var(--shadow-card)]")}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {activities.isPending && Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}
        {activities.isError && (
          <div className="sm:col-span-2 lg:col-span-3">
            <ErrorState code={isApiError(activities.error) ? activities.error.code : "TRY_AGAIN"} action={<TextButton onClick={() => activities.refetch()}>Try again</TextButton>} />
          </div>
        )}
        {activities.data?.activities.map((a) => <ActivityCard key={a.id} activity={a} />)}
        {activities.data && activities.data.activities.length === 0 && <p className="text-body sm:col-span-2 lg:col-span-3">Nothing matches those filters yet. Try another one.</p>}
      </div>
      </div>
    </PageShell>
  );
}
