import { afterEach, expect, it, vi } from "vitest";
const source = vi.hoisted(() => ({ image: vi.fn() }));
vi.mock("../src/integrations/native", () => ({
  nativeApi: { image: source.image },
}));
import { artworkImage } from "../src/integrations/artworkCache";
afterEach(() => {
  vi.restoreAllMocks();
  source.image.mockReset();
});
it("compartilha pedido em andamento e reaproveita a capa ao reabrir detalhes", async () => {
  let finish: (data: { mime: string; base64: string }) => void = () => {};
  source.image.mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  const hero = artworkImage("art-shared-fixture");
  const poster = artworkImage("art-shared-fixture");
  expect(source.image).toHaveBeenCalledTimes(1);
  finish({ mime: "image/png", base64: "AA==" });
  expect(await hero).toBe(await poster);
  expect(await artworkImage("art-shared-fixture")).toBe(
    "data:image/png;base64,AA==",
  );
  expect(source.image).toHaveBeenCalledTimes(1);
});
it("permite recuperar falha e renova imagem quando expira", async () => {
  source.image
    .mockRejectedValueOnce(new Error("fixture failure"))
    .mockResolvedValue({ mime: "image/jpeg", base64: "AA==" });
  await expect(artworkImage("art-retry-fixture")).rejects.toThrow(
    "fixture failure",
  );
  await expect(artworkImage("art-retry-fixture")).resolves.toContain(
    "image/jpeg",
  );
  const now = Date.now();
  vi.spyOn(Date, "now").mockReturnValue(now + 61_000);
  await artworkImage("art-retry-fixture");
  expect(source.image).toHaveBeenCalledTimes(3);
});
