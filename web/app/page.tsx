"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";

export default function HomePage() {
  const health = useQuery({ queryKey: ["health"], queryFn: api.health, refetchInterval: 10_000 });

  return (
    <main className="mx-auto flex min-h-dvh max-w-5xl flex-col gap-6 px-4 py-10">
      <header className="flex items-center justify-between">
        <span className="font-heading text-xl font-bold tracking-tight">velio</span>
        {health.data ? (
          <Badge variant="secondary">Backend {health.data.ok ? "connected" : "degraded"}</Badge>
        ) : health.isError ? (
          <Badge variant="destructive">Backend unreachable</Badge>
        ) : (
          <Badge variant="outline">Checking backend</Badge>
        )}
      </header>
      <section className="rounded-2xl bg-card p-6 shadow-[var(--shadow-card)]">
        <h1 className="text-3xl leading-tight">What are you doing this week?</h1>
        <p className="mt-2 text-body">Book a spot, then bring your people. Spots update live.</p>
        <p className="mt-6 text-sm text-muted-ink">
          Explore, activities, invites and the host pages are built in the web phase against API.md.
        </p>
      </section>
    </main>
  );
}
