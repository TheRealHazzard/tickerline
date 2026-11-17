export type Interval = '15m' | '1h' | '4h' | '1d';
export const INTERVALS: Interval[] = ['15m', '1h', '4h', '1d'];

export type ConnectionStatus = 'connecting' | 'live' | 'reconnecting' | 'offline';

export type Ticker = {
  symbol: string; // e.g. BTCUSDT
  price: number;
  open: number; // price 24h ago
  high: number;
  low: number;
  volume: number; // quote volume (USDT)
  change: number; // 24h change in percent
  dir: 1 | 0 | -1; // direction of the last tick
  updated: number; // ms timestamp of the last tick
};

export type Candle = {
  time: number; // seconds since epoch (UTC)
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};
