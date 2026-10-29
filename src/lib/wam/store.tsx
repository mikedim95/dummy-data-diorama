import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { MACHINES, MAINTENANCE, OPERATORS, TASKS } from "./mock-data";
import { canClaim } from "./logic";
import type { Activity, CheckState, Machine, Operator, Task } from "./types";

/**
 * Local demo store standing in for the WAM backend. Every mutation goes through
 * one function here so the swap to real endpoints happens in a single place.
 * State is persisted to localStorage so a refresh never loses work.
 */
type State = {
  operator: Operator | null;
  machineCode: string | null;
  shiftStartedAt: string | null;
  tasks: Task[];
  startChecks: Record<string, CheckState>;
  endChecks: Record<string, CheckState>;
};

const KEY = "wam-operator-v1";
const initial: State = { operator: null, machineCode: null, shiftStartedAt: null, tasks: TASKS, startChecks: {}, endChecks: {} };

type Ctx = State & {
  hydrated: boolean;
  online: boolean;
  machine: Machine | null;
  login: (id: string, pin: string) => string | null;
  lookupMachine: (code: string) => Machine | null;
  selectMachine: (code: string) => void;
  setStartCheck: (id: string, v: CheckState | null) => void;
  setEndCheck: (id: string, v: CheckState | null) => void;
  acceptTask: (id: string) => string | null;
  addActivity: (id: string, a: Omit<Activity, "id" | "at" | "by">) => void;
  completeTask: (id: string, note?: string, photos?: string[]) => void;
  finishShift: (handover: string) => Promise<void>;
};

const StoreCtx = createContext<Ctx | null>(null);
const uid = () => Math.random().toString(36).slice(2, 10);

export function WamProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(initial);
  const [hydrated, setHydrated] = useState(false);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setState({ ...initial, ...JSON.parse(raw) });
    } catch {}
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    setHydrated(true);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      // Storage full (photos) — keep state in memory.
    }
  }, [state, hydrated]);

  const lookupMachine = useCallback((code: string) => {
    const c = code.trim().toUpperCase();
    return MACHINES.find((m) => m.code === c || c.endsWith(m.code)) ?? null;
  }, []);

  const api = useMemo<Ctx>(() => {
    const op = state.operator;
    const name = op?.name ?? "Operator";
    return {
      ...state,
      hydrated,
      online,
      machine: MACHINES.find((m) => m.code === state.machineCode) ?? null,
      lookupMachine,
      login: (id, pin) => {
        const found = OPERATORS.find((o) => o.id.toUpperCase() === id.trim().toUpperCase());
        if (!found || found.pin !== pin) return "Operator ID or PIN not recognised.";
        setState((s) => ({ ...s, operator: found, shiftStartedAt: s.shiftStartedAt ?? new Date().toISOString() }));
        return null;
      },
      selectMachine: (code) => setState((s) => ({ ...s, machineCode: code, startChecks: s.machineCode === code ? s.startChecks : {} })),
      setStartCheck: (id, v) =>
        setState((s) => {
          const n = { ...s.startChecks };
          if (v) n[id] = v;
          else delete n[id];
          return { ...s, startChecks: n };
        }),
      setEndCheck: (id, v) =>
        setState((s) => {
          const n = { ...s.endChecks };
          if (v) n[id] = v;
          else delete n[id];
          return { ...s, endChecks: n };
        }),
      acceptTask: (id) => {
        if (!op) return "Not signed in.";
        const task = state.tasks.find((t) => t.id === id);
        if (!task) return "Task not found.";
        const r = canClaim(task, op.id, state.tasks);
        if (!r.ok) return r.reason;
        const now = new Date().toISOString();
        setState((s) => ({
          ...s,
          tasks: s.tasks.map((t) =>
            t.id === id
              ? { ...t, status: "active", assignee: op.id, startedAt: now, activity: [...t.activity, { id: uid(), at: now, by: name, type: "status", text: "Task accepted · In progress" }] }
              : t,
          ),
        }));
        return null;
      },
      addActivity: (id, a) =>
        setState((s) => ({
          ...s,
          tasks: s.tasks.map((t) => (t.id === id ? { ...t, activity: [...t.activity, { ...a, id: uid(), at: new Date().toISOString(), by: name }] } : t)),
        })),
      completeTask: (id, note, photos) => {
        const now = new Date().toISOString();
        setState((s) => ({
          ...s,
          tasks: s.tasks.map((t) => {
            if (t.id !== id || t.status !== "active") return t;
            const act: Activity[] = [...t.activity];
            if (note?.trim() || photos?.length) act.push({ id: uid(), at: now, by: name, type: photos?.length ? "photo" : "comment", text: note?.trim(), photos });
            act.push({ id: uid(), at: now, by: name, type: "status", text: "Machining stage finished" });
            return { ...t, status: "completed", completedAt: now, activity: act };
          }),
        }));
      },
      finishShift: async (handover) => {
        // Simulated server call recording the shift.
        await new Promise((r) => setTimeout(r, 700));
        if (!navigator.onLine) throw new Error("You're offline. Your shift will be recorded once you reconnect — try again.");
        void handover;
        setState((s) => ({ ...initial, tasks: s.tasks }));
      },
    };
  }, [state, hydrated, online, lookupMachine]);

  return <StoreCtx.Provider value={api}>{children}</StoreCtx.Provider>;
}

export function useWam() {
  const c = useContext(StoreCtx);
  if (!c) throw new Error("useWam must be inside WamProvider");
  return c;
}

export function maintenanceFor(code: string | null, phase: "start" | "end") {
  return (code ? MAINTENANCE[code] ?? [] : []).filter((m) => m.phase === phase);
}
