import { useState, type FormEvent } from 'react';
import { addSymbol } from '../lib/market';
import { baseAsset, formatPercent, formatPrice, normalizeSymbol } from '../lib/format';
import { store, useStore } from '../lib/store';
import { Sparkline } from './Sparkline';

export function Watchlist() {
  const watchlist = useStore((s) => s.watchlist);
  const tickers = useStore((s) => s.tickers);
  const sparks = useStore((s) => s.sparks);
  const selected = useStore((s) => s.selected);
  const [input, setInput] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    const symbol = normalizeSymbol(input);
    if (!symbol) {
      setMessage('Enter a coin like SOL or DOGE.');
      return;
    }
    setBusy(true);
    const error = await addSymbol(symbol);
    setBusy(false);
    setMessage(error);
    if (!error) setInput('');
  }

  return (
    <aside className="panel watch" aria-label="Watchlist">
      <form className="add" onSubmit={onAdd}>
        <input
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setMessage(null);
          }}
          placeholder="Add a coin (SOL, PEPE...)"
          aria-label="Add a coin"
        />
        <button className="btn" disabled={busy}>Add</button>
      </form>
      {message && <p className="msg" role="alert">{message}</p>}

      <ul className="rows">
        {watchlist.map((symbol) => {
          const t = tickers[symbol];
          const spark = sparks[symbol] ?? [];
          const series = t && spark.length ? [...spark.slice(0, -1), t.price] : spark;
          const up = (t?.change ?? 0) >= 0;
          return (
            <li key={symbol}>
              <button className={`row ${symbol === selected ? 'on' : ''}`} onClick={() => store.select(symbol)} aria-pressed={symbol === selected}>
                <span className="sym">
                  <strong>{baseAsset(symbol)}</strong>
                  <small>USDT</small>
                </span>
                <Sparkline values={series} up={up} />
                <span className="quote">
                  {t ? (
                    <>
                      <span key={t.updated} className={`price ${t.dir > 0 ? 'tick-up' : t.dir < 0 ? 'tick-down' : ''}`}>{formatPrice(t.price)}</span>
                      <span className={`chg ${up ? 'pos' : 'neg'}`}>{formatPercent(t.change)}</span>
                    </>
                  ) : (
                    <span className="skeleton" />
                  )}
                </span>
              </button>
              {watchlist.length > 1 && (
                <button className="x" onClick={() => store.removeSymbol(symbol)} aria-label={`Remove ${baseAsset(symbol)}`}>
                  &times;
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
