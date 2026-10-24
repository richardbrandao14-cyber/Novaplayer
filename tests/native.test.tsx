import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
const ipc = vi.hoisted(() => ({ available: false, invoke: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({
  isTauri: () => ipc.available,
  invoke: ipc.invoke,
}));
import { nativeApi, nativeError } from "../src/integrations/native";
import Sources from "../src/pages/Sources";
import { NativeSources } from "../src/components/native/NativeSources";
import { NativeCatalogBrowser } from "../src/components/native/NativeCatalogBrowser";
import { NativeDetails } from "../src/components/native/NativeDetails";
import { NativeArtwork } from "../src/components/native/NativeArtwork";
import { NativeGlobalSearch } from "../src/components/native/NativeGlobalSearch";
import { useAppStore } from "../src/state/useAppStore";
import { useNativeJobs } from "../src/state/useNativeJobs";
const source = {
  id: "source-1",
  name: "Fonte autorizada",
  kind: "m3u",
  status: "ready",
  itemCount: 125,
};
const item = {
  id: "opaque-media-1",
  sourceId: source.id,
  externalId: null,
  name: "Título fornecido",
  kind: "unknown" as const,
  category: null,
  hasArtwork: false,
  description: null,
  year: null,
  duration: null,
  rating: null,
};
beforeEach(() => {
  ipc.available = false;
  ipc.invoke.mockReset();
  localStorage.clear();
  useNativeJobs.setState({ jobs: {} });
  useAppStore.setState({
    demo: false,
    page: "home",
    search: "",
    notification: "",
  });
});
afterEach(() => vi.unstubAllGlobals());
describe("fronteira nativa da Fase 3", () => {
  it("oferece acesso direto ao cadastro real no Windows mesmo com a demonstração ativa", async () => {
    ipc.available = true;
    ipc.invoke.mockResolvedValue([]);
    useAppStore.setState({ demo: true, page: "sources" });
    const user = userEvent.setup();
    render(<Sources />);
    expect(screen.getByText("Agora é a sua lista.")).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Conectar lista de verdade" }),
    );
    expect(useAppStore.getState().demo).toBe(false);
    expect(
      await screen.findByRole("button", {
        name: "Adicionar fonte real",
      }),
    ).toBeInTheDocument();
    expect(ipc.invoke).toHaveBeenCalledWith("list_sources", undefined);
    expect(ipc.invoke).not.toHaveBeenCalledWith(
      "save_source",
      expect.anything(),
    );
  });
  it("preserva tipo e campos não secretos quando o cadastro Xtream falha, limpando a senha", async () => {
    ipc.available = true;
    ipc.invoke.mockImplementation(async (command: string) => {
      if (command === "list_sources") return [];
      if (command === "save_source")
        throw { code: "validation", message: "raw details must stay hidden" };
      throw new Error("Unexpected test command");
    });
    const user = userEvent.setup();
    render(<NativeSources />);
    await user.click(
      await screen.findByRole("button", {
        name: "Adicionar fonte real",
      }),
    );
    await user.click(screen.getByRole("radio", { name: "Xtream" }));
    await user.type(
      screen.getByLabelText("URL do servidor"),
      "https://example.com",
    );
    await user.type(screen.getByLabelText("Usuário"), "fixture-user");
    await user.type(screen.getByLabelText("Senha"), "fixture-secret");
    await user.click(screen.getByRole("button", { name: "Salvar e importar" }));
    const dialog = screen.getByRole("dialog");
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Confira os campos",
    );
    expect(screen.getByRole("radio", { name: "Xtream" })).toBeChecked();
    expect(screen.getByLabelText("URL do servidor")).toHaveValue(
      "https://example.com",
    );
    expect(screen.getByLabelText("Senha")).toHaveValue("");
    expect(
      screen.queryByText("raw details must stay hidden"),
    ).not.toBeInTheDocument();
  });

  it("exibe contagens e observações finais sem revelar conteúdo técnico não permitido", async () => {
    ipc.available = true;
    ipc.invoke.mockResolvedValue([source]);
    useNativeJobs.setState({
      jobs: {
        [source.id]: {
          id: "finished",
          sourceId: source.id,
          state: "completed",
          processed: 125,
          invalid: 5,
          report: {
            valid: 120,
            invalid: 5,
            added: 120,
            removed: 0,
            warnings: [
              "Codificação Windows-1252 utilizada; revise nomes importados.",
              "https://example.com?token=must-not-render",
            ],
          },
        },
      },
    });
    render(<NativeSources />);
    expect(
      await screen.findByText("Relatório final: 120 válidos · 5 inválidos."),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Codificação Windows-1252 utilizada; revise nomes importados.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/must-not-render/)).not.toBeInTheDocument();
  });
  it("isola falhas e respostas de imagens por ID de mídia", async () => {
    ipc.available = true;
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(private callback: IntersectionObserverCallback) {}
        observe(target: Element) {
          this.callback(
            [{ isIntersecting: true, target } as IntersectionObserverEntry],
            this as unknown as IntersectionObserver,
          );
        }
        disconnect() {}
        unobserve() {}
      },
    );
    ipc.invoke.mockResolvedValue({ mime: "image/png", base64: "AA==" });
    const { rerender } = render(<NativeArtwork mediaId="first" hasArtwork />);
    await waitFor(() =>
      expect(document.querySelector("img")).toBeInTheDocument(),
    );
    fireEvent.error(document.querySelector("img")!);
    expect(
      screen.getByRole("img", { name: "Imagem indisponível" }),
    ).toBeInTheDocument();
    rerender(<NativeArtwork mediaId="second" hasArtwork />);
    await waitFor(() =>
      expect(ipc.invoke).toHaveBeenCalledWith("image_for", {
        mediaId: "second",
      }),
    );
    await waitFor(() =>
      expect(document.querySelector("img")).toBeInTheDocument(),
    );
    expect(
      screen.queryByRole("img", { name: "Imagem indisponível" }),
    ).not.toBeInTheDocument();
  });
  it("não chama IPC no navegador e explica a indisponibilidade sem simular importação", async () => {
    render(<NativeSources />);
    expect(
      screen.getByText(/Funções nativas exigem o aplicativo Windows/),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Adicionar fonte real" }),
    ).not.toBeInTheDocument();
    expect(ipc.invoke).not.toHaveBeenCalled();
    await expect(nativeApi.listSources()).rejects.toThrow(/Windows/);
    expect(ipc.invoke).not.toHaveBeenCalled();
  });
  it("remove conteúdo técnico/URLs dos erros e traduz os códigos reais", () => {
    expect(
      nativeError({
        code: "authentication",
        message: "secret=https://provider.invalid?password=fixture",
      }),
    ).toBe("O servidor recusou as credenciais.");
    expect(
      nativeError(new Error("https://example.com?token=fixture-secret")),
    ).not.toContain("fixture-secret");
    expect(
      nativeError({ code: "secret_storage", message: "raw stack" }),
    ).toContain("armazenamento protegido");
  });
  it("consulta páginas no backend sem receber URLs e mantém registros sem classificação", async () => {
    ipc.available = true;
    ipc.invoke.mockImplementation(
      async (command: string, args?: Record<string, unknown>) => {
        if (command === "list_sources") return [source];
        if (command === "list_categories") return [];
        if (command === "query_catalog") {
          const query = args?.query as { offset: number };
          return {
            items: [{ ...item, id: `item-${query.offset}` }],
            total: 125,
            nextOffset: query.offset === 0 ? 60 : null,
          };
        }
        throw new Error("unexpected");
      },
    );
    const user = userEvent.setup();
    render(<NativeCatalogBrowser title="Início" />);
    expect(
      await screen.findByRole("button", {
        name: "Ver detalhes de Título fornecido",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Tipo não informado pela fonte"),
    ).toBeInTheDocument();
    expect(ipc.invoke).toHaveBeenCalledWith("query_catalog", {
      query: { offset: 0, limit: 60, sort: "name" },
    });
    await user.click(screen.getByRole("button", { name: "Próxima" }));
    await waitFor(() =>
      expect(ipc.invoke).toHaveBeenCalledWith("query_catalog", {
        query: { offset: 60, limit: 60, sort: "name" },
      }),
    );
    expect(screen.getByText("Página 2")).toBeInTheDocument();
  });
  it("salva somente via IPC, limpa credenciais e permite cancelamento real sem porcentagem inventada", async () => {
    ipc.available = true;
    let saved = false;
    ipc.invoke.mockImplementation(async (command: string) => {
      if (command === "list_sources") return saved ? [source] : [];
      if (command === "save_source") {
        saved = true;
        return source;
      }
      if (command === "start_import") return "job-1";
      if (command === "import_status")
        return {
          id: "job-1",
          sourceId: source.id,
          state: "processing",
          processed: 34,
          invalid: 2,
          total: null,
          added: null,
          removed: null,
          error: null,
        };
      if (command === "cancel_import") return;
      throw new Error("unexpected");
    });
    const user = userEvent.setup();
    render(<NativeSources />);
    await user.click(
      await screen.findByRole("button", { name: "Adicionar fonte real" }),
    );
    await user.click(screen.getByRole("radio", { name: "Xtream" }));
    await user.type(screen.getByLabelText("Nome da lista"), "Teste autorizado");
    await user.type(
      screen.getByLabelText("URL do servidor"),
      "https://example.com",
    );
    await user.type(screen.getByLabelText("Usuário"), "fixture-user");
    await user.type(screen.getByLabelText("Senha"), "fixture-secret");
    await user.click(screen.getByRole("button", { name: "Salvar e importar" }));
    const cancel = await screen.findByRole("button", {
      name: "Cancelar importação",
    });
    expect(ipc.invoke).toHaveBeenCalledWith("save_source", {
      draft: {
        name: "Teste autorizado",
        kind: "xtream",
        url: "https://example.com",
        username: "fixture-user",
        password: "fixture-secret",
      },
    });
    expect(screen.queryByLabelText("Senha")).not.toBeInTheDocument();
    expect(JSON.stringify(localStorage)).not.toContain("fixture-secret");
    expect(screen.getByRole("progressbar")).not.toHaveAttribute("value");
    await user.click(cancel);
    await waitFor(() =>
      expect(ipc.invoke).toHaveBeenCalledWith("cancel_import", {
        jobId: "job-1",
      }),
    );
  });
  it("consulta detalhes de série somente ao abrir o registro selecionado", async () => {
    ipc.available = true;
    ipc.invoke.mockResolvedValue([
      {
        id: "season-1",
        number: 1,
        episodes: [
          {
            id: "episode-1",
            title: "Nome do episódio",
            description: "Descrição da fonte",
            duration: "42 min",
          },
        ],
      },
    ]);
    render(
      <NativeDetails item={{ ...item, kind: "series" }} onClose={() => {}} />,
    );
    expect(await screen.findByText("Nome do episódio")).toBeInTheDocument();
    expect(ipc.invoke).toHaveBeenCalledWith("series_details", {
      mediaId: item.id,
    });
    expect(
      screen.getByText(/Reprodução de vídeo não implementada/),
    ).toBeInTheDocument();
  });
  it("busca global real consulta no máximo 24 resultados e não usa fixtures como fallback", async () => {
    ipc.available = true;
    ipc.invoke.mockImplementation(async (command: string) =>
      command === "query_catalog"
        ? { items: [item], total: 1, nextOffset: null }
        : [],
    );
    const user = userEvent.setup();
    render(<NativeGlobalSearch />);
    await user.click(
      screen.getByRole("button", { name: "Buscar na biblioteca" }),
    );
    const dialog = screen.getByRole("dialog");
    await user.type(within(dialog).getByLabelText("Busca global"), "Título");
    expect(
      await within(dialog).findByRole("button", {
        name: "Abrir Título fornecido",
      }),
    ).toBeInTheDocument();
    expect(ipc.invoke).toHaveBeenCalledWith("query_catalog", {
      query: { search: "Título", offset: 0, limit: 24 },
    });
    expect(screen.queryByText("Além da Aurora")).not.toBeInTheDocument();
  });
});
