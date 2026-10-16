export function StatSparkline({ values, positive = true, color, heightClassName = "h-9" }: { values: number[]; positive?: boolean; color?: string; heightClassName?: string }) {
  if (!values.some((value) => value > 0)) return <div className={heightClassName} aria-hidden />;
  const stroke = color ?? (positive ? "var(--color-primary)" : "var(--color-muted-foreground)");
  const minimum = Math.min(...values);
  const range = Math.max(...values) - minimum || 1;
  const lastIndex = Math.max(values.length - 1, 1);
  const points = values.map((value, index) => `${index / lastIndex},${1 - ((value - minimum) / range)}`).join(" ");

  return (
    <div className={`${heightClassName} w-full`} aria-hidden>
      <svg viewBox="0 0 1 1" preserveAspectRatio="none" className="size-full overflow-visible">
        <polygon points={`0,1 ${points} 1,1`} fill={stroke} fillOpacity="0.08" />
        <polyline points={points} fill="none" stroke={stroke} strokeWidth="1.75" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}
