import { Library } from "lucide-react";
import { Button } from "../ui/Button";
import { useAppStore } from "../state/useAppStore";
export function EmptyState({
  title = "Sua próxima história começa aqui",
  detail = "Adicione suas próprias fontes autorizadas quando a integração estiver disponível, ou explore a demonstração.",
}: {
  title?: string;
  detail?: string;
}) {
  const setDemo = useAppStore((s) => s.setDemo);
  return (
    <div className="empty-state">
      <Library size={32} />
      <h2>{title}</h2>
      <p>{detail}</p>
      <Button variant="secondary" onClick={() => setDemo(true)}>
        Explorar demonstração
      </Button>
    </div>
  );
}
