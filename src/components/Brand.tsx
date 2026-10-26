/** NEX: assinatura visual local. Não altera identidade de armazenamento do app. */
export function Brand({ large = false }: { large?: boolean }) {
  return (
    <span
      className={`nex-brand ${large ? "nex-brand-large" : ""}`}
      aria-label="NEX"
    >
      <svg
        className="nex-mark"
        viewBox="0 0 40 40"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M10 10 20 20 10 30M23 10 33 20 23 30"
          stroke="currentColor"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="nex-wordmark" aria-hidden="true">
        nex<span className="nex-brand-dot">.</span>
      </span>
    </span>
  );
}
