import { describe, it, expect } from "vitest";
import { sourceValidator } from "../src/services/sourceValidation";
import type { SourceDraft } from "../src/domain/types";
const valid: SourceDraft = {
  name: "Lista demo",
  kind: "m3u",
  url: "https://example.com/list.m3u",
  username: "",
  password: "",
};
describe("validação de fontes sem rede", () => {
  it("aceita HTTP/S válidos", () => {
    expect(sourceValidator.validate(valid)).toEqual({});
    expect(
      sourceValidator.validate({
        ...valid,
        url: "http://localhost:8080/list.m3u",
      }),
    ).toEqual({});
  });
  it.each([
    "javascript:alert(1)",
    "file:///secret",
    "not a url",
    "https://user:password@example.com/list",
  ])("rejeita URL insegura: %s", (url) => {
    expect(sourceValidator.validate({ ...valid, url })).toHaveProperty("url");
  });
  it("exige nome, limita tamanho e exige credenciais somente no Xtream", () => {
    expect(sourceValidator.validate({ ...valid, name: " " })).toHaveProperty(
      "name",
    );
    expect(
      sourceValidator.validate({ ...valid, name: "x".repeat(101) }),
    ).toHaveProperty("name");
    expect(
      sourceValidator.validate({ ...valid, kind: "xtream" }),
    ).toMatchObject({
      username: expect.any(String),
      password: expect.any(String),
    });
  });
});
