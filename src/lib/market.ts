import {
  candleFromKline,
  fetchSparkline,
  fetchTicker,
  fetchTickers,
  MarketSocket,
  toTicker,
  type KlineMessage,
} from './binance';
import { store } from './store';
import type { Candle, Interval } from './types';

type KlineListener = (candle: Candle, symbol: string, interval: Interval) => void;

const klineListeners = new Set<KlineListener>();
let socket: MarketSocket | null = null;
let subscribed = new Set<string>();
// Kline streams wanted by mounted charts. Child effects run before the app starts the socket, so they are remembered here.
const klineStreams = new Map<string, number>();

const tickerStream = (symbol: string) => `${symbol.toLowerCase()}@miniTicker`;

function syncTickerStreams() {
  if (!socket) return;
  const wanted = new Set(store.get().watchlist.map(tickerStream));
  socket.subscribe([...wanted].filter((s) => !subscribed.has(s)));
  socket.unsubscribe([...subscribed].filter((s) => !wanted.has(s)));
  subscribed = wanted;
}

async function loadSnapshot(symbols: string[]) {
  const tickers = await fetchTickers(symbols);
  store.applyTickers(tickers);
  const entries = await Promise.all(
    symbols.map(async (s) => [s, await fetchSparkline(s).catch(() => [] as number[])] as const),
  );
  store.setSparks(Object.fromEntries(entries));
}

/** Start the live market feed. Returns a function that stops it. */
export function startMarket(): () => void {
  store.setError(null);
  loadSnapshot(store.get().watchlist).catch((e: Error) => store.setError(e.message));

  socket = new MarketSocket(
    (event) => {
      if (event.type === 'miniTicker') {
        const m = event.data;
        store.applyTickers([
          toTicker({ symbol: m.s, lastPrice: m.c, openPrice: m.o, highPrice: m.h, lowPrice: m.l, quoteVolume: m.q }),
        ]);
      } else {
        const m: KlineMessage = event.data;
        klineListeners.forEach((l) => l(candleFromKline(m), m.s, m.k.i as Interval));
      }
    },
    (status) => store.setStatus(status),
  );
  socket.connect();
  subscribed = new Set();
  syncTickerStreams();
  if (klineStreams.size) socket.subscribe([...klineStreams.keys()]);
  const unsubscribe = store.subscribe(syncTickerStreams);

  return () => {
    unsubscribe();
    socket?.close();
    socket = null;
    subscribed = new Set();
  };
}

/** Receive live candle updates for one symbol and interval. */
export function watchKline(symbol: string, interval: Interval, listener: KlineListener): () => void {
  const stream = `${symbol.toLowerCase()}@kline_${interval}`;
  const filtered: KlineListener = (c, s, i) => {
    if (s === symbol && i === interval) listener(c, s, i);
  };
  klineListeners.add(filtered);
  klineStreams.set(stream, (klineStreams.get(stream) ?? 0) + 1);
  socket?.subscribe([stream]);
  return () => {
    klineListeners.delete(filtered);
    const left = (klineStreams.get(stream) ?? 1) - 1;
    if (left > 0) klineStreams.set(stream, left);
    else {
      klineStreams.delete(stream);
      socket?.unsubscribe([stream]);
    }
  };
}

/** Add a symbol after checking it exists on the exchange. Returns an error message, or null on success. */
export async function addSymbol(symbol: string): Promise<string | null> {
  if (store.get().watchlist.includes(symbol)) {
    store.select(symbol);
    return null;
  }
  try {
    const ticker = await fetchTicker(symbol);
    store.applyTickers([ticker]);
    store.addSymbol(symbol);
    fetchSparkline(symbol).then((s) => store.setSparks({ [symbol]: s })).catch(() => {});
    return null;
  } catch {
    return `Could not find ${symbol} on the exchange.`;
  }
}
