/** Simple moving average. Entries before the window is full are null. */
export function sma(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

/** Relative Strength Index with Wilder's smoothing. */
export function rsi(values: number[], period = 14): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (values.length <= period) return out;

  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = values[i] - values[i - 1];
    if (d >= 0) gain += d;
    else loss -= d;
  }
  gain /= period;
  loss /= period;
  out[period] = toRsi(gain, loss);

  for (let i = period + 1; i < values.length; i++) {
    const d = values[i] - values[i - 1];
    gain = (gain * (period - 1) + Math.max(d, 0)) / period;
    loss = (loss * (period - 1) + Math.max(-d, 0)) / period;
    out[i] = toRsi(gain, loss);
  }
  return out;
}

function toRsi(avgGain: number, avgLoss: number): number {
  if (avgLoss === 0) return avgGain === 0 ? 50 : 100;
  return 100 - 100 / (1 + avgGain / avgLoss);
}

export type Trend = 'bullish' | 'bearish' | 'neutral';
export type Momentum = 'overbought' | 'oversold' | 'neutral';

export type Signals = {
  trend: Trend;
  momentum: Momentum;
  rsi: number | null;
  fast: number | null;
  slow: number | null;
  /** A fast/slow average cross within the last few candles, if any. */
  recentCross: 'up' | 'down' | null;
};

/** Plain, explainable signals: SMA(20) vs SMA(50) for trend, RSI(14) for momentum. */
export function computeSignals(closes: number[]): Signals {
  const fastSeries = sma(closes, 20);
  const slowSeries = sma(closes, 50);
  const rsiSeries = rsi(closes, 14);
  const last = closes.length - 1;
  const fast = fastSeries[last] ?? null;
  const slow = slowSeries[last] ?? null;
  const r = rsiSeries[last] ?? null;

  let trend: Trend = 'neutral';
  if (fast !== null && slow !== null) trend = fast > slow ? 'bullish' : fast < slow ? 'bearish' : 'neutral';

  let momentum: Momentum = 'neutral';
  if (r !== null) momentum = r >= 70 ? 'overbought' : r <= 30 ? 'oversold' : 'neutral';

  let recentCross: Signals['recentCross'] = null;
  for (let i = Math.max(1, last - 4); i <= last; i++) {
    const f0 = fastSeries[i - 1], s0 = slowSeries[i - 1], f1 = fastSeries[i], s1 = slowSeries[i];
    if (f0 === null || s0 === null || f1 === null || s1 === null) continue;
    if (f0 <= s0 && f1 > s1) recentCross = 'up';
    else if (f0 >= s0 && f1 < s1) recentCross = 'down';
  }

  return { trend, momentum, rsi: r, fast, slow, recentCross };
}
