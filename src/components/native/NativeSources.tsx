import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Plus, FileUp, RefreshCw, Trash2, X } from "lucide-react";
import type {
  NativeSource,
  NativeSourceInput,
} from "../../domain/native/types";
import {
  nativeApi,
  nativeAvailable,
  nativeError,
  terminalJob,
  jobLabels,
  importWarning,
} from "../../integrations/native";
import { useNativeJobs } from "../../state/useNativeJobs";
import { PageHeading } from "../PageHeading";
import { DesktopRequired } from "./DesktopRequired";
import { Modal } from "../../ui/Dialog";
import { Button } from "../../ui/Button";
const blank: NativeSourceInput = {
  name: "",
  kind: "m3u",
  url: "",
  username: "",
  password: "",
};
export function NativeSources() {
  const [sources, setSources] = useState<NativeSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<NativeSourceInput>(blank);
  const [removing, setRemoving] = useState<NativeSource | null>(null);
  const { jobs, remember } = useNativeJobs();
  const activeIds = Object.values(jobs)
    .filter((job) => !terminalJob(job.state))
    .map((job) => job.id)
    .join(",");
  const load = useCallback(async () => {
    if (!nativeAvailable()) return;
    try {
      setSources(await nativeApi.listSources());
      setError("");
    } catch (e) {
      setError(nativeError(e));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    if (!nativeAvailable()) return;
    let active = true;
    nativeApi
      .listSources()
      .then((list) => {
        if (active) setSources(list);
      })
      .catch((e) => {
        if (active) setError(nativeError(e));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!activeIds || !nativeAvailable()) return;
    let cancelled = false;
    let running = false;
    const poll = async () => {
      if (running) return;
      running = true;
      try {
        for (const id of activeIds.split(",")) {
          const job = await nativeApi.importStatus(id);
          if (cancelled) return;
          remember(job);
          if (terminalJob(job.state)) await load();
        }
      } catch (e) {
        if (!cancelled) setError(nativeError(e));
      } finally {
        running = false;
      }
    };
    void poll();
    const timer = setInterval(() => void poll(), 1000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [activeIds, remember, load]);
  async function start(source: NativeSource) {
    setError("");
    try {
      const id = await nativeApi.startImport(source.id);
      const job = await nativeApi.importStatus(id);
      remember(job);
      await load();
    } catch (e) {
      setError(nativeError(e));
    }
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const input = { ...draft };
    setDraft({ ...input, password: "" });
    try {
      const source = await nativeApi.saveSource(input);
      setDraft(blank);
      setOpen(false);
      await load();
      await start(source);
    } catch (e) {
      setError(nativeError(e));
    } finally {
      setBusy(false);
    }
  }
  async function localFile() {
    setBusy(true);
    setError("");
    try {
      const source = await nativeApi.pickFile(draft.name.trim());
      setDraft(blank);
      if (source) {
        setOpen(false);
        await load();
        await start(source);
      }
    } catch (e) {
      setError(nativeError(e));
    } finally {
      setBusy(false);
    }
  }
  function changeOpen(value: boolean) {
    if (busy) return;
    setOpen(value);
    setDraft(blank);
    setError("");
  }
  return (
    <div className="page">
      <div className="heading-with-action">
        <PageHeading
          title="Minhas Listas"
          description="Conecte seu conteúdo autorizado por URL, arquivo M3U ou acesso Xtream. Depois da importação, escolha o que assistir."
        />
        {nativeAvailable() && (
          <Button onClick={() => changeOpen(true)}>
            <Plus size={16} />
            Adicionar fonte real
          </Button>
        )}
      </div>
      {!nativeAvailable() ? (
        <DesktopRequired />
      ) : (
        <>
          <p className="notice real-mode-notice">
            <strong>Modo real ativo · Importação de verdade.</strong> URLs e
            credenciais são enviadas somente ao backend nativo para acesso à
            fonte que você cadastrar. Use apenas conteúdo autorizado.
          </p>
          {error && (
            <p role="alert" className="notice">
              {error}
            </p>
          )}
          {loading ? (
            <p role="status">Carregando fontes…</p>
          ) : sources.length === 0 ? (
            <div className="empty-state">
              <h2>Nenhuma fonte cadastrada</h2>
              <p>
                Adicione uma URL M3U, escolha um arquivo local ou cadastre seu
                acesso Xtream.
              </p>
              <Button variant="secondary" onClick={() => changeOpen(true)}>
                Cadastrar primeira fonte
              </Button>
            </div>
          ) : (
            <div className="source-grid">
              {sources.map((source) => {
                const job = jobs[source.id];
                const active = job && !terminalJob(job.state);
                return (
                  <article key={source.id} className="source-card">
                    <span className="badge">
                      {["local", "file"].includes(source.kind)
                        ? "Arquivo M3U"
                        : source.kind === "xtream"
                          ? "Xtream"
                          : "URL M3U"}
                    </span>
                    <h2>{source.name || "Nome não informado"}</h2>
                    <p>{source.itemCount} registros no catálogo ativo</p>
                    <p>
                      Estado:{" "}
                      {job
                        ? (jobLabels[job.state] ?? "Operação em andamento")
                        : (jobLabels[source.status] ??
                          (
                            {
                              ready: "Catálogo disponível",
                              registered: "Cadastrada",
                              pending: "Aguardando importação",
                            } as Record<string, string>
                          )[source.status] ??
                          "Fonte cadastrada")}
                    </p>
                    {source.status === "failed" && !job && <p className="notice">A última importação falhou. Clique em Atualizar lista para tentar novamente e ver o diagnóstico.</p>}
                    {job && (
                      <div className="native-job" aria-live="polite">
                        <p>
                          {job.processed} processados · {job.invalid} inválidos
                          {job.total != null
                            ? ` · Total informado: ${job.total}`
                            : ""}
                        </p>
                        {active && (
                          <progress aria-label="Importação em andamento" />
                        )}
                        {job.added != null && (
                          <p>
                            {job.added} adicionados · {job.removed ?? 0}{" "}
                            removidos
                          </p>
                        )}
                        {job.report && (
                          <div className="native-import-report">
                            <p>
                              Relatório final: {job.report.valid} válidos ·{" "}
                              {job.report.invalid} inválidos.
                            </p>
                            {job.report.warnings.length > 0 && (
                              <ul aria-label="Observações da importação">
                                {job.report.warnings.map((warning, index) => (
                                  <li key={index}>{importWarning(warning)}</li>
                                ))}
                              </ul>
                            )}
                          </div>
                        )}
                        {job.error && (
                          <p role="alert">{nativeError(job.error)}</p>
                        )}
                      </div>
                    )}
                    <div className="source-actions">
                      {active ? (
                        <Button
                          variant="secondary"
                          onClick={() => {
                            void nativeApi
                              .cancelImport(job.id)
                              .catch((e) => setError(nativeError(e)));
                          }}
                        >
                          <X size={15} />
                          Cancelar importação
                        </Button>
                      ) : (
                        <Button
                          variant="secondary"
                          onClick={() => void start(source)}
                        >
                          <RefreshCw size={15} />
                          Atualizar lista
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        disabled={!!active}
                        onClick={() => setRemoving(source)}
                        aria-label={`Remover fonte ${source.name}`}
                      >
                        <Trash2 size={15} />
                        Remover
                      </Button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}
      <Modal
        open={open}
        onOpenChange={changeOpen}
        title="Adicionar fonte real"
        description="Dados sensíveis ficam protegidos pelo Windows. Não serão salvos no armazenamento web."
      >
        <form onSubmit={(e) => void submit(e)}>
          <fieldset className="source-types">
            <legend>Tipo de fonte</legend>
            {(["m3u", "xtream"] as const).map((kind) => (
              <label key={kind}>
                <input
                  type="radio"
                  name="native-kind"
                  checked={draft.kind === kind}
                  disabled={busy}
                  onChange={() => setDraft({ ...blank, kind })}
                />
                {kind === "m3u" ? "M3U / M3U8" : "Xtream"}
              </label>
            ))}
          </fieldset>
          <label className="field">
            Nome da lista
            <input
              value={draft.name}
              disabled={busy}
              maxLength={100}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </label>
          <label className="field">
            {draft.kind === "m3u" ? "URL da lista" : "URL do servidor"}
            <input
              type="url"
              required
              value={draft.url}
              disabled={busy}
              maxLength={4096}
              autoComplete="off"
              onChange={(e) => setDraft({ ...draft, url: e.target.value })}
            />
          </label>
          {draft.kind === "xtream" && (
            <>
              <label className="field">
                Usuário
                <input
                  required
                  disabled={busy}
                  value={draft.username ?? ""}
                  maxLength={512}
                  autoComplete="off"
                  onChange={(e) =>
                    setDraft({ ...draft, username: e.target.value })
                  }
                />
              </label>
              <label className="field">
                Senha
                <input
                  type="password"
                  required
                  disabled={busy}
                  value={draft.password ?? ""}
                  maxLength={512}
                  autoComplete="off"
                  onChange={(e) =>
                    setDraft({ ...draft, password: e.target.value })
                  }
                />
              </label>
            </>
          )}
          {draft.url.startsWith("http:") && (
            <p className="notice">
              HTTP não protege seus dados em trânsito. Prefira HTTPS.
            </p>
          )}
          {error && <p role="alert">{error}</p>}
          <div className="dialog-actions">
            {draft.kind === "m3u" && (
              <Button
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={() => void localFile()}
              >
                <FileUp size={15} />
                Escolher arquivo M3U
              </Button>
            )}
            <Button type="submit" disabled={busy}>
              {busy ? "Preparando…" : "Salvar e importar"}
            </Button>
          </div>
        </form>
      </Modal>
      <Modal
        open={removing !== null}
        onOpenChange={(value) => {
          if (!value) setRemoving(null);
        }}
        title="Remover fonte real?"
        description="Isso remove o catálogo desta fonte do banco local. Fontes de outros provedores serão preservadas."
      >
        <p>{removing?.name}</p>
        <div className="dialog-actions">
          <Button variant="secondary" onClick={() => setRemoving(null)}>
            Cancelar
          </Button>
          <Button
            onClick={() => {
              const id = removing?.id;
              if (!id) return;
              setBusy(true);
              void nativeApi
                .removeSource(id)
                .then(() => {
                  setRemoving(null);
                  return load();
                })
                .catch((e) => setError(nativeError(e)))
                .finally(() => setBusy(false));
            }}
            disabled={busy}
          >
            Confirmar remoção
          </Button>
        </div>
      </Modal>
    </div>
  );
}
