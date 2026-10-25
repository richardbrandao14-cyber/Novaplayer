import { NativeCatalogBrowser } from "../components/native/NativeCatalogBrowser";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { useCatalog } from "../services/useCatalog";
import { useAppStore } from "../state/useAppStore";
import { PageHeading } from "../components/PageHeading";
import { CatalogView } from "../components/CatalogView";
import { EmptyState } from "../components/EmptyState";
import { LoadState } from "../components/LoadState";
import { Modal } from "../ui/Dialog";
import { Button } from "../ui/Button";
function DemoHistory() {
  const { items, status } = useCatalog();
  const { historyIds, clearHistory } = useAppStore();
  const [confirm, setConfirm] = useState(false);
  const history = items.filter((i) => historyIds.includes(i.id));
  return (
    <div className="page">
      <div className="heading-with-action">
        <PageHeading
          title="Histórico"
          description="Atividade ilustrativa. Nenhuma reprodução foi realizada; alterações valem somente nesta sessão."
        />
        <Button
          variant="secondary"
          disabled={!history.length}
          onClick={() => setConfirm(true)}
        >
          <Trash2 size={15} />
          Limpar histórico
        </Button>
      </div>
      {status !== "ready" ? (
        <LoadState status={status} />
      ) : history.length ? (
        <>
          <p className="eyebrow">SESSÃO ILUSTRATIVA</p>
          <CatalogView items={history} />
        </>
      ) : (
        <EmptyState
          title="Nenhuma atividade por aqui"
          detail="O histórico demonstrativo está vazio. Reabrir a aplicação inicia uma nova sessão de exemplos."
        />
      )}
      <Modal
        open={confirm}
        onOpenChange={setConfirm}
        title="Limpar histórico demonstrativo?"
        description="Isso remove apenas os exemplos desta sessão. Não há histórico real de reprodução."
      >
        <div className="dialog-actions">
          <Button variant="secondary" onClick={() => setConfirm(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => {
              clearHistory();
              setConfirm(false);
            }}
          >
            Confirmar limpeza
          </Button>
        </div>
      </Modal>
    </div>
  );
}

export default function History() {
  const demo = useAppStore((s) => s.demo);
  return demo ? (
    <DemoHistory />
  ) : (
    <NativeCatalogBrowser title="Continuar assistindo" collection="continue" />
  );
}
