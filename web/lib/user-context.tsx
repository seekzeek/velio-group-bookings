"use client";

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from "react";

const STORAGE_KEY = "velio.userId";
const ANON_KEY = "velio.anonId";

type UserContextValue = {
  userId: string | null;
  anonId: string;
  setUserId: (id: string | null) => void;
  ready: boolean;
};

const UserContext = createContext<UserContextValue | null>(null);

function readStorage(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // Private windows can refuse storage. The picker still works for the session through the in-memory fallback.
  }
}

// localStorage is the store; React reads it through useSyncExternalStore so the server render and the first client render agree.
const listeners = new Set<() => void>();
let memoryUserId: string | null = null;
let memoryAnonId: string | null = null;

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function getUserId() {
  return readStorage(STORAGE_KEY) ?? memoryUserId;
}

function getAnonId() {
  if (memoryAnonId) return memoryAnonId;
  memoryAnonId = readStorage(ANON_KEY) ?? crypto.randomUUID();
  writeStorage(ANON_KEY, memoryAnonId);
  return memoryAnonId;
}

export function UserProvider({ children }: { children: React.ReactNode }) {
  const userId = useSyncExternalStore(subscribe, getUserId, () => null);
  const anonId = useSyncExternalStore(subscribe, getAnonId, () => "");
  const ready = useSyncExternalStore(subscribe, () => true, () => false);

  const setUserId = useCallback((id: string | null) => {
    memoryUserId = id;
    writeStorage(STORAGE_KEY, id);
    for (const l of listeners) l();
  }, []);

  const value = useMemo(() => ({ userId, anonId, setUserId, ready }), [userId, anonId, setUserId, ready]);
  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser must be used inside UserProvider");
  return ctx;
}
