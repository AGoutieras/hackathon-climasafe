export function Card({ className = "", ...props }) {
  return (
    <div
      className={`bg-card text-card-foreground flex flex-col gap-6 rounded-xl border ${className}`.trim()}
      {...props}
    />
  );
}
