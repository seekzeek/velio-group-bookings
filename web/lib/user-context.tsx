"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

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
    // Private windows can refuse storage. The picker still works for the session.
  }
}

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [userId, setUserIdState] = useState<string | null>(null);
  const [anonId, setAnonId] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setUserIdState(readStorage(STORAGE_KEY));
    let anon = readStorage(ANON_KEY);
    if (!anon) {
      anon = crypto.randomUUID();
      writeStorage(ANON_KEY, anon);
    }
    setAnonId(anon);
    setReady(true);
  }, []);

  const setUserId = useCallback((id: string | null) => {
    setUserIdState(id);
    writeStorage(STORAGE_KEY, id);
  }, []);

  const value = useMemo(() => ({ userId, anonId, setUserId, ready }), [userId, anonId, setUserId, ready]);
  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser must be used inside UserProvider");
  return ctx;
}
