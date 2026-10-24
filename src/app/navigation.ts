import {
  House,
  Radio,
  Clapperboard,
  Layers,
  Heart,
  History,
  ListVideo,
  Settings,
} from "lucide-react";
import type { PageId } from "../domain/types";
export const navigation = [
  { id: "home", label: "Início", icon: House },
  { id: "live", label: "TV ao Vivo", icon: Radio },
  { id: "movies", label: "Filmes", icon: Clapperboard },
  { id: "series", label: "Séries", icon: Layers },
  { id: "favorites", label: "Favoritos", icon: Heart },
  { id: "history", label: "Histórico", icon: History },
  { id: "sources", label: "Minhas Listas", icon: ListVideo },
  { id: "settings", label: "Configurações", icon: Settings },
] satisfies { id: PageId; label: string; icon: typeof House }[];
