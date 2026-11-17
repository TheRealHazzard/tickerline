import { baseAsset, formatCompact, formatPercent, formatPrice } from '../lib/format';
import { store, useStore } from '../lib/store';
import { INTERVALS } from '../lib/types';
import { useKlines } from '../lib/useKlines';
import { PriceChart } from './PriceChart';
import { Signals } from './Signals';

export function ChartPanel() {
  const selected = useStore((s) => s.selected);
  const interval = useStore((s) => s.interval);
  const ticker = useStore((s) => s.tickers[s.selected]);
  const { candles, loadedKey, loading, error } = useKlines(selected, interval);
  const up = (ticker?.change ?? 0) >= 0;

  return (
    <section className="panel main" aria-label={`${baseAsset(selected)} chart`}>
      <div className="head">
        <div>
          <h1>{baseAsset(selected)}<small> / USDT</small></h1>
          {ticker && (
            <div className="big">
              <span key={ticker.updated} className={ticker.dir > 0 ? 'tick-up' : ticker.dir < 0 ? 'tick-down' : ''}>{formatPrice(ticker.price)}</span>
              <span className={up ? 'pos' : 'neg'}>{formatPercent(ticker.change)}</span>
            </div>
          )}
        </div>
        <div className="tabs" role="group" aria-label="Candle interval">
          {INTERVALS.map((i) => (
            <button key={i} className={i === interval ? 'on' : ''} onClick={() => store.setInterval(i)} aria-pressed={i === interval}>
              {i}
            </button>
          ))}
        </div>
      </div>

      {ticker && (
        <dl className="stats">
          <div><dt>24h high</dt><dd>{formatPrice(ticker.high)}</dd></div>
          <div><dt>24h low</dt><dd>{formatPrice(ticker.low)}</dd></div>
          <div><dt>24h volume</dt><dd>${formatCompact(ticker.volume)}</dd></div>
        </dl>
      )}

      <div className="chartwrap">
        <PriceChart candles={candles} loadedKey={loadedKey} />
        {loading && <div className="overlay">Loading chart&hellip;</div>}
        {error && <div className="overlay err">Could not load candles. {error}</div>}
      </div>

      <Signals candles={candles} />
    </section>
  );
}
