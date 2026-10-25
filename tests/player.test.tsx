import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
const ipc = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ isTauri: () => true, invoke: ipc.invoke }));
import { NativePlayer } from "../src/components/native/NativePlayer";
import { nativeError } from "../src/integrations/native";
afterEach(() => { cleanup(); ipc.invoke.mockReset(); });
it("envia somente IDs e controles tipados; exibe estado real e som", async () => {
  ipc.invoke.mockImplementation(async (command: string) => {
    if (command === "player_status") return { state: "playing", position: 2, duration: 60, volume: 75, paused: false, muted: false, seekable: true, speed: 1, tracks: [{ id: 2, kind: "audio", label: "por", selected: true }], error: null };
  });
  const user = userEvent.setup();
  render(<NativePlayer mediaId="opaque-media" episodeId="opaque-episode" />);
  await screen.findByText("Reproduzindo");
  await user.click(screen.getByRole("button", { name: "Reproduzir episódio" }));
  expect(ipc.invoke).toHaveBeenCalledWith("play_media", { mediaId: "opaque-media", episodeId: "opaque-episode" });
  await user.click(screen.getByRole("button", { name: "Silenciar" }));
  expect(ipc.invoke).toHaveBeenCalledWith("player_control", { control: { kind: "mute", value: true } });
  expect(screen.getByRole("slider", { name: "Volume" })).toHaveValue("75");
  expect(screen.getByRole("combobox", { name: "Faixa de áudio" })).toHaveValue("2");
});
it("não oferece busca temporal para live sem suporte; erro nativo não expõe a URL", async () => {
  ipc.invoke.mockImplementation(async (command: string) => {
    if (command === "player_status") return { state: "playing", position: 0, duration: 0, volume: 100, paused: false, muted: false, seekable: false, speed: 1, tracks: [], error: null };
    if (command === "play_media") throw { code: "playback", message: "https://example.com/private?token=fixture-secret" };
  });
  const user = userEvent.setup();
  render(<NativePlayer mediaId="opaque-live" />);
  await screen.findByText("Reproduzindo");
  expect(screen.queryByRole("slider", { name: "Posição da reprodução" })).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Reproduzir agora" }));
  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível reproduzir"));
  expect(document.body.textContent).not.toContain("fixture-secret");
});
it("traduz falhas Xtream e redirecionamento sem reutilizar mensagens remotas", () => {
  expect(nativeError({ code: "not_found", message: "fixture-secret" })).toContain("não foi encontrado");
  expect(nativeError({ code: "provider", message: "fixture-secret" })).toContain("Xtream");
  expect(nativeError({ code: "redirect", message: "fixture-secret" })).toContain("endereço final");
});
