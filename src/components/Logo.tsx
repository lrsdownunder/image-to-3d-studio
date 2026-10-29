/** Majoto 3D wordmark with a small isometric-cube symbol. */
export function Logo() {
  return (
    <span className="flex items-center gap-2">
      <svg viewBox="0 0 32 32" className="size-8" aria-hidden="true">
        <rect width="32" height="32" rx="9" className="fill-primary" />
        <path d="M16 6 25 11v10l-9 5-9-5V11z" className="fill-primary-foreground" />
        <path d="M16 6 25 11 16 16 7 11z" className="fill-lime" />
        <path d="M16 16v10" className="stroke-primary" strokeWidth="1.6" />
      </svg>
      <span className="font-display text-xl font-semibold tracking-tight">
        Majoto <span className="text-primary">3D</span>
      </span>
    </span>
  );
}
