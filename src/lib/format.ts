/** Price with sensible precision for its magnitude: BTC to 2 dp, small coins to 6 significant places. */
export function formatPrice(n: number): string {
  if (!Number.isFinite(n)) return '-';
  const abs = Math.abs(n);
  const digits = abs >= 1000 ? 2 : abs >= 1 ? 3 : abs >= 0.01 ? 5 : 7;
  return n.toLocaleString('en-US', { minimumFractionDigits: Math.min(2, digits), maximumFractionDigits: digits });
}

export function formatPercent(n: number): string {
  if (!Number.isFinite(n)) return '-';
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
}

/** 1234567 -> "1.23M" */
export function formatCompact(n: number): string {
  if (!Number.isFinite(n)) return '-';
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(n);
}

export const QUOTE = 'USDT';

/** "BTCUSDT" -> "BTC" */
export function baseAsset(symbol: string): string {
  return symbol.endsWith(QUOTE) ? symbol.slice(0, -QUOTE.length) : symbol;
}

/** User input ("sol", "SOLUSDT", " eth ") -> "SOLUSDT", or null if it is not a plausible symbol. */
export function normalizeSymbol(input: string): string | null {
  const s = input.trim().toUpperCase();
  if (!/^[A-Z0-9]{2,12}$/.test(s)) return null;
  return s.endsWith(QUOTE) ? s : s + QUOTE;
}
