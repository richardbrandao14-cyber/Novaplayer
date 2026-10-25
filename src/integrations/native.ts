import { invoke, isTauri } from "@tauri-apps/api/core";
import type {
  NativeCatalogPage,
  NativeCatalogQuery,
  NativeJob,
  NativeSeriesDetails,
  NativeSource,
  NativeSourceInput,
  NativeLibraryState,
} from "../domain/native/types";
export function nativeAvailable() {
  return isTauri();
}
const desktopMessage =
  "Esta função exige o NOVA PLAYER para Windows. A prévia no navegador não conecta fontes reais.";
// Nunca reutilizar a mensagem bruta do IPC: ela pode conter URL/credenciais de um provedor.
export function nativeError(error: unknown): string {
  if (error instanceof Error && error.message === desktopMessage)
    return desktopMessage;
  if (error && typeof error === "object" && "code" in error) {
    const code = String(error.code).toUpperCase();
    const known: Record<string, string> = {
      NOT_FOUND:
        "O endereço solicitado não foi encontrado. Confira a URL do servidor ou atualize o catálogo.",
      PROCESSING:
        "Não foi possível processar a resposta da fonte. Tente atualizar a lista.",
      ENCODING: "Não foi possível ler a codificação desta playlist.",
      FILE: "Não foi possível acessar o arquivo local. Selecione o arquivo novamente.",
      PROVIDER:
        "O servidor não retornou uma resposta Xtream válida. Confira o endereço e o acesso à conta.",
      REDIRECT:
        "O servidor redirecionou para outro endereço. Cadastre o endereço final fornecido pelo serviço.",
      BUSY: "Já existem importações em andamento. Aguarde e tente novamente.",
      INTERRUPTED:
        "A importação foi interrompida. Atualize a lista para tentar novamente.",
      PLAYBACK:
        "Não foi possível reproduzir esta mídia. Verifique a fonte e tente outro conteúdo.",
      PLAYER_SURFACE:
        "Não foi possível preparar o vídeo dentro da janela. Tente abrir o conteúdo novamente.",
      PLAYER_MISSING:
        "O motor de vídeo não foi encontrado. Extraia todos os arquivos do ZIP ao lado do executável.",
      URL: "Informe uma URL HTTP ou HTTPS válida.",
      EMPTY: "A playlist não contém registros importáveis.",
      HLS: "Este arquivo é um manifesto de reprodução HLS, não um catálogo IPTV.",
      NETWORK:
        "O servidor está indisponível ou a conexão não pôde ser estabelecida.",
      HTTP: "O servidor respondeu com erro. Verifique o acesso à fonte.",
      VALIDATION: "Confira os campos da fonte e tente novamente.",
      STORAGE_FULL: "Não há espaço disponível para concluir o armazenamento.",
      MALFORMED: "A resposta da fonte não tem o formato esperado.",
      AUTHENTICATION: "O servidor recusou as credenciais.",
      SECRET_STORAGE:
        "Não foi possível acessar o armazenamento protegido do Windows.",
      INVALID_URL: "Informe uma URL HTTP ou HTTPS válida.",
      AUTH: "O servidor recusou as credenciais.",
      AUTH_FAILED: "O servidor recusou as credenciais.",
      TIMEOUT: "O servidor demorou demais para responder.",
      CANCELLED: "Importação cancelada.",
      TOO_LARGE: "A resposta ultrapassa o limite de tamanho permitido.",
      EMPTY_PLAYLIST: "A playlist não contém registros importáveis.",
      STORAGE: "Não foi possível acessar o armazenamento local.",
      DATABASE: "Não foi possível atualizar o banco de dados.",
    };
    return (
      known[code] ??
      "Não foi possível concluir a operação. Verifique a fonte e tente novamente."
    );
  }
  return "Não foi possível concluir a operação. Verifique a fonte e tente novamente.";
}
async function call<T>(
  command: string,
  args?: Record<string, unknown>,
): Promise<T> {
  if (!nativeAvailable()) throw new Error(desktopMessage);
  return invoke<T>(command, args);
}
export interface PlaybackStatus {
  mediaId?: string | null;
  episodeId?: string | null;
  actionId?: number;
  uiAction?: string | null;
  hudReady?: boolean;
  state: string;
  position: number;
  duration: number;
  volume: number;
  paused: boolean;
  muted: boolean;
  seekable: boolean;
  speed: number;
  tracks: { id: number; kind: string; label: string; selected: boolean }[];
  error: string | null;
}
export type PlayerControl =
  | { kind: "pause" | "mute" | "fullscreen"; value: boolean }
  | { kind: "volume" | "seek" | "speed" | "audio" | "subtitle"; value: number }
  | { kind: "chrome"; value: { fullscreen: boolean; episodes: boolean } }
  | { kind: "stop" | "wake" };
export interface SurfaceRect {
  x: number;
  y: number;
  width: number;
  height: number;
  visible: boolean;
}
// Serializa criação/troca/fechamento, inclusive o ciclo duplo de efeitos do React StrictMode.
let lifecycle: Promise<void> = Promise.resolve();
export function playbackLifecycle(work: () => Promise<void>): Promise<void> {
  const next = lifecycle.then(work, work);
  lifecycle = next.catch(() => {});
  return next;
}
export const nativeApi = {
  surface: (rect: SurfaceRect) => call<void>("player_surface", { rect }),
  play: (mediaId: string, episodeId?: string, resume = false) =>
    call<void>("play_media", {
      mediaId,
      episodeId: episodeId ?? null,
      ...(resume ? { resume: true } : {}),
    }),
  library: (mediaId: string) =>
    call<NativeLibraryState>("library_state", { mediaId }),
  setLibrary: (mediaId: string, favorite: boolean, watchlist: boolean) =>
    call<NativeLibraryState>("set_library", { mediaId, favorite, watchlist }),
  saveProgress: (
    mediaId: string,
    episodeId: string | undefined,
    position: number,
    duration: number,
  ) =>
    call<void>("save_progress", {
      mediaId,
      episodeId: episodeId ?? null,
      position,
      duration,
    }),
  thumbnail: (mediaId: string, episodeId?: string) =>
    call<{ mime: string; base64: string } | null>("thumbnail_for", {
      mediaId,
      episodeId: episodeId ?? null,
    }),
  playerControl: (control: PlayerControl) =>
    call<void>("player_control", { control }),
  playerStatus: () => call<PlaybackStatus>("player_status"),
  listSources: () => call<NativeSource[]>("list_sources"),
  saveSource: (input: NativeSourceInput) =>
    call<NativeSource>("save_source", {
      draft: {
        ...input,
        username: input.username ?? "",
        password: input.password ?? "",
      },
    }),
  pickFile: (name: string) =>
    call<NativeSource | null>("pick_m3u_file", { name }),
  removeSource: (sourceId: string) => call<void>("remove_source", { sourceId }),
  startImport: (sourceId: string) => call<string>("start_import", { sourceId }),
  cancelImport: (jobId: string) => call<void>("cancel_import", { jobId }),
  importStatus: (jobId: string) => call<NativeJob>("import_status", { jobId }),
  query: (query: NativeCatalogQuery) =>
    call<NativeCatalogPage>("query_catalog", { query }),
  categories: (kind?: string, sourceId?: string) =>
    call<string[]>("list_categories", {
      kind: kind ?? null,
      sourceId: sourceId ?? null,
    }),
  series: (mediaId: string) =>
    call<NativeSeriesDetails>("series_details", { mediaId }),
  image: (mediaId: string) =>
    call<{ mime: string; base64: string } | null>("image_for", { mediaId }),
};
export const jobLabels: Record<string, string> = {
  connecting: "Conectando",
  authenticating: "Autenticando",
  downloading: "Baixando",
  processing: "Processando",
  saving: "Salvando",
  finalizing: "Finalizando",
  completed: "Concluído",
  failed: "Falhou",
  cancelled: "Cancelado",
  queued: "Aguardando",
};
export function terminalJob(state: string) {
  return ["completed", "failed", "cancelled"].includes(state.toLowerCase());
}

export function importWarning(warning: string): string {
  const known: Record<string, string> = {
    "Codificação Windows-1252 utilizada; revise nomes importados.":
      "Codificação Windows-1252 utilizada; revise nomes importados.",
    "Alguns registros inválidos foram ignorados; os registros válidos foram preservados.":
      "Alguns registros inválidos foram ignorados; os registros válidos foram preservados.",
    "M3U sem classificação explícita: itens importados como conteúdo não classificado.":
      "M3U sem classificação explícita: itens importados como conteúdo não classificado.",
  };
  return (
    known[warning] ??
    "A importação terminou com uma observação adicional. Consulte o diagnóstico sanitizado do aplicativo."
  );
}
