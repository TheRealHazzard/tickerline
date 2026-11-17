import { useSyncExternalStore } from 'react';
import type { ConnectionStatus, Interval, Ticker } from './types';

export type State = {
  tickers: Record<string, Ticker>;
  sparks: Record<string, number[]>;
  watchlist: string[];
  selected: string;
  interval: Interval;
  status: ConnectionStatus;
  error: string | null;
};

const KEY = 'tickerline:v1';
export const DEFAULT_WATCHLIST = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'ADAUSDT', 'DOGEUSDT', 'AVAXUSDT'];

type Persisted = Pick<State, 'watchlist' | 'selected' | 'interval'>;

function loadPersisted(): Persisted {
  const fallback: Persisted = { watchlist: DEFAULT_WATCHLIST, selected: 'BTCUSDT', interval: '1h' };
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Persisted> | null;
    if (!raw || !Array.isArray(raw.watchlist) || raw.watchlist.length === 0) return fallback;
    const watchlist = raw.watchlist.filter((s): s is string => typeof s === 'string');
    const selected = watchlist.includes(raw.selected ?? '') ? (raw.selected as string) : watchlist[0];
    const interval = (['15m', '1h', '4h', '1d'] as const).find((i) => i === raw.interval) ?? '1h';
    return { watchlist, selected, interval };
  } catch {
    return fallback;
  }
}

function persist(s: State) {
  try {
    const p: Persisted = { watchlist: s.watchlist, selected: s.selected, interval: s.interval };
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // storage unavailable: preferences just last for this session
  }
}

export function createStore(initial?: Partial<State>) {
  let state: State = {
    tickers: {},
    sparks: {},
    status: 'connecting',
    error: null,
    ...loadPersisted(),
    ...initial,
  };
  const listeners = new Set<() => void>();

  function set(patch: Partial<State>, save = false) {
    state = { ...state, ...patch };
    if (save) persist(state);
    listeners.forEach((l) => l());
  }

  return {
    get: () => state,
    subscribe(l: () => void) {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
    applyTickers(list: Ticker[]) {
      const next = { ...state.tickers };
      for (const t of list) {
        const prev = next[t.symbol];
        next[t.symbol] = prev ? { ...t, dir: t.price > prev.price ? 1 : t.price < prev.price ? -1 : prev.dir } : t;
      }
      set({ tickers: next });
    },
    setSparks(sparks: Record<string, number[]>) {
      set({ sparks: { ...state.sparks, ...sparks } });
    },
    setStatus(status: ConnectionStatus) {
      set({ status });
    },
    setError(error: string | null) {
      set({ error });
    },
    select(symbol: string) {
      set({ selected: symbol }, true);
    },
    setInterval(interval: Interval) {
      set({ interval }, true);
    },
    addSymbol(symbol: string) {
      if (state.watchlist.includes(symbol)) return set({ selected: symbol }, true);
      set({ watchlist: [...state.watchlist, symbol], selected: symbol }, true);
    },
    removeSymbol(symbol: string) {
      if (state.watchlist.length <= 1) return;
      const watchlist = state.watchlist.filter((s) => s !== symbol);
      set({ watchlist, selected: state.selected === symbol ? watchlist[0] : state.selected }, true);
    },
  };
}

export type Store = ReturnType<typeof createStore>;
export const store = createStore();

/** Subscribe a component to a slice of the store. The selector must return a stable reference when nothing relevant changed. */
export function useStore<T>(selector: (s: State) => T): T {
  return useSyncExternalStore(store.subscribe, () => selector(store.get()));
}
