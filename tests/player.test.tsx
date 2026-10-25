import { afterEach, expect, it, vi } from "vitest";
import {
  cleanup,
  render,
  screen,
  waitFor,
  fireEvent,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
const ipc = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({
  isTauri: () => true,
  invoke: ipc.invoke,
}));
import { NativePlayer } from "../src/components/native/NativePlayer";
import { nativeError } from "../src/integrations/native";
import type { NativeCatalogItem } from "../src/domain/native/types";
const item: NativeCatalogItem = {
  id: "opaque-media",
  sourceId: "source-1",
  externalId: null,
  name: "Título da fonte",
  kind: "movie",
  category: null,
  hasArtwork: false,
  description: null,
  year: null,
  duration: null,
  rating: null,
};
const state = {
  state: "playing",
  position: 2,
  duration: 60,
  volume: 75,
  paused: false,
  muted: false,
  seekable: true,
  speed: 1,
  tracks: [{ id: 2, kind: "audio", label: "por", selected: true }],
  error: null,
};
afterEach(() => {
  cleanup();
});
it("prepara superfície e inicia episódio automaticamente somente por IDs; ajusta som e fecha", async () => {
  ipc.invoke.mockReset();
  ipc.invoke.mockImplementation(async (command: string) => {
    if (command === "player_status") return state;
  });
  const close = vi.fn();
  const user = userEvent.setup();
  const view = render(
    <NativePlayer
      session={{ item, episodeId: "opaque-episode" }}
      onClose={close}
    />,
  );
  await waitFor(() =>
    expect(ipc.invoke).toHaveBeenCalledWith("play_media", {
      mediaId: "opaque-media",
      episodeId: "opaque-episode",
    }),
  );
  const calls = ipc.invoke.mock.calls.map((c) => c[0]);
  expect(calls.indexOf("player_surface")).toBeLessThan(
    calls.indexOf("play_media"),
  );
  expect(
    screen.queryByRole("button", { name: "Reproduzir episódio" }),
  ).not.toBeInTheDocument();
  await waitFor(() =>
    expect(screen.getByRole("slider", { name: "Volume" })).toHaveValue("75"),
  );
  await user.click(screen.getByRole("button", { name: "Silenciar" }));
  expect(ipc.invoke).toHaveBeenCalledWith("player_control", {
    control: { kind: "mute", value: true },
  });
  await user.click(screen.getByRole("button", { name: "Ajustes" }));
  expect(screen.getByRole("combobox", { name: "Áudio" })).toHaveValue("2");
  await user.click(
    screen.getByRole("checkbox", { name: "Modo de compatibilidade de vídeo" }),
  );
  expect(ipc.invoke).toHaveBeenCalledWith("player_control", {
    control: { kind: "videoCompatibility", value: true },
  });
  fireEvent.change(screen.getByRole("combobox", { name: "Velocidade" }), {
    target: { value: "1.5" },
  });
  await waitFor(() =>
    expect(ipc.invoke).toHaveBeenCalledWith("player_control", {
      control: { kind: "speed", value: 1.5 },
    }),
  );
  await user.click(screen.getByRole("button", { name: "Voltar" }));
  expect(close).toHaveBeenCalledOnce();
  view.unmount();
  await waitFor(() =>
    expect(ipc.invoke).toHaveBeenCalledWith("player_surface", {
      rect: expect.objectContaining({ visible: false }),
    }),
  );
});
it("desativa seek quando a fonte não oferece suporte; erro de abertura não expõe endereço", async () => {
  ipc.invoke.mockReset();
  ipc.invoke.mockImplementation(async (command: string) => {
    if (command === "player_status")
      return { ...state, duration: 0, seekable: false };
    if (command === "play_media")
      throw {
        code: "playback",
        message: "https://example.com/private?token=fixture-secret",
      };
  });
  render(<NativePlayer session={{ item }} onClose={vi.fn()} />);
  await waitFor(() =>
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Não foi possível reproduzir",
    ),
  );
  expect(document.body.textContent).not.toContain("fixture-secret");
});
it("traduz falhas sem reutilizar mensagens remotas", () => {
  expect(
    nativeError({ code: "not_found", message: "fixture-secret" }),
  ).toContain("não foi encontrado");
  expect(
    nativeError({ code: "provider", message: "fixture-secret" }),
  ).toContain("Xtream");
  expect(
    nativeError({ code: "redirect", message: "fixture-secret" }),
  ).toContain("endereço final");
});
