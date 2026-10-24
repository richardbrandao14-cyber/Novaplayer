// Janela de linhas de altura fixa. Nenhum acesso a DOM ou dependência de plataforma.
export function virtualWindow(
  count: number,
  scrollTop: number,
  height: number,
  rowHeight = 76,
  overscan = 3,
) {
  const first = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const start = Math.min(first, Math.max(0, count - 1));
  const end = Math.min(
    count,
    Math.ceil((Math.max(0, scrollTop) + height) / rowHeight) + overscan,
  );
  return {
    start,
    end,
    offset: start * rowHeight,
    totalHeight: count * rowHeight,
  };
}
