import {
  render,
  screen,
  fireEvent,
  within,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, it, expect, vi } from "vitest";
import { App } from "../src/app/App";
import { Artwork } from "../src/components/Artwork";
import { ChannelList } from "../src/components/ChannelList";
import { useAppStore } from "../src/state/useAppStore";
import { demoCatalog } from "../src/demo/catalog";
import { searchMedia } from "../src/services/search";
import { virtualWindow } from "../src/services/virtualWindow";
import { demoCatalogAdapter } from "../src/integrations/catalog";
beforeEach(() => {
  localStorage.clear();
  useAppStore.setState({
    page: "home",
    demo: true,
    collapsed: false,
    search: "",
    favorites: ["aurora", "nova-live"],
    historyIds: ["aurora", "atlas"],
    sources: [],
    notification: "",
  });
});
describe("Fase 2", () => {
  it("encontra metadados sem acentos, agrupa tipos e limita resultados", () => {
    expect(searchMedia(demoCatalog, "ficcao").map((i) => i.id)).toContain(
      "aurora",
    );
    expect(
      searchMedia(demoCatalog, "NOVA").every((i) => i.kind === "live"),
    ).toBe(true);
    expect(searchMedia(demoCatalog, "", 2)).toEqual([]);
    expect(searchMedia(demoCatalog, "a", 2)).toHaveLength(2);
  });
  it("abre busca por Ctrl+K e navega ao resultado por teclado", async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole("heading", { name: /Além da\s*Aurora/ });
    await user.keyboard("{Control>}k{/Control}");
    const dialog = screen.getByRole("dialog");
    const input = within(dialog).getByLabelText("Busca global");
    await user.type(input, "atlas");
    const result = await within(dialog).findByRole("button", {
      name: /Abrir Atlas em Séries/,
    });
    await user.keyboard("{ArrowDown}");
    expect(result).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(
      await screen.findByRole("heading", { name: "Séries" }),
    ).toBeInTheDocument();
    expect(useAppStore.getState().search).toBe("Atlas");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
  it("mostra busca sem resultados", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(
      screen.getByRole("button", { name: "Buscar na biblioteca" }),
    );
    await user.type(screen.getByLabelText("Busca global"), "xxxxxxxx");
    expect(
      await screen.findByText("Nenhum resultado encontrado."),
    ).toBeInTheDocument();
  });
  it("seleciona temporadas e reinicia a seleção para outra série", async () => {
    useAppStore.setState({ page: "series" });
    const user = userEvent.setup();
    render(<App />);
    await user.click(
      await screen.findByRole("button", { name: "Ver detalhes de Atlas" }),
    );
    await user.selectOptions(screen.getByLabelText("Temporada"), "2");
    expect(screen.getAllByText("Temporada 2 · Ilustrativo")).toHaveLength(3);
    await user.click(
      screen.getByRole("button", { name: "Prévia de reprodução · Demo" }),
    );
    expect(screen.getByText(/nenhum vídeo foi aberto/)).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await user.click(
      screen.getByRole("button", {
        name: "Ver detalhes de Depois da meia-noite",
      }),
    );
    expect(screen.getByLabelText("Temporada")).toHaveValue("1");
  });
  it("confirma limpeza de histórico sem persistir alteração", async () => {
    useAppStore.setState({ page: "history" });
    const user = userEvent.setup();
    render(<App />);
    const clear = await screen.findByRole("button", {
      name: "Limpar histórico",
    });
    await waitFor(() => expect(clear).toBeEnabled());
    await user.click(clear);
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(useAppStore.getState().historyIds).toHaveLength(2);
    await user.click(clear);
    await user.click(screen.getByRole("button", { name: "Confirmar limpeza" }));
    expect(
      await screen.findByRole("heading", {
        name: "Nenhuma atividade por aqui",
      }),
    ).toBeInTheDocument();
    expect(
      JSON.parse(localStorage.getItem("nova-ui-v1") ?? "{}").state,
    ).not.toHaveProperty("historyIds");
  });
  it("mantém placeholder e recupera imagem quando a origem muda", () => {
    const { rerender } = render(<Artwork name="missing" />);
    fireEvent.error(document.querySelector("img")!);
    expect(
      screen.getByRole("img", { name: "Imagem indisponível" }),
    ).toBeInTheDocument();
    rerender(<Artwork name="atlas" />);
    expect(
      screen.queryByRole("img", { name: "Imagem indisponível" }),
    ).not.toBeInTheDocument();
    expect(document.querySelector("img")).toHaveAttribute(
      "src",
      "/artwork/atlas.svg",
    );
  });
  it("renderiza janela limitada para 10 mil canais e permite chegar ao último por teclado", () => {
    const item = demoCatalog.find((i) => i.kind === "live")!;
    const items = Array.from({ length: 10000 }, (_, n) => ({
      ...item,
      id: String(n),
      title: `Canal ${n}`,
    }));
    const select = vi.fn();
    render(<ChannelList items={items} selected="0" onSelect={select} />);
    expect(screen.getAllByRole("listitem").length).toBeLessThan(15);
    fireEvent.keyDown(
      screen.getByRole("region", { name: "Canais demonstrativos" }),
      { key: "End" },
    );
    expect(select).toHaveBeenCalledWith("9999");
  });
  it("calcula limites de virtualização no início, meio e fim", () => {
    for (const count of [1000, 10000, 30000, 50000]) {
      for (const offset of [0, 7600, count * 76 - 456]) {
        const range = virtualWindow(count, offset, 456);
        expect(range.start).toBeGreaterThanOrEqual(0);
        expect(range.end).toBeLessThanOrEqual(count);
        expect(range.end - range.start).toBeLessThanOrEqual(12);
      }
    }
    expect(virtualWindow(0, 0, 456).end).toBe(0);
  });
  it("expõe erro de carregamento sem substituir silenciosamente por demo", async () => {
    vi.spyOn(demoCatalogAdapter, "list").mockRejectedValue(
      new Error("fixture failure"),
    );
    render(<App />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível carregar",
    );
    expect(
      screen.queryByRole("heading", { name: /Além da\s*Aurora/ }),
    ).not.toBeInTheDocument();
  });
});
