import type { MediaItem, Season } from "../domain/types";
const demoSeasons = (
  prefix: string,
  artwork: string,
  count: number,
): readonly Season[] =>
  Array.from({ length: count }, (_, s) => ({
    id: String(s + 1),
    number: s + 1,
    episodes: [1, 2, 3].map((n) => ({
      id: `${prefix}-${s + 1}-${n}`,
      title: `Episódio ${n}`,
      description:
        "Uma nova etapa da jornada. Descrição fictícia para esta demonstração.",
      artwork,
      duration: "42 min",
      ...(n === 1 ? { progress: 68 } : {}),
    })),
  }));
export const demoCatalog: readonly MediaItem[] = [
  {
    id: "aurora",
    title: "Além da Aurora",
    category: "Ficção científica",
    kind: "movie",
    year: "2026",
    duration: "1h 48min",
    artwork: "aurora",
    progress: 42,
    description:
      "Em uma estação distante, uma cartógrafa encontra sinais de um lugar que ainda não existe. Uma história fictícia criada para demonstrar o NOVA PLAYER.",
  },
  {
    id: "ocean",
    title: "O silêncio do oceano",
    category: "Documentário",
    kind: "movie",
    year: "2025",
    duration: "52min",
    artwork: "ocean",
    description:
      "Uma viagem imaginária pelas profundezas e suas paisagens. Conteúdo ilustrativo, sem vídeo disponível.",
  },
  {
    id: "terra",
    title: "Terra de ninguém",
    category: "Drama",
    kind: "movie",
    year: "2026",
    duration: "2h 06min",
    artwork: "terra",
    description:
      "Dois caminhos se encontram em uma cidade esquecida. Obra fictícia para demonstração visual.",
  },
  {
    id: "orbit",
    title: "Última órbita",
    category: "Ficção científica",
    kind: "movie",
    year: "2024",
    duration: "1h 36min",
    artwork: "orbit",
    description:
      "Uma missão, um último contato. Obra fictícia, sem reprodução.",
  },
  {
    id: "atlas",
    seasons: demoSeasons("atlas", "atlas", 2),
    title: "Atlas",
    category: "Aventura",
    kind: "series",
    year: "2026",
    duration: "2 temporadas",
    artwork: "atlas",
    progress: 68,
    description:
      "Uma equipe percorre territórios imaginários. Série demonstrativa, com episódios ilustrativos.",
  },
  {
    id: "noite",
    seasons: demoSeasons("noite", "noite", 1),
    title: "Depois da meia-noite",
    category: "Drama",
    kind: "series",
    year: "2025",
    duration: "1 temporada",
    artwork: "noite",
    description:
      "Histórias que se cruzam quando a cidade adormece. Série fictícia.",
  },
  {
    id: "horizon",
    seasons: demoSeasons("horizon", "horizon", 1),
    title: "Horizonte",
    category: "Natureza",
    kind: "series",
    year: "2026",
    duration: "1 temporada",
    artwork: "horizon",
    description:
      "Um olhar imaginário sobre paisagens e jornadas. Série fictícia.",
  },
  {
    id: "nova-live",
    title: "NOVA Natureza",
    category: "Natureza",
    kind: "live",
    year: "Demo",
    duration: "Programação ilustrativa",
    artwork: "ocean",
    description:
      "Canal fictício para demonstrar a seleção de TV ao vivo. Nenhuma transmissão disponível.",
  },
  {
    id: "nova-cinema",
    title: "NOVA Cinema",
    category: "Cinema",
    kind: "live",
    year: "Demo",
    duration: "Programação ilustrativa",
    artwork: "aurora",
    description: "Canal demonstrativo sem transmissão.",
  },
  {
    id: "nova-world",
    title: "NOVA Mundo",
    category: "Documentários",
    kind: "live",
    year: "Demo",
    duration: "Programação ilustrativa",
    artwork: "atlas",
    description: "Canal demonstrativo sem transmissão.",
  },
];
