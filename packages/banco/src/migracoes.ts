/**
 * Migracoes em ordem. A posicao no array e a versao (PRAGMA user_version).
 * Regra (revisor-de-dados): migracao nunca apaga historico de preco. Mudanca nova = item novo
 * no fim do array; um item ja publicado em versao usada por alguem nunca e editado.
 * (O item 1 foi revisado antes de qualquer uso, na propria issue #3.)
 */
export const MIGRACOES: readonly string[] = [
  // 1 — esquema inicial (issue #3)
  `
  CREATE TABLE vigilancias (
    id TEXT PRIMARY KEY,
    descricao TEXT NOT NULL,
    origens TEXT NOT NULL,
    destinos TEXT NOT NULL,
    ida_de TEXT NOT NULL,
    ida_ate TEXT NOT NULL,
    volta_de TEXT,
    volta_ate TEXT,
    adultos INTEGER NOT NULL,
    malas_despachadas INTEGER NOT NULL,
    max_escalas INTEGER,
    companhias TEXT NOT NULL,
    aceitar_passagens_separadas INTEGER NOT NULL,
    preco_alvo_centavos INTEGER,
    moeda TEXT NOT NULL,
    intervalo_minutos INTEGER NOT NULL,
    ativa INTEGER NOT NULL DEFAULT 1,
    criada_em TEXT NOT NULL,
    atualizada_em TEXT NOT NULL,
    -- Precos vistos antes deste instante nao contam para o preco normal: a rota, as datas ou os
    -- filtros mudaram e o historico antigo e de outra viagem.
    historico_desde TEXT NOT NULL
  );

  -- Uma rodada = todas as buscas de uma vigilancia num mesmo ciclo do vigia (varias companhias,
  -- aeroportos e fontes). O preco normal usa o menor preco de cada rodada.
  CREATE TABLE precos_vistos (
    id INTEGER PRIMARY KEY,
    vigilancia_id TEXT NOT NULL REFERENCES vigilancias(id) ON DELETE CASCADE,
    rodada TEXT NOT NULL,
    fonte TEXT NOT NULL,
    id_na_fonte TEXT NOT NULL,
    visto_em TEXT NOT NULL,
    preco_centavos INTEGER NOT NULL CHECK (preco_centavos >= 0),
    moeda TEXT NOT NULL,
    itinerario TEXT NOT NULL
  );
  CREATE INDEX precos_vistos_por_vigilancia ON precos_vistos(vigilancia_id, visto_em);
  CREATE INDEX precos_vistos_por_rodada ON precos_vistos(vigilancia_id, rodada);

  CREATE TABLE referencias_preco (
    id INTEGER PRIMARY KEY,
    vigilancia_id TEXT NOT NULL REFERENCES vigilancias(id) ON DELETE CASCADE,
    fonte TEXT NOT NULL,
    dia TEXT NOT NULL,
    preco_centavos INTEGER NOT NULL CHECK (preco_centavos >= 0),
    moeda TEXT NOT NULL,
    buscado_em TEXT NOT NULL,
    UNIQUE (vigilancia_id, fonte, dia)
  );

  CREATE TABLE ofertas (
    id INTEGER PRIMARY KEY,
    vigilancia_id TEXT NOT NULL REFERENCES vigilancias(id) ON DELETE CASCADE,
    preco_visto_id INTEGER NOT NULL REFERENCES precos_vistos(id) ON DELETE CASCADE,
    preco_final_centavos INTEGER NOT NULL CHECK (preco_final_centavos >= 0),
    moeda TEXT NOT NULL,
    preco_normal_centavos INTEGER,
    percentual_abaixo INTEGER,
    motivos TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('detectada', 'avaliada', 'sem_avaliacao', 'descartada')),
    avaliacao TEXT,
    detectada_em TEXT NOT NULL,
    reconferida_em TEXT
  );
  CREATE INDEX ofertas_por_status ON ofertas(status, detectada_em);
  CREATE INDEX ofertas_por_vigilancia ON ofertas(vigilancia_id);
  CREATE INDEX ofertas_por_preco_visto ON ofertas(preco_visto_id);

  CREATE TABLE opcoes_compra (
    id INTEGER PRIMARY KEY,
    oferta_id INTEGER NOT NULL REFERENCES ofertas(id) ON DELETE CASCADE,
    vendedor TEXT NOT NULL,
    preco_centavos INTEGER NOT NULL CHECK (preco_centavos >= 0),
    moeda TEXT NOT NULL,
    estrangeiro INTEGER NOT NULL,
    link TEXT
  );
  CREATE INDEX opcoes_compra_por_oferta ON opcoes_compra(oferta_id);

  -- O alerta guarda o proprio itinerario e moeda: o "ja avisado" (RF-16) nao depende de
  -- ofertas nem de precos_vistos continuarem existindo.
  CREATE TABLE alertas (
    id INTEGER PRIMARY KEY,
    vigilancia_id TEXT NOT NULL REFERENCES vigilancias(id) ON DELETE CASCADE,
    oferta_id INTEGER REFERENCES ofertas(id) ON DELETE SET NULL,
    fonte TEXT NOT NULL,
    id_na_fonte TEXT NOT NULL,
    canal TEXT NOT NULL,
    enviado_em TEXT NOT NULL,
    preco_centavos INTEGER NOT NULL CHECK (preco_centavos >= 0),
    moeda TEXT NOT NULL,
    sucesso INTEGER NOT NULL,
    erro TEXT
  );
  CREATE INDEX alertas_por_itinerario ON alertas(vigilancia_id, fonte, id_na_fonte);
  CREATE INDEX alertas_por_oferta ON alertas(oferta_id);

  CREATE TABLE placar (
    id INTEGER PRIMARY KEY,
    vigilancia_id TEXT NOT NULL REFERENCES vigilancias(id) ON DELETE CASCADE,
    quem TEXT NOT NULL CHECK (quem IN ('frank', 'google')),
    visto_em TEXT NOT NULL,
    preco_centavos INTEGER NOT NULL CHECK (preco_centavos >= 0),
    moeda TEXT NOT NULL,
    confirmado INTEGER NOT NULL,
    observacao TEXT
  );
  CREATE INDEX placar_por_vigilancia ON placar(vigilancia_id, visto_em);

  CREATE TABLE consultas_fonte (
    id INTEGER PRIMARY KEY,
    fonte TEXT NOT NULL,
    em TEXT NOT NULL,
    sucesso INTEGER NOT NULL,
    erro TEXT
  );
  CREATE INDEX consultas_fonte_por_fonte ON consultas_fonte(fonte, em);
  `,
];
