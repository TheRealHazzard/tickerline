import { describe, expect, it, vi } from 'vitest';
import { computeSignals, rsi, sma } from './indicators';
import { baseAsset, formatCompact, formatPercent, formatPrice, normalizeSymbol } from './format';
import { MarketSocket, parseFrame, parseKlineRow, toTicker, type SocketEvent } from './binance';
import { createStore } from './store';

describe('indicators', () => {
  it('computes a simple moving average with leading nulls', () => {
    expect(sma([1, 2, 3, 4, 5], 3)).toEqual([null, null, 2, 3, 4]);
  });

  it('gives RSI 100 for a series that only rises, and 0 for one that only falls', () => {
    const up = Array.from({ length: 30 }, (_, i) => i + 1);
    const down = [...up].reverse();
    expect(rsi(up).at(-1)).toBe(100);
    expect(rsi(down).at(-1)).toBe(0);
  });

  it('leaves RSI empty until there is enough data', () => {
    expect(rsi([1, 2, 3], 14).every((v) => v === null)).toBe(true);
  });

  it('reads a steady uptrend as bullish and overbought', () => {
    const closes = Array.from({ length: 80 }, (_, i) => 100 + i);
    const s = computeSignals(closes);
    expect(s.trend).toBe('bullish');
    expect(s.momentum).toBe('overbought');
  });

  it('reads a steady downtrend as bearish and oversold', () => {
    const closes = Array.from({ length: 80 }, (_, i) => 200 - i);
    const s = computeSignals(closes);
    expect(s.trend).toBe('bearish');
    expect(s.momentum).toBe('oversold');
  });

  it('stays neutral when there is too little data for the slow average', () => {
    expect(computeSignals([1, 2, 3, 4, 5]).trend).toBe('neutral');
  });

  it('detects a fresh upward crossover', () => {
    const closes = [...Array.from({ length: 60 }, (_, i) => 200 - i), ...Array.from({ length: 12 }, (_, i) => 140 + i * 8)];
    expect(computeSignals(closes).recentCross).toBe('up');
  });
});

describe('format', () => {
  it('uses precision that fits the price', () => {
    expect(formatPrice(63820.714)).toBe('63,820.71');
    expect(formatPrice(1.23456)).toBe('1.235');
    expect(formatPrice(0.000012345)).toBe('0.0000123');
  });

  it('signs percentages and compacts large numbers', () => {
    expect(formatPercent(1.234)).toBe('+1.23%');
    expect(formatPercent(-0.5)).toBe('-0.50%');
    expect(formatCompact(1_234_000)).toBe('1.23M');
  });

  it('normalizes symbol input', () => {
    expect(normalizeSymbol(' sol ')).toBe('SOLUSDT');
    expect(normalizeSymbol('ethusdt')).toBe('ETHUSDT');
    expect(normalizeSymbol('not a coin!')).toBeNull();
    expect(normalizeSymbol('')).toBeNull();
    expect(baseAsset('BTCUSDT')).toBe('BTC');
  });
});

describe('binance parsing', () => {
  it('parses a REST kline row', () => {
    expect(parseKlineRow([1794934800000, '1', '3', '0.5', '2', '10'])).toEqual({
      time: 1794934800,
      open: 1,
      high: 3,
      low: 0.5,
      close: 2,
      volume: 10,
    });
  });

  it('computes the 24h change and tick direction', () => {
    const base = { symbol: 'X', lastPrice: '110', openPrice: '100', highPrice: '120', lowPrice: '90', quoteVolume: '5' };
    const first = toTicker(base);
    expect(first.change).toBeCloseTo(10);
    expect(toTicker({ ...base, lastPrice: '111' }, first).dir).toBe(1);
    expect(toTicker({ ...base, lastPrice: '109' }, first).dir).toBe(-1);
  });

  it('ignores frames it does not understand', () => {
    expect(parseFrame('not json')).toBeNull();
    expect(parseFrame(JSON.stringify({ result: null, id: 1 }))).toBeNull();
    expect(parseFrame(JSON.stringify({ stream: 'x@depth', data: {} }))).toBeNull();
    const ev = parseFrame(JSON.stringify({ stream: 'btcusdt@miniTicker', data: { s: 'BTCUSDT' } }));
    expect(ev?.type).toBe('miniTicker');
  });
});

describe('MarketSocket', () => {
  function fakeFactory() {
    const sockets: FakeSocket[] = [];
    class FakeSocket {
      sent: string[] = [];
      onopen: (() => void) | null = null;
      onclose: (() => void) | null = null;
      onmessage: ((e: { data: unknown }) => void) | null = null;
      send(d: string) { this.sent.push(d); }
      close() { this.onclose?.(); }
    }
    return { sockets, factory: () => { const s = new FakeSocket(); sockets.push(s); return s; } };
  }

  it('subscribes once open and delivers parsed events', () => {
    vi.useFakeTimers();
    const { sockets, factory } = fakeFactory();
    const events: SocketEvent[] = [];
    const status: string[] = [];
    const ws = new MarketSocket((e) => events.push(e), (s) => status.push(s), factory, 10);

    ws.connect();
    ws.subscribe(['btcusdt@miniTicker']); // before open: must not throw or send
    expect(sockets[0].sent).toHaveLength(0);
    sockets[0].onopen?.();
    expect(JSON.parse(sockets[0].sent[0])).toMatchObject({ method: 'SUBSCRIBE', params: ['btcusdt@miniTicker'] });

    sockets[0].onmessage?.({ data: JSON.stringify({ stream: 'btcusdt@miniTicker', data: { s: 'BTCUSDT' } }) });
    expect(events).toHaveLength(1);
    expect(status).toEqual(['connecting', 'live']);
    ws.close();
    vi.useRealTimers();
  });

  it('reconnects after a drop and resubscribes to everything', () => {
    vi.useFakeTimers();
    const { sockets, factory } = fakeFactory();
    const status: string[] = [];
    const ws = new MarketSocket(() => {}, (s) => status.push(s), factory, 10);

    ws.connect();
    sockets[0].onopen?.();
    ws.subscribe(['a@miniTicker', 'b@miniTicker']);
    sockets[0].onclose?.(); // network drop
    expect(status.at(-1)).toBe('reconnecting');

    vi.advanceTimersByTime(1000);
    expect(sockets).toHaveLength(2);
    sockets[1].onopen?.();
    expect(JSON.parse(sockets[1].sent[0]).params).toEqual(['a@miniTicker', 'b@miniTicker']);
    expect(status.at(-1)).toBe('live');
    ws.close();
    vi.useRealTimers();
  });

  it('does not reconnect after an intentional close', () => {
    vi.useFakeTimers();
    const { sockets, factory } = fakeFactory();
    const ws = new MarketSocket(() => {}, () => {}, factory, 10);
    ws.connect();
    ws.close();
    vi.advanceTimersByTime(60_000);
    expect(sockets).toHaveLength(1);
    vi.useRealTimers();
  });
});

describe('store', () => {
  const tick = (symbol: string, price: number) => toTicker({ symbol, lastPrice: String(price), openPrice: '100', highPrice: '0', lowPrice: '0', quoteVolume: '0' });

  it('tracks tick direction across updates', () => {
    const s = createStore({ watchlist: ['A'], selected: 'A' });
    s.applyTickers([tick('A', 100)]);
    s.applyTickers([tick('A', 101)]);
    expect(s.get().tickers.A.dir).toBe(1);
    s.applyTickers([tick('A', 99)]);
    expect(s.get().tickers.A.dir).toBe(-1);
  });

  it('keeps one symbol in the watchlist and moves the selection when removing', () => {
    const s = createStore({ watchlist: ['A', 'B'], selected: 'B' });
    s.removeSymbol('B');
    expect(s.get().watchlist).toEqual(['A']);
    expect(s.get().selected).toBe('A');
    s.removeSymbol('A');
    expect(s.get().watchlist).toEqual(['A']);
  });

  it('selects an existing symbol instead of duplicating it', () => {
    const s = createStore({ watchlist: ['A', 'B'], selected: 'A' });
    s.addSymbol('B');
    expect(s.get().watchlist).toEqual(['A', 'B']);
    expect(s.get().selected).toBe('B');
  });
});
