"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { UserProvider } from "@/lib/user-context";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 10_000, retry: 1, refetchOnWindowFocus: true },
        },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <UserProvider>{children}</UserProvider>
    </QueryClientProvider>
  );
}
