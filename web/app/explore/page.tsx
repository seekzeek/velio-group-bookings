"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { ActivityCard } from "@/components/activity-card";
import { CardSkeleton, ErrorState, Toast } from "@/components/bits";
import { PageShell } from "@/components/page-shell";
import { api, type Activity, type ActivityFilters, type Category } from "@/lib/api";
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
  const { userId, anonId, ready } = useUser();
  const [active, setActive] = useState<Filter[]>([]);
  const [sort, setSort] = useState<ActivityFilters["sort"]>("soonest");
  const [toast, setToast] = useState<string | null>(null);
  const router = useRouter();
  const queryClient = useQueryClient();

  const params: ActivityFilters = {
    sort,
    category: active.find((f) => f !== "week" && f !== "group") as Category | undefined,
    minSpotsLeft: active.includes("group") ? 4 : undefined,
    until: active.includes("week") ? endOfComingSunday() : undefined,
  };
  const queryKey = ["activities", params, userId];
  // Explore polls instead of opening a stream per card: browsers cap connections per origin, and six cards would use them all.
  const activities = useQuery({ queryKey, queryFn: () => api.activities(params, userId), enabled: ready, refetchInterval: 10_000 });

  const book = useMutation({
    mutationFn: (activity: Activity) => api.book(userId!, activity.id, { idempotencyKey: crypto.randomUUID(), platform: "web", anonId }),
    onMutate: async (activity) => {
      await queryClient.cancelQueries({ queryKey });
      queryClient.setQueryData<{ activities: Activity[] }>(queryKey, (old) =>
        old ? { activities: old.activities.map((a) => (a.id === activity.id ? { ...a, spotsTaken: a.spotsTaken + 1, spotsLeft: a.spotsLeft - 1 } : a)) } : old,
      );
    },
    onSuccess: (result) => {
      queryClient.setQueryData(["activity", result.activity.id], { activity: result.activity });
      router.push(`/activities/${result.activity.id}`);
    },
    onError: (err) => {
      void queryClient.invalidateQueries({ queryKey });
      if (isApiError(err, "SOLD_OUT")) setToast("Someone got there a second before you. That one just filled up.");
      else if (isApiError(err, "ALREADY_BOOKED")) setToast("You're already going to that one.");
      else setToast("Something went wrong on our side. Nothing was booked.");
    },
  });

  const toggle = (key: Filter) =>
    setActive((current) => {
      const isCategory = key !== "week" && key !== "group";
      const without = current.filter((f) => (isCategory ? f === "week" || f === "group" : f !== key));
      return current.includes(key) ? without : [...without, key];
    });

  const onBook = useCallback(
    (activity: Activity) => {
      if (!userId) {
        setToast("Pick who you are at the top of the page first.");
        return;
      }
      book.mutate(activity);
    },
    [book, userId],
  );

  return (
    <PageShell>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl sm:text-4xl">What are you doing this week?</h1>
          <p className="mt-2 text-body">Book a spot, then bring your people. Spots update live.</p>
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold text-muted-ink">
          Sort
          <select className="h-10 rounded-xl border border-line bg-surface px-3 text-sm font-semibold text-ink" value={sort} onChange={(e) => setSort(e.target.value as ActivityFilters["sort"])}>
            <option value="soonest">Soonest first</option>
            <option value="filling">Filling up fastest</option>
            <option value="price">Lowest price</option>
          </select>
        </label>
      </div>

      <div role="group" aria-label="Filter activities" className="mt-5 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
        {filters.map((f) => {
          const pressed = active.includes(f.key);
          return (
            <button
              key={f.key}
              type="button"
              aria-pressed={pressed}
              onClick={() => toggle(f.key)}
              className={cn("h-10 shrink-0 rounded-full border px-4 text-sm font-semibold", pressed ? "border-ink bg-ink text-white" : "border-line bg-surface text-body")}
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
            <ErrorState code={isApiError(activities.error) ? activities.error.code : "TRY_AGAIN"} action={<button className="text-sm font-bold text-brand" onClick={() => activities.refetch()}>Try again</button>} />
          </div>
        )}
        {activities.data?.activities.map((a) => <ActivityCard key={a.id} activity={a} onBook={onBook} />)}
        {activities.data && activities.data.activities.length === 0 && (
          <p className="text-body sm:col-span-2 lg:col-span-3">Nothing matches those filters yet. Try another one.</p>
        )}
      </div>
      <Toast message={toast} onDone={() => setToast(null)} />
    </PageShell>
  );
}
