import Link from 'next/link';
import { TelaVazia } from '@/components/TelaVazia';

export default function Ofertas() {
  return (
    <TelaVazia
      titulo="Ofertas"
      descricao="Nenhuma oferta ainda. Quando o Frank achar um preço muito abaixo do normal numa rota vigiada, ela aparece aqui, com onde comprar."
    >
      <Link
        href="/rotas"
        className="mt-6 inline-flex min-h-11 items-center rounded-lg bg-[var(--color-destaque)] px-5 text-base font-medium text-white"
      >
        Vigiar uma rota
      </Link>
    </TelaVazia>
  );
}
