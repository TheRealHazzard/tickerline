import { useEffect, useState } from 'react';
import { fetchKlines } from './binance';
import { watchKline } from './market';
import type { Candle, Interval } from './types';

type Loaded = { key: string; candles: Candle[] };

/** Historical candles for a symbol and interval, kept up to date by the live stream. */
export function useKlines(symbol: string, interval: Interval) {
  const key = `${symbol}:${interval}`;
  const [loaded, setLoaded] = useState<Loaded>({ key: '', candles: [] });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);

    fetchKlines(symbol, interval)
      .then((candles) => !cancelled && setLoaded({ key, candles }))
      .catch((e: Error) => !cancelled && setError(e.message));

    const off = watchKline(symbol, interval, (candle) => {
      if (cancelled) return;
      setLoaded((prev) => {
        if (prev.key !== key || prev.candles.length === 0) return prev;
        const last = prev.candles[prev.candles.length - 1];
        const candles =
          candle.time === last.time
            ? [...prev.candles.slice(0, -1), candle]
            : candle.time > last.time
              ? [...prev.candles, candle]
              : prev.candles;
        return { key, candles };
      });
    });

    return () => {
      cancelled = true;
      off();
    };
  }, [symbol, interval, key]);

  const ready = loaded.key === key;
  return { candles: ready ? loaded.candles : [], loadedKey: ready ? key : '', loading: !ready && !error, error };
}
