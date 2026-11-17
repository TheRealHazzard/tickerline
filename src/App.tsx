import { useEffect } from 'react';
import { startMarket } from './lib/market';
import { useStore } from './lib/store';
import { ChartPanel } from './components/ChartPanel';
import { Header } from './components/Header';
import { Watchlist } from './components/Watchlist';

export default function App() {
  const error = useStore((s) => s.error);

  useEffect(() => startMarket(), []);

  return (
    <div className="app">
      <Header />
      {error && (
        <div className="notice" role="alert">
          Market data is unavailable right now ({error}). Binance's public feed can be blocked in some regions.
        </div>
      )}
      <main className="layout">
        <Watchlist />
        <ChartPanel />
      </main>
      <footer className="foot">
        Data from Binance public market feeds. For information only, not financial advice.
      </footer>
    </div>
  );
}
