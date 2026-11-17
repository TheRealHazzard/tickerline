/** A tiny inline price trend. The last point is the live price. */
export function Sparkline({ values, up }: { values: number[]; up: boolean }) {
  if (values.length < 2) return <svg className="spark" viewBox="0 0 80 24" aria-hidden="true" />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points = values
    .map((v, i) => `${((i / (values.length - 1)) * 80).toFixed(1)},${(22 - ((v - min) / span) * 20).toFixed(1)}`)
    .join(' ');
  return (
    <svg className="spark" viewBox="0 0 80 24" aria-hidden="true" preserveAspectRatio="none">
      <polyline points={points} fill="none" stroke={up ? 'var(--green)' : 'var(--red)'} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
