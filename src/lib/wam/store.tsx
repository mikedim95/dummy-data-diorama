import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { wamRequest } from "./client-api";
import type { Activity, CheckState, Machine, MaintenanceItem, Operator, Task } from "./types";

type State = {
  operator: Operator | null;
  machineCode: string | null;
  shiftStartedAt: string | null;
  tasks: Task[];
  machines: Machine[];
  maintenance: Record<string, MaintenanceItem[]>;
  startChecks: Record<string, CheckState>;
  endChecks: Record<string, CheckState>;
};
const initial: State = {
  operator: null,
  machineCode: null,
  shiftStartedAt: null,
  tasks: [],
  machines: [],
  maintenance: {},
  startChecks: {},
  endChecks: {},
};
type Ctx = State & {
  hydrated: boolean;
  online: boolean;
  backendError: string | null;
  machine: Machine | null;
  login: (id: string, pin: string) => Promise<string | null>;
  resumeSession: () => Promise<void>;
  lookupMachine: (code: string) => Machine | null;
  selectMachine: (code: string) => Promise<void>;
  setStartCheck: (id: string, value: CheckState | null) => void;
  setEndCheck: (id: string, value: CheckState | null) => void;
  acceptTask: (id: string) => Promise<string | null>;
  addActivity: (id: string, activity: Omit<Activity, "id" | "at" | "by">) => Promise<void>;
  completeTask: (id: string, note?: string, photos?: string[]) => Promise<void>;
  finishShift: (handover: string) => Promise<void>;
};
const StoreCtx = createContext<Ctx | null>(null);

export function WamProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(initial);
  const [hydrated, setHydrated] = useState(false);
  const [online, setOnline] = useState(true);
  const [backendError, setBackendError] = useState<string | null>(null);
  const pending = useRef(0);
  const generation = useRef(0);
  const writes = useRef<Promise<void>>(Promise.resolve());
  const refresh = useCallback(async () => {
    if (pending.current) return;
    const version = generation.current;
    try {
      const snapshot = await wamRequest<State>("operator");
      if (version === generation.current) {
        setState(snapshot);
        setBackendError(null);
      }
    } catch (error) {
      if (version !== generation.current) return;
      if ((error as { status?: number }).status === 401) setState(initial);
      else setBackendError((error as Error).message);
    } finally {
      setHydrated(true);
    }
  }, []);
  useEffect(() => {
    void refresh();
    setOnline(navigator.onLine);
    const on = () => {
      setOnline(true);
      void refresh();
    };
    const off = () => setOnline(false);
    const timer = window.setInterval(() => {
      if (navigator.onLine) void refresh();
    }, 15000);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      clearInterval(timer);
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, [refresh]);

  const update = useCallback((path: string, input: unknown) => {
    pending.current++;
    generation.current++;
    const operation = writes.current
      .catch(() => {})
      .then(async () => {
        try {
          setState(await wamRequest<State>(path, input));
          setBackendError(null);
        } finally {
          pending.current--;
        }
      });
    writes.current = operation;
    return operation;
  }, []);
  const resumeSession = useCallback(() => update("shift/start", {}), [update]);
  const lookupMachine = useCallback(
    (code: string) => {
      const value = code.trim().toUpperCase();
      return (
        state.machines.find((machine) => machine.code === value || value.endsWith(machine.code)) ??
        null
      );
    },
    [state.machines],
  );

  const api = useMemo<Ctx>(() => {
    const taskInput = (id: string) => {
      const task = state.tasks.find((task) => task.id === id);
      if (!task?.recordVersion) throw new Error("Refresh this task before making changes.");
      return { recordVersion: task.recordVersion };
    };
    const check = (phase: "start" | "end", id: string, value: CheckState | null) => {
      void update("checks", { phase, id, state: value, requestKey: crypto.randomUUID() }).catch(
        (error: Error) => toast.error(error.message),
      );
    };
    return {
      ...state,
      hydrated,
      online,
      backendError,
      lookupMachine,
      machine: state.machines.find((machine) => machine.code === state.machineCode) ?? null,
      resumeSession,
      login: async (id, pin) => {
        try {
          await wamRequest("login", { id, pin });
          await update("shift/start", {});
          return null;
        } catch (error) {
          return (error as Error).message;
        }
      },
      selectMachine: (code) => update("machine", { code }),
      setStartCheck: (id, value) => check("start", id, value),
      setEndCheck: (id, value) => check("end", id, value),
      acceptTask: async (id) => {
        try {
          await update(`tasks/${id}/claim`, taskInput(id));
          return null;
        } catch (error) {
          void refresh();
          return (error as Error).message;
        }
      },
      addActivity: (id, activity) =>
        update(`tasks/${id}/activity`, {
          ...taskInput(id),
          text: activity.text,
          photos: activity.photos,
        }),
      completeTask: (id, note, photos) =>
        update(`tasks/${id}/complete`, { ...taskInput(id), text: note, photos }),
      finishShift: async (handover) => {
        pending.current++;
        generation.current++;
        try {
          await wamRequest("shift/finish", { handover });
          setState(initial);
        } finally {
          pending.current--;
        }
      },
    };
  }, [state, hydrated, online, backendError, lookupMachine, refresh, update, resumeSession]);
  return <StoreCtx.Provider value={api}>{children}</StoreCtx.Provider>;
}

export function useWam() {
  const context = useContext(StoreCtx);
  if (!context) throw new Error("useWam must be inside WamProvider");
  return context;
}
export function useMaintenanceFor(code: string | null, phase: "start" | "end") {
  const { maintenance } = useWam();
  return (code ? (maintenance[code] ?? []) : []).filter((item) => item.phase === phase);
}
