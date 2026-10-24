import { Monitor } from "lucide-react";
import { Button } from "../../ui/Button";
import { useAppStore } from "../../state/useAppStore";
export function DesktopRequired() {
  const setDemo = useAppStore((s) => s.setDemo);
  return (
    <div className="empty-state native-required">
      <Monitor size={34} />
      <h2>Sua próxima história começa aqui</h2>
      <p>
        Funções nativas exigem o aplicativo Windows. A prévia web não conecta
        M3U, Xtream ou SQLite e não simula uma importação real.
      </p>
      <Button variant="secondary" onClick={() => setDemo(true)}>
        Explorar demonstração
      </Button>
    </div>
  );
}
