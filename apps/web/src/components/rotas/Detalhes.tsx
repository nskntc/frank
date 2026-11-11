import type { NovaVigilancia } from '@frank/contratos';
import { formatarReais } from '@frank/dominio';
import { janela, plural } from '@/lib/formatar';

/** Os campos de uma vigilancia, lado a lado, para conferir. */
export function Detalhes({ v }: { v: NovaVigilancia }) {
  const linhas: [string, string][] = [
    ['Saindo de', v.origens.join(', ')],
    ['Indo para', v.destinos.join(', ')],
    ['Ida', janela(v.idaDe, v.idaAte)],
    ['Volta', v.voltaDe && v.voltaAte ? janela(v.voltaDe, v.voltaAte) : 'só ida'],
    ['Passageiros', plural(v.adultos, 'adulto', 'adultos')],
    ['Mala despachada', v.malasDespachadas ? plural(v.malasDespachadas, 'por pessoa', 'por pessoa') : 'não'],
    ['Escalas', v.maxEscalas === null ? 'qualquer' : v.maxEscalas === 0 ? 'só voo direto' : `até ${v.maxEscalas}`],
    ['Companhias', v.companhias.length ? v.companhias.join(', ') : 'qualquer'],
    ['Preço-alvo', v.precoAlvoCentavos !== null ? `até ${formatarReais(v.precoAlvoCentavos)} no total` : 'sem alvo: avisa o que fugir do normal'],
    ['Checagem', `a cada ${v.intervaloMinutos} min`],
  ];
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
      {linhas.map(([rotulo, valor]) => (
        <div key={rotulo} className="flex flex-col">
          <dt className="text-[var(--color-texto-suave)]">{rotulo}</dt>
          <dd className="font-medium">{valor}</dd>
        </div>
      ))}
    </dl>
  );
}
