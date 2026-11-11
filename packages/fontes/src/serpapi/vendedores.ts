/**
 * Vendedor estrangeiro: compra com cartao brasileiro paga 3,5% de IOF. Classificacao por nome,
 * como o Google Flights mostra (teste de 2026-11-11). Desconhecido conta como nacional: melhor
 * nao inventar um imposto; a etiqueta "empresa estrangeira" so aparece quando se sabe.
 */
const ESTRANGEIROS = [
  'kiwi.com',
  'trip.com',
  'mytrip',
  'gotogate',
  'kiss&fly',
  'flightnetwork',
  'booking.com',
  'edreams',
  'opodo',
  'expedia',
  'travelgenio',
  'budgetair',
  'vayama',
  'tripsta',
] as const;

export function vendedorEstrangeiro(nome: string): boolean {
  const n = nome.trim().toLowerCase();
  return ESTRANGEIROS.some((e) => n === e || n.startsWith(`${e} `));
}
