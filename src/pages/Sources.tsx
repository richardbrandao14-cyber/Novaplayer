import { nativeAvailable } from "../integrations/native";
import { NativeSources } from "../components/native/NativeSources";
import { useState, type FormEvent } from "react";
import {
  Plus,
  ListVideo,
  Link,
  ShieldCheck,
  Pencil,
  Trash2,
} from "lucide-react";
import type { SourceDraft, DemoSource } from "../domain/types";
import { PageHeading } from "../components/PageHeading";
import { Modal } from "../ui/Dialog";
import { Button } from "../ui/Button";
import { sourceValidator } from "../services/sourceValidation";
import { useAppStore } from "../state/useAppStore";
const blank: SourceDraft = {
  name: "",
  kind: "m3u",
  url: "",
  username: "",
  password: "",
};
function DemoSources() {
  const { sources, saveSource, removeSource, notify, setDemo } = useAppStore();
  const desktop = nativeAvailable();
  const [editing, setEditing] = useState<string | null>(null);
  const [removing, setRemoving] = useState<DemoSource | null>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<SourceDraft>(blank);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  function changeOpen(value: boolean) {
    setOpen(value);
    setEditing(null);
    setDraft(blank);
    setErrors({});
    setMessage("");
  }
  function submit(e: FormEvent) {
    e.preventDefault();
    const issues = sourceValidator.validate(draft);
    setErrors(issues);
    if (!Object.keys(issues).length) {
      saveSource({
        id: editing ?? crypto.randomUUID(),
        name: draft.name.trim(),
        kind: draft.kind,
        host: new URL(draft.url).origin,
      });
      setDraft({ ...blank, kind: draft.kind });
      setEditing(null);
      setMessage(
        "Campos válidos. Nenhuma conexão foi realizada. Apenas nome, tipo e origem sem tokens ficam na memória desta sessão.",
      );
      notify("Fonte demonstrativa atualizada. Nenhuma credencial foi salva.");
    }
  }
  function field(
    key: "name" | "url" | "username" | "password",
    label: string,
    type = "text",
  ) {
    return (
      <label className="field" key={key}>
        {label}
        <input
          name={key}
          type={type}
          value={draft[key]}
          maxLength={key === "url" ? 4096 : key === "name" ? 100 : 512}
          autoComplete="off"
          aria-invalid={!!errors[key]}
          aria-describedby={errors[key] ? `error-${key}` : undefined}
          onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
        />
        {errors[key] && (
          <span id={`error-${key}`} className="field-error">
            {errors[key]}
          </span>
        )}
      </label>
    );
  }
  return (
    <div className="page">
      <div className="heading-with-action">
        <PageHeading
          title="Minhas Listas"
          description="Demonstração do cadastro. Fontes de exemplo não conectam nem importam conteúdo."
        />
        <Button onClick={() => (desktop ? setDemo(false) : changeOpen(true))}>
          <Plus size={17} />
          {desktop ? "Adicionar minha lista real" : "Adicionar lista"}
        </Button>
      </div>
      {desktop && (
        <section
          className="real-source-callout"
          aria-label="Conectar fontes reais"
        >
          <div>
            <span className="eyebrow">PRONTO PARA O SEU CONTEÚDO</span>
            <h2>Agora é a sua lista.</h2>
            <p>
              Esta página mostra exemplos. Para importar canais, filmes e séries
              da sua fonte autorizada, entre no modo real.
            </p>
          </div>
          <Button onClick={() => setDemo(false)}>
            Conectar lista de verdade
          </Button>
        </section>
      )}
      {sources.length === 0 ? (
        <div className="source-empty">
          <span className="source-icon">
            <ListVideo size={32} />
          </span>
          <h2>Uma biblioteca com a sua identidade</h2>
          <p>
            Conheça o formulário de fontes M3U e Xtream.
            <br />
            Nenhuma conexão será realizada. Cadastros de demonstração duram
            somente nesta sessão.
          </p>
          <Button variant="secondary" onClick={() => changeOpen(true)}>
            <Link size={16} />
            Explorar cadastro
          </Button>
          <div className="privacy-note">
            <ShieldCheck size={16} />
            Use apenas fontes que você tem autorização para acessar.
          </div>
        </div>
      ) : (
        <>
          <p className="notice">
            Demonstração · Apenas nome, tipo e domínio ficam na memória. Senhas,
            usuários, caminhos e tokens não são retidos. Os exemplos desaparecem
            ao recarregar.
          </p>
          <div className="source-grid">
            {sources.map((source) => (
              <article className="source-card" key={source.id}>
                <ListVideo size={24} />
                <span className="badge">Não conectado · Demo</span>
                <h2>{source.name}</h2>
                <p>{source.kind === "m3u" ? "M3U / M3U8" : "Xtream"}</p>
                <p className="source-host">{source.host}</p>
                <div className="source-actions">
                  <Button
                    variant="secondary"
                    aria-label={`Editar ${source.name}`}
                    onClick={() => {
                      setOpen(true);
                      setEditing(source.id);
                      setDraft({
                        ...blank,
                        name: source.name,
                        kind: source.kind,
                        url: source.host,
                      });
                      setErrors({});
                      setMessage("");
                    }}
                  >
                    <Pencil size={14} />
                    Editar
                  </Button>
                  <Button
                    variant="ghost"
                    aria-label={`Remover ${source.name}`}
                    onClick={() => setRemoving(source)}
                  >
                    <Trash2 size={14} />
                    Remover
                  </Button>
                </div>
              </article>
            ))}
          </div>
        </>
      )}
      <Modal
        open={open}
        onOpenChange={changeOpen}
        title={editing ? "Editar fonte demonstrativa" : "Adicionar lista"}
        description="Use dados fictícios. Nenhuma conexão será feita; credenciais e URLs completas não serão salvas."
      >
        <form onSubmit={submit} noValidate>
          <fieldset className="source-types">
            <legend>Tipo de fonte</legend>
            {(["m3u", "xtream"] as const).map((kind) => (
              <label key={kind}>
                <input
                  type="radio"
                  name="kind"
                  checked={draft.kind === kind}
                  onChange={() => {
                    setDraft({ ...blank, kind });
                    setErrors({});
                    setMessage("");
                  }}
                />
                {kind === "m3u" ? "M3U / M3U8" : "Xtream"}
              </label>
            ))}
          </fieldset>
          {field("name", "Nome da lista")}
          {field(
            "url",
            draft.kind === "m3u" ? "URL da lista" : "URL do servidor",
            "url",
          )}
          {draft.kind === "xtream" && (
            <>
              {field("username", "Usuário")}
              {field("password", "Senha", "password")}
            </>
          )}
          <p className="muted">
            Ao editar, somente o domínio é recuperado; caminhos e credenciais
            não são guardados.
          </p>
          <p className="muted">
            Arquivos locais serão suportados em uma fase futura.
          </p>
          {draft.url.startsWith("http:") && (
            <p className="notice">
              HTTP não protege os dados em trânsito. Prefira HTTPS.
            </p>
          )}
          <Button type="submit">Validar campos de demonstração</Button>
          {message && (
            <p role="status" className="notice">
              {message}
            </p>
          )}
        </form>
      </Modal>
      <Modal
        open={removing !== null}
        onOpenChange={(value) => {
          if (!value) setRemoving(null);
        }}
        title="Remover fonte demonstrativa?"
        description="Apenas o cadastro desta sessão será removido. Nenhum provedor será contatado."
      >
        <p>{removing?.name}</p>
        <div className="dialog-actions">
          <Button variant="secondary" onClick={() => setRemoving(null)}>
            Cancelar
          </Button>
          <Button
            onClick={() => {
              if (removing) removeSource(removing.id);
              setRemoving(null);
            }}
          >
            Confirmar remoção
          </Button>
        </div>
      </Modal>
    </div>
  );
}

export default function Sources() {
  const demo = useAppStore((s) => s.demo);
  return demo ? <DemoSources /> : <NativeSources />;
}
