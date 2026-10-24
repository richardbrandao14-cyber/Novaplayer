export function LoadState({
  status,
}: {
  status: "loading" | "ready" | "error";
}) {
  if (status === "error")
    return (
      <div role="alert" className="empty-state">
        <h2>Não foi possível carregar a biblioteca</h2>
        <p>
          Verifique a interface e tente recarregá-la. Nenhum serviço de conteúdo
          foi conectado.
        </p>
      </div>
    );
  return (
    <div
      role="status"
      aria-label="Carregando biblioteca"
      className="skeleton-layout"
    >
      <div className="skeleton skeleton-title" />
      <div className="skeleton skeleton-hero" />
      <div className="skeleton-cards">
        {[0, 1, 2, 3].map((n) => (
          <div className="skeleton" key={n} />
        ))}
      </div>
      <span className="sr-only">Preparando sua biblioteca…</span>
    </div>
  );
}
