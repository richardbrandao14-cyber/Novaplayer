import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, it, expect } from "vitest";
import { App } from "../src/app/App";
import { useAppStore } from "../src/state/useAppStore";
beforeEach(() => {
  localStorage.clear();
  useAppStore.setState({
    page: "home",
    collapsed: false,
    demo: true,
    search: "",
    favorites: ["aurora", "ocean", "nova-live"],
    historyIds: ["aurora", "atlas"],
    sources: [],
    notification: "",
  });
});
describe("interface demonstrativa", () => {
  it("navega por todos os destinos sem backend e preserva menu recolhido", async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(
      await screen.findByRole("heading", { name: /Além da\s*Aurora/i }),
    ).toBeInTheDocument();
    const nav = screen.getByRole("navigation", { name: "Navegação principal" });
    for (const name of [
      "TV ao Vivo",
      "Filmes",
      "Séries",
      "Favoritos",
      "Histórico",
      "Minhas Listas",
      "Configurações",
    ]) {
      await user.click(within(nav).getByRole("button", { name }));
      expect(await screen.findByRole("heading", { name })).toBeInTheDocument();
    }
    await user.click(screen.getByRole("button", { name: "Recolher menu" }));
    expect(
      screen.getByRole("button", { name: "Expandir menu" }),
    ).toHaveAttribute("aria-expanded", "false");
    expect(
      JSON.parse(localStorage.getItem("nova-ui-v1") ?? "{}").state.collapsed,
    ).toBe(true);
    expect(
      screen.getByRole("button", { name: "Fechar janela" }),
    ).toBeDisabled();
  });
  it("filtra filmes, abre detalhes e altera favoritos", async () => {
    useAppStore.setState({ page: "movies" });
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole("button", {
      name: "Ver detalhes de Além da Aurora",
    });
    await user.type(
      screen.getByRole("textbox", { name: "Buscar na página" }),
      "oceano",
    );
    expect(
      screen.queryByRole("button", { name: "Ver detalhes de Além da Aurora" }),
    ).not.toBeInTheDocument();
    await user.click(
      screen.getByRole("button", {
        name: "Ver detalhes de O silêncio do oceano",
      }),
    );
    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByText(/Reprodução indisponível nesta fase/),
    ).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    await user.click(
      screen.getByRole("button", {
        name: "Remover dos favoritos: O silêncio do oceano",
      }),
    );
    expect(useAppStore.getState().favorites).not.toContain("ocean");
  });
  it("mostra vazio quando demo é desligada", async () => {
    useAppStore.setState({ demo: false });
    render(<App />);
    expect(
      await screen.findByRole("heading", {
        name: "Sua próxima história começa aqui",
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Ver detalhes de Além da Aurora" }),
    ).not.toBeInTheDocument();
  });
  it("valida formulário sem guardar credenciais nem conectar fontes", async () => {
    useAppStore.setState({ page: "sources" });
    const user = userEvent.setup();
    render(<App />);
    await user.click(
      await screen.findByRole("button", { name: "Adicionar lista" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Validar campos de demonstração" }),
    );
    expect(
      screen.getByText("Informe um nome com até 100 caracteres."),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "Xtream" }));
    await user.type(screen.getByLabelText("Nome da lista"), "Demonstração");
    await user.type(
      screen.getByLabelText("URL do servidor"),
      "https://example.com",
    );
    await user.type(screen.getByLabelText("Usuário"), "demo-user");
    await user.type(screen.getByLabelText("Senha"), "demo-password");
    await user.click(
      screen.getByRole("button", { name: "Validar campos de demonstração" }),
    );
    expect(
      within(screen.getByRole("dialog")).getByRole("status"),
    ).toHaveTextContent("Nenhuma conexão foi realizada");
    expect(screen.getByLabelText("Senha")).toHaveValue("");
    expect(localStorage.getItem("nova-ui-v1")).not.toContain("demo-password");
  });
});
