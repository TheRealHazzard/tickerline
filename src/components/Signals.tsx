import { computeSignals } from '../lib/indicators';
import type { Candle } from '../lib/types';

const TREND = {
  bullish: 'Bullish. The 20-period average is above the 50-period average.',
  bearish: 'Bearish. The 20-period average is below the 50-period average.',
  neutral: 'Neutral. Not enough data for the 50-period average yet.',
} as const;

const MOMENTUM = {
  overbought: 'Overbought. RSI is at or above 70.',
  oversold: 'Oversold. RSI is at or below 30.',
  neutral: 'Neutral. RSI is between 30 and 70.',
} as const;

export function Signals({ candles }: { candles: Candle[] }) {
  if (candles.length < 2) return null;
  const s = computeSignals(candles.map((c) => c.close));
  return (
    <section className="signals" aria-label="Indicator signals">
      <div className="sig">
        <span className="label">Trend</span>
        <strong className={s.trend}>{s.trend}</strong>
        <p>{TREND[s.trend]}</p>
        {s.recentCross && <p className="note">A {s.recentCross === 'up' ? 'bullish' : 'bearish'} crossover happened in the last few candles.</p>}
      </div>
      <div className="sig">
        <span className="label">Momentum &middot; RSI(14) {s.rsi !== null ? s.rsi.toFixed(0) : '-'}</span>
        <strong className={s.momentum}>{s.momentum}</strong>
        <p>{MOMENTUM[s.momentum]}</p>
      </div>
    </section>
  );
}
