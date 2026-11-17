import { useEffect, useRef } from 'react';
import {
  CandlestickSeries,
  ColorType,
  createChart,
  HistogramSeries,
  LineSeries,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from 'lightweight-charts';
import { sma } from '../lib/indicators';
import type { Candle } from '../lib/types';

type Props = { candles: Candle[]; loadedKey: string };

const t = (c: Candle) => c.time as UTCTimestamp;

export function PriceChart({ candles, loadedKey }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);
  const series = useRef<{
    candle: ISeriesApi<'Candlestick'>;
    volume: ISeriesApi<'Histogram'>;
    sma: ISeriesApi<'Line'>;
  } | null>(null);
  const shownKey = useRef('');

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const css = getComputedStyle(document.documentElement);
    const c = (name: string) => css.getPropertyValue(name).trim();

    const api = createChart(el, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: c('--muted'), fontFamily: 'system-ui, sans-serif' },
      grid: { vertLines: { color: c('--grid') }, horzLines: { color: c('--grid') } },
      rightPriceScale: { borderColor: c('--line') },
      timeScale: { borderColor: c('--line'), timeVisible: true },
      crosshair: { mode: 0 },
    });
    const candle = api.addSeries(CandlestickSeries, {
      upColor: c('--green'),
      downColor: c('--red'),
      wickUpColor: c('--green'),
      wickDownColor: c('--red'),
      borderVisible: false,
    });
    const volume = api.addSeries(HistogramSeries, { priceFormat: { type: 'volume' }, priceScaleId: 'vol', color: '#58a6ff55' });
    api.priceScale('vol').applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
    const average = api.addSeries(LineSeries, { color: c('--cyan'), lineWidth: 2, priceLineVisible: false, lastValueVisible: false });

    chart.current = api;
    series.current = { candle, volume, sma: average };
    return () => {
      api.remove();
      chart.current = null;
      series.current = null;
      shownKey.current = '';
    };
  }, []);

  useEffect(() => {
    const s = series.current;
    if (!s || !loadedKey || candles.length === 0) return;
    const last = candles[candles.length - 1];
    const green = getComputedStyle(document.documentElement).getPropertyValue('--green-fade').trim();
    const red = getComputedStyle(document.documentElement).getPropertyValue('--red-fade').trim();
    const bar = (c: Candle) => ({ time: t(c), value: c.volume, color: c.close >= c.open ? green : red });

    if (shownKey.current !== loadedKey) {
      // A new symbol or interval: replace everything and fit the view.
      shownKey.current = loadedKey;
      s.candle.setData(candles.map((c) => ({ time: t(c), open: c.open, high: c.high, low: c.low, close: c.close })));
      s.volume.setData(candles.map(bar));
      const avg = sma(candles.map((c) => c.close), 20);
      s.sma.setData(candles.flatMap((c, i) => (avg[i] === null ? [] : [{ time: t(c), value: avg[i] as number }])));
      chart.current?.timeScale().fitContent();
      return;
    }

    // A live tick: only the newest candle changed.
    s.candle.update({ time: t(last), open: last.open, high: last.high, low: last.low, close: last.close });
    s.volume.update(bar(last));
    const avg = sma(candles.slice(-20).map((c) => c.close), 20)[candles.slice(-20).length - 1];
    if (avg !== null && avg !== undefined) s.sma.update({ time: t(last), value: avg });
  }, [candles, loadedKey]);

  return <div className="chart" ref={host} role="img" aria-label="Candlestick price chart with a 20-period moving average" />;
}
