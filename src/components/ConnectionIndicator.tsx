import { useEffect, useState } from "react";
import { Wifi, WifiOff, CircleHelp } from "lucide-react";
import { Popover } from "radix-ui";
import { nativeApi, nativeAvailable, type ConnectionStatus } from "../integrations/native";
export function ConnectionIndicator() {
  const [online, setOnline] = useState(() => navigator.onLine);
  const [observation, setObservation] = useState<ConnectionStatus | null>(null);
  useEffect(() => {
    let active = true;
    const network = () => setOnline(navigator.onLine);
    const poll = async () => {
      if (document.hidden || !nativeAvailable()) return;
      try { const value = await nativeApi.connectionStatus(); if (active) setObservation(value); }
      catch { if (active) setObservation(null); }
    };
    const visible = () => { if (!document.hidden) void poll(); };
    window.addEventListener("online", network); window.addEventListener("offline", network);
    document.addEventListener("visibilitychange", visible);
    void poll(); const timer = setInterval(() => void poll(), 15000);
    return () => { active = false; clearInterval(timer); window.removeEventListener("online", network); window.removeEventListener("offline", network); document.removeEventListener("visibilitychange", visible); };
  }, []);
  const state = !online ? "offline" : observation?.state || "unknown";
  const label = state === "offline" ? "Sem rede" : state === "success" ? "Fonte respondeu" : state === "failure" ? "Falha na consulta" : "Rede disponível";
  const Icon = state === "offline" ? WifiOff : state === "failure" ? CircleHelp : Wifi;
  return <Popover.Root>
    <Popover.Trigger className={`connection-indicator connection-${state}`} aria-label={`Conexão: ${label}`}><Icon size={17}/><span>{label}</span></Popover.Trigger>
    <Popover.Portal><Popover.Content className="connection-popover" sideOffset={12} align="end" aria-label="Estado da conexão">
      <h2>{label}</h2>
      <p>{!online ? "O dispositivo informa que está sem conexão de rede." : "A rede está disponível no dispositivo. Isso não garante acesso à Internet ou ao provedor."}</p>
      {observation?.state !== "unknown" && observation?.durationMs != null && online ? <p>Última consulta à fonte: <strong>{observation.durationMs} ms</strong>. {observation.state === "success" ? "Concluída." : "Não concluída."}</p> : <p>Nenhuma medição recente da fonte.</p>}
      <small>O tempo inclui a consulta completa. Não é teste de velocidade nem ping. Nenhum teste adicional de rede é executado.</small>
      <Popover.Close className="connection-close">Entendi</Popover.Close>
    </Popover.Content></Popover.Portal>
  </Popover.Root>;
}
