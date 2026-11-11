import { CONFIGURACOES, lerConfiguracaoNumero } from '@frank/banco';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { FormConfiguracoes } from '@/components/configuracoes/FormConfiguracoes';
import { haQuanto } from '@/lib/formatar';
import { hostLocal } from '@/lib/servidor/origem';
import { banco } from '@/lib/servidor/recursos';
import { montarStatus } from '@/lib/status';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function Secao({ id, titulo, children }: { id?: string; titulo: string; children: ReactNode }) {
  return (
    <section
      id={id}
      aria-label={titulo}
      className="scroll-mt-6 border-t border-[var(--color-borda)] pt-6"
    >
      <h2 className="text-lg font-semibold">{titulo}</h2>
      {children}
    </section>
  );
}

function Canal({ nome, pronto }: { nome: string; pronto: boolean }) {
  return (
    <li className="flex items-center gap-2">
      <span
        aria-hidden
        className={`inline-block h-2 w-2 rounded-full ${pronto ? 'bg-[var(--color-ok)]' : 'bg-[var(--color-borda)]'}`}
      />
      {nome}: {pronto ? 'configurado' : 'não configurado'}
    </li>
  );
}

const codigo = 'rounded bg-[var(--color-superficie)] px-1.5 py-0.5 text-[0.9em] break-all';

/** Configuracoes e estado do Frank (RF-19). Segredos ficam no .env: a tela so diz se existem. */
export default async function Configuracoes() {
  if (!hostLocal(await headers())) notFound();
  const db = banco();
  const s = montarStatus(db);
  const inicial = {
    toleranciaPct: lerConfiguracaoNumero(db, CONFIGURACOES.toleranciaCompanhiaPct),
    silencioInicio: lerConfiguracaoNumero(db, CONFIGURACOES.silencioInicio),
    silencioFim: lerConfiguracaoNumero(db, CONFIGURACOES.silencioFim),
  };

  return (
    <main className="mx-auto w-full max-w-5xl space-y-8 px-4 py-8 md:px-8 md:py-12">
      <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Configurações</h1>

      <Secao id="status" titulo="Como o Frank está">
        <ul className="mt-3 space-y-1 text-sm">
          <li>
            Vigia:{' '}
            {s.vigia.estado === 'ligado'
              ? `ligado (sinal ${haQuanto(s.vigia.vistoEm ?? '')})`
              : s.vigia.estado === 'parado'
                ? `parado: último sinal ${haQuanto(s.vigia.vistoEm ?? '')}`
                : 'ainda não rodou'}
          </li>
          <li>
            Última checagem: {s.ultimaChecagemEm ? haQuanto(s.ultimaChecagemEm) : 'nenhuma ainda'}
          </li>
          <li>Claude: {s.claudeDisponivel ? 'disponível' : 'indisponível (veja abaixo)'}</li>
        </ul>
        {s.problemas.length > 0 ? (
          <ul className="mt-4 space-y-2">
            {s.problemas.map((p) => (
              <li
                key={p.id}
                className="rounded-lg border border-[var(--color-aviso)] p-3 text-sm break-words"
              >
                {p.texto}
                <span className="block text-xs text-[var(--color-texto-suave)]">
                  {haQuanto(p.desde)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-[var(--color-texto-suave)]">
            Nenhum problema registrado.
          </p>
        )}
      </Secao>

      <Secao titulo="Ajustes">
        <div className="mt-4">
          <FormConfiguracoes inicial={inicial} />
        </div>
      </Secao>

      <Secao id="avisos" titulo="Avisos">
        <ul className="mt-3 space-y-1 text-sm">
          <Canal nome="E-mail" pronto={s.canais.email} />
          <Canal nome="Telegram (opcional)" pronto={s.canais.telegram} />
        </ul>
        <p className="mt-3 max-w-prose text-sm text-[var(--color-texto-suave)]">
          Senhas e tokens ficam só no arquivo <code className={codigo}>.env</code> na pasta do
          Frank, nunca no painel. Depois de mudar o arquivo, reinicie o Frank e teste com{' '}
          <code className={codigo}>pnpm --filter @frank/vigia testar-aviso</code>.
        </p>

        <details className="mt-4">
          <summary className="min-h-11 cursor-pointer py-2 text-sm font-medium">
            Configurar o e-mail (Gmail)
          </summary>
          <ol className="mt-2 max-w-prose list-decimal space-y-1 pl-5 text-sm">
            <li>Na sua conta Google, ative a verificação em duas etapas.</li>
            <li>
              Crie uma senha de app em{' '}
              <span className="font-medium">Conta Google → Segurança → Senhas de app</span>.
            </li>
            <li>
              No <code className={codigo}>.env</code>:{' '}
              <code className={codigo}>SMTP_HOST=smtp.gmail.com</code>,{' '}
              <code className={codigo}>SMTP_USUARIO</code> e{' '}
              <code className={codigo}>ALERTA_EMAIL_PARA</code> com o seu e-mail, e{' '}
              <code className={codigo}>SMTP_SENHA</code> com a senha de app, sem espaços.
            </li>
          </ol>
        </details>

        <details className="mt-1">
          <summary className="min-h-11 cursor-pointer py-2 text-sm font-medium">
            Configurar o Telegram (grátis)
          </summary>
          <ol className="mt-2 max-w-prose list-decimal space-y-1 pl-5 text-sm">
            <li>
              No Telegram, abra uma conversa com <span className="font-medium">@BotFather</span>,
              mande <code className={codigo}>/newbot</code> e escolha um nome. Ele responde com o
              token do bot.
            </li>
            <li>
              Ponha o token no <code className={codigo}>.env</code> em{' '}
              <code className={codigo}>TELEGRAM_BOT_TOKEN</code>.
            </li>
            <li>Abra a conversa com o seu bot novo e mande qualquer mensagem (ex.: “oi”).</li>
            <li>
              No navegador, abra{' '}
              <code className={codigo}>
                https://api.telegram.org/bot&lt;SEU_TOKEN&gt;/getUpdates
              </code>{' '}
              trocando <code className={codigo}>&lt;SEU_TOKEN&gt;</code> pelo token. Procure{' '}
              <code className={codigo}>&quot;chat&quot;:{'{'}&quot;id&quot;:</code>: o número logo
              depois é o chat.
            </li>
            <li>
              Ponha esse número em <code className={codigo}>TELEGRAM_CHAT_ID</code>, reinicie o
              Frank e teste.
            </li>
          </ol>
          <p className="mt-2 max-w-prose text-xs text-[var(--color-texto-suave)]">
            O token dá controle do bot: não compartilhe nem cole em conversa nenhuma.
          </p>
        </details>
      </Secao>

      <Secao titulo="Frequência e preço-alvo">
        <p className="mt-2 max-w-prose text-sm text-[var(--color-texto-suave)]">
          São de cada rota: escreva no pedido (“até R$ 900”, “checar a cada 2 horas”) ou edite a
          rota em Rotas vigiadas. Sem frequência no pedido, o Frank checa a cada hora.
        </p>
      </Secao>
    </main>
  );
}
