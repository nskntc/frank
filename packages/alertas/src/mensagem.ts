import type { AvaliacaoOferta, Itinerario, Perna, Vigilancia } from '@frank/contratos';
import { type Centavos, type EtiquetaCompra, formatarReais, type OndeComprar } from '@frank/dominio';
import type { MensagemAlerta } from './canal.js';

export interface DadosAlerta {
  vigilancia: Pick<Vigilancia, 'descricao' | 'adultos'>;
  itinerario: Itinerario;
  precoFinalCentavos: Centavos;
  percentualAbaixo: number | null;
  avaliacao: AvaliacaoOferta | null;
  ondeComprar: OndeComprar | null;
  /** Quando o preco foi conferido na fonte (instante ISO). Aviso guardado pode sair horas depois. */
  vistoEm: string;
}

const formatoVisto = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

function vistoEm(instante: string): string {
  const data = new Date(instante);
  if (Number.isNaN(data.getTime())) return '';
  const partes = Object.fromEntries(formatoVisto.formatToParts(data).map((p) => [p.type, p.value]));
  return `${partes.day}/${partes.month} às ${partes.hour}:${partes.minute}`;
}

/** "2027-03-12T10:45:00" -> "12/03 10:45" (horario local do aeroporto, como a fonte manda). */
function quando(horario: string): string {
  return `${horario.slice(8, 10)}/${horario.slice(5, 7)} ${horario.slice(11, 16)}`;
}

function descreverPerna(nome: string, p: Perna): string {
  const companhias = [...new Set(p.trechos.map((t) => t.companhia))].join(', ');
  const escalas = p.escalas === 0 ? 'direto' : `${p.escalas} escala(s) (${p.trechos.slice(0, -1).map((t) => t.para).join(', ')})`;
  return `${nome}: ${p.de} ${quando(p.partida)} -> ${p.para} ${quando(p.chegada)}, ${companhias}, ${escalas}`;
}

const ROTULOS: Record<EtiquetaCompra, string> = {
  '24h_para_desistir': '24 h para desistir',
  empresa_estrangeira: 'empresa estrangeira, com IOF',
};

/**
 * O texto do aviso (RF-15), montado pelo codigo, sem IA, em texto puro. Os links sao so os do
 * "Onde comprar" (fonte, Google ou busca preenchida no site do vendedor). O resumo e as
 * pegadinhas do Claude ja passaram pelo filtro de preco e link do avaliador.
 */
export function montarMensagem(d: DadosAlerta): MensagemAlerta {
  const { itinerario: it } = d;
  const abaixo =
    d.percentualAbaixo !== null && d.percentualAbaixo > 0 ? ` (${d.percentualAbaixo}% abaixo do normal)` : '';
  const destaque = d.ondeComprar && d.ondeComprar.destacado >= 0 ? d.ondeComprar.itens[d.ondeComprar.destacado] : undefined;
  const melhor = destaque ? destaque.precoFinalCentavos : d.precoFinalCentavos;

  const linhas: string[] = [];
  linhas.push(`${it.ida.de} -> ${it.ida.para}${it.volta ? ' (ida e volta)' : ' (só ida)'}: ${formatarReais(melhor)}${abaixo}`);
  const visto = vistoEm(d.vistoEm);
  if (visto) linhas.push(`Preço conferido na fonte em ${visto} (horário de Brasília).`);
  linhas.push(`Vigilância: ${d.vigilancia.descricao}`);
  linhas.push(`${d.vigilancia.adultos} adulto(s). Mala despachada incluída: ${it.malas.despachada > 0 ? 'sim' : 'não'}.`);
  linhas.push('');
  linhas.push(descreverPerna('Ida', it.ida));
  if (it.volta) linhas.push(descreverPerna('Volta', it.volta));

  if (d.avaliacao) {
    linhas.push('');
    linhas.push(`${d.avaliacao.valeAPena ? 'Vale a pena' : 'Atenção'}: ${d.avaliacao.resumo}`);
    if (d.avaliacao.pegadinhas.length) {
      linhas.push('Cuidados:');
      for (const p of d.avaliacao.pegadinhas) linhas.push(`- ${p.descricao}`);
    }
  } else {
    linhas.push('');
    linhas.push('Sem avaliação do Claude desta vez: confira os horários e as escalas antes de comprar.');
  }

  if (d.ondeComprar?.itens.length) {
    linhas.push('');
    linhas.push('Onde comprar (preço final):');
    d.ondeComprar.itens.slice(0, 5).forEach((item, i) => {
      const marca = i === d.ondeComprar?.destacado ? '* ' : '- ';
      const etiquetas = item.etiquetas.length ? ` [${item.etiquetas.map((e) => ROTULOS[e]).join('; ')}]` : '';
      linhas.push(`${marca}${item.vendedor}: ${formatarReais(item.precoFinalCentavos)}${etiquetas}`);
      if (item.link) linhas.push(`  ${item.link}`);
    });
    if (d.ondeComprar.motivo === 'companhia_na_tolerancia') {
      linhas.push('* Destacada: a companhia custa pouco mais e dá as 24 h para desistir.');
    }
  } else {
    linhas.push('');
    linhas.push(`Comprar: ${it.linkCompra}`);
  }

  linhas.push('');
  linhas.push('Antes de pagar: confira o preço final na tela de pagamento e use o nome exatamente como no documento.');
  linhas.push('Comprando no site da companhia com 7 dias ou mais de antecedência, dá para desistir sem custo em até 24 h.');

  return {
    assunto: `Frank: ${it.ida.de} -> ${it.ida.para} por ${formatarReais(melhor)}`,
    texto: linhas.join('\n'),
  };
}
