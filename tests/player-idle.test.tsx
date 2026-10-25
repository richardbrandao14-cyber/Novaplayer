import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useIdleControls } from "../src/player/useIdleControls";
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
it("oculta após cinco segundos e reinicia o prazo a cada interação", () => {
  vi.useFakeTimers();
  const { result } = renderHook(() => useIdleControls(true, false));
  act(() => vi.advanceTimersByTime(4999));
  expect(result.current.idle).toBe(false);
  act(() => vi.advanceTimersByTime(1));
  expect(result.current.idle).toBe(true);
  act(() => result.current.wake());
  act(() => vi.advanceTimersByTime(2500));
  expect(result.current.idle).toBe(false);
  act(() => result.current.wake());
  act(() => vi.advanceTimersByTime(4999));
  expect(result.current.idle).toBe(false);
  act(() => vi.advanceTimersByTime(1));
  expect(result.current.idle).toBe(true);
});
it("mantém acesso enquanto um painel está aberto e retoma prazo ao fechar", () => {
  vi.useFakeTimers();
  const { result, rerender } = renderHook(
    ({ hold }) => useIdleControls(true, hold),
    { initialProps: { hold: true } },
  );
  act(() => vi.advanceTimersByTime(5000));
  expect(result.current.idle).toBe(false);
  rerender({ hold: false });
  act(() => vi.advanceTimersByTime(5000));
  expect(result.current.idle).toBe(true);
});
it("mantém controles visíveis fora da tela cheia", () => {
  vi.useFakeTimers();
  const { result } = renderHook(() => useIdleControls(false, false));
  act(() => vi.advanceTimersByTime(10000));
  expect(result.current.idle).toBe(false);
});
