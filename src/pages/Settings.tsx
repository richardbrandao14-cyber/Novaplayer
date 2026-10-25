import { useAppStore } from "../state/useAppStore";
import { PageHeading } from "../components/PageHeading";
export default function Settings() {
  const { demo, setDemo } = useAppStore();
  return (
    <div className="page settings-page">
      <PageHeading
        title="Configurações"
        description="Um espaço pensado para o seu jeito de assistir."
      />
      <section className="settings-section">
        <h2>Aparência</h2>
        <div className="setting-row">
          <div>
            <h3>Tema NOVA Dark</h3>
            <p>Grafite, contraste sutil e foco no conteúdo.</p>
          </div>
          <span className="theme-swatch" aria-label="Tema escuro ativo" />
        </div>
        <div className="setting-row">
          <div>
            <h3>Dados demonstrativos</h3>
            <p>
              Desative para usar o catálogo real no aplicativo Windows.
              Preferência salva neste dispositivo.
            </p>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={demo}
              onChange={(e) => setDemo(e.target.checked)}
            />
            <span>Ativar demonstração</span>
          </label>
        </div>
        <div className="setting-row">
          <div>
            <h3>Movimento reduzido</h3>
            <p>Segue automaticamente a preferência do sistema.</p>
          </div>
          <span className="badge">Automático</span>
        </div>
      </section>
      <section className="settings-section">
        <h2>Reprodução</h2>
        <p className="muted">
          No Windows, clique no canal, filme ou episódio para assistir nesta
          janela. Volume, áudio e legendas ficam nos controles sobre o vídeo.
          Preferências permanentes e ajustes de buffer ainda estão em desenvolvimento.
        </p>
        <button className="nova-button button-secondary" disabled>
          Preferências permanentes em breve
        </button>
      </section>
      <section className="settings-section">
        <h2>Idioma</h2>
        <label className="field">
          Idioma da interface
          <select value="pt-BR" disabled>
            <option value="pt-BR">Português (Brasil)</option>
          </select>
        </label>
        <p className="muted">Outros idiomas ainda não estão disponíveis.</p>
      </section>
      <section className="settings-section">
        <h2>Cache</h2>
        <p className="muted">
          No modo real, logos e capas são carregados sob demanda pelo cache
          nativo com limites de tamanho e expiração. As imagens demonstrativas
          são arquivos locais.
        </p>
      </section>
      <section className="settings-section">
        <h2>Sobre o NOVA PLAYER</h2>
        <p>Versão 0.1.0 · Fundação técnica · Windows 10/11 x64</p>
        <p className="muted">
          Não fornecemos canais, filmes, séries ou assinaturas. Prévia web não
          comprova reprodução nativa.
        </p>
      </section>
    </div>
  );
}
