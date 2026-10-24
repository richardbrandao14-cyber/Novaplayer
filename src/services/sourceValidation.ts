import type { SourceDraft, SourcePort } from "../domain/types";
export const sourceValidator: SourcePort = {
  validate(draft: SourceDraft) {
    const errors: Record<string, string> = {};
    if (!draft.name.trim() || draft.name.length > 100)
      errors.name = "Informe um nome com até 100 caracteres.";
    try {
      const url = new URL(draft.url);
      if (
        !["https:", "http:"].includes(url.protocol) ||
        !url.hostname ||
        url.username ||
        url.password ||
        draft.url.length > 4096
      )
        throw new Error();
    } catch {
      errors.url =
        "Informe uma URL HTTP ou HTTPS válida, sem credenciais embutidas.";
    }
    if (draft.kind === "xtream") {
      if (!draft.username.trim()) errors.username = "Informe o usuário.";
      if (!draft.password) errors.password = "Informe a senha.";
    }
    return errors;
  },
};
