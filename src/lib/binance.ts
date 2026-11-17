import type { Candle, ConnectionStatus, Interval, Ticker } from './types';

// Binance's public market-data hosts: no API key, CORS-enabled, read-only.
const REST = 'https://data-api.binance.vision/api/v3';
const WS_URL = 'wss://data-stream.binance.vision/stream';

type RawTicker24h = { symbol: string; lastPrice: string; openPrice: string; highPrice: string; lowPrice: string; quoteVolume: string };

export function toTicker(raw: RawTicker24h, previous?: Ticker): Ticker {
  const price = Number(raw.lastPrice);
  const open = Number(raw.openPrice);
  return {
    symbol: raw.symbol,
    price,
    open,
    high: Number(raw.highPrice),
    low: Number(raw.lowPrice),
    volume: Number(raw.quoteVolume),
    change: open ? ((price - open) / open) * 100 : 0,
    dir: previous ? (price > previous.price ? 1 : price < previous.price ? -1 : 0) : 0,
    updated: Date.now(),
  };
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${REST}${path}`);
  if (!res.ok) throw new Error(`Market data request failed (${res.status})`);
  return (await res.json()) as T;
}

export async function fetchTickers(symbols: string[]): Promise<Ticker[]> {
  if (!symbols.length) return [];
  const raw = await getJson<RawTicker24h[]>(`/ticker/24hr?symbols=${encodeURIComponent(JSON.stringify(symbols))}`);
  return raw.map((r) => toTicker(r));
}

export async function fetchTicker(symbol: string): Promise<Ticker> {
  return toTicker(await getJson<RawTicker24h>(`/ticker/24hr?symbol=${symbol}`));
}

export function parseKlineRow(row: (string | number)[]): Candle {
  return {
    time: Math.floor(Number(row[0]) / 1000),
    open: Number(row[1]),
    high: Number(row[2]),
    low: Number(row[3]),
    close: Number(row[4]),
    volume: Number(row[5]),
  };
}

export async function fetchKlines(symbol: string, interval: Interval, limit = 300): Promise<Candle[]> {
  const rows = await getJson<(string | number)[][]>(`/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`);
  return rows.map(parseKlineRow);
}

/** Last 24 hourly closes, for the sparkline next to each symbol. */
export async function fetchSparkline(symbol: string): Promise<number[]> {
  return (await fetchKlines(symbol, '1h', 24)).map((c) => c.close);
}

// ---- WebSocket ------------------------------------------------------------

export type MiniTickerMessage = { s: string; c: string; o: string; h: string; l: string; q: string };
export type KlineMessage = { s: string; k: { t: number; i: string; o: string; h: string; l: string; c: string; v: string } };

export type SocketEvent =
  | { type: 'miniTicker'; data: MiniTickerMessage }
  | { type: 'kline'; data: KlineMessage };

/** Turn a raw combined-stream frame into a typed event, or null for anything we do not use. */
export function parseFrame(frame: string): SocketEvent | null {
  let msg: { stream?: string; data?: Record<string, unknown> };
  try {
    msg = JSON.parse(frame);
  } catch {
    return null;
  }
  if (!msg.stream || !msg.data) return null;
  if (msg.stream.endsWith('@miniTicker')) return { type: 'miniTicker', data: msg.data as unknown as MiniTickerMessage };
  if (msg.stream.includes('@kline_')) return { type: 'kline', data: msg.data as unknown as KlineMessage };
  return null;
}

export function candleFromKline(m: KlineMessage): Candle {
  return {
    time: Math.floor(m.k.t / 1000),
    open: Number(m.k.o),
    high: Number(m.k.h),
    low: Number(m.k.l),
    close: Number(m.k.c),
    volume: Number(m.k.v),
  };
}

type SocketLike = {
  send(data: string): void;
  close(): void;
  onopen: (() => void) | null;
  onclose: (() => void) | null;
  onmessage: ((e: { data: unknown }) => void) | null;
};
type SocketFactory = (url: string) => SocketLike;

/**
 * A WebSocket that stays connected: reconnects with exponential backoff and
 * re-subscribes to every stream it was asked for, so callers never think about it.
 */
export class MarketSocket {
  private ws: SocketLike | null = null;
  private streams = new Set<string>();
  private attempts = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private closed = false;
  private open = false;
  private nextId = 1;

  constructor(
    private onEvent: (e: SocketEvent) => void,
    private onStatus: (s: ConnectionStatus) => void,
    private factory: SocketFactory = (url) => new WebSocket(url) as unknown as SocketLike,
    private baseDelay = 1000,
  ) {}

  connect() {
    this.closed = false;
    this.onStatus(this.attempts === 0 ? 'connecting' : 'reconnecting');
    const ws = this.factory(WS_URL);
    this.ws = ws;
    ws.onopen = () => {
      this.open = true;
      this.attempts = 0;
      this.onStatus('live');
      if (this.streams.size) this.send('SUBSCRIBE', [...this.streams]);
    };
    ws.onmessage = (e) => {
      const event = parseFrame(String(e.data));
      if (event) this.onEvent(event);
    };
    ws.onclose = () => {
      this.open = false;
      this.ws = null;
      if (this.closed) return;
      this.attempts++;
      this.onStatus(this.attempts > 5 ? 'offline' : 'reconnecting');
      const delay = Math.min(30_000, this.baseDelay * 2 ** Math.min(this.attempts, 5));
      this.timer = setTimeout(() => this.connect(), delay);
    };
  }

  subscribe(streams: string[]) {
    const fresh = streams.filter((s) => !this.streams.has(s));
    fresh.forEach((s) => this.streams.add(s));
    if (fresh.length) this.send('SUBSCRIBE', fresh);
  }

  unsubscribe(streams: string[]) {
    const known = streams.filter((s) => this.streams.delete(s));
    if (known.length) this.send('UNSUBSCRIBE', known);
  }

  close() {
    this.closed = true;
    if (this.timer) clearTimeout(this.timer);
    this.ws?.close();
    this.ws = null;
  }

  private send(method: 'SUBSCRIBE' | 'UNSUBSCRIBE', params: string[]) {
    // Not connected yet: the full stream set is sent on open.
    if (this.open) this.ws?.send(JSON.stringify({ method, params, id: this.nextId++ }));
  }
}
