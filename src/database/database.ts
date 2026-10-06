import Database from "@tauri-apps/plugin-sql";

export async function obterBanco() {
  return await Database.load("sqlite:biblioteca.db");
}

async function colunaExiste(
  db: Awaited<ReturnType<typeof obterBanco>>,
  tabela: string,
  coluna: string
) {
  const colunas = await db.select<{ name: string }[]>(
    `PRAGMA table_info(${tabela})`
  );

  return colunas.some((item) => item.name === coluna);
}

async function tabelaExiste(
  db: Awaited<ReturnType<typeof obterBanco>>,
  tabela: string
) {
  const resultado = await db.select<{ name: string }[]>(
    `
      SELECT name
      FROM sqlite_master
      WHERE type = 'table'
        AND name = $1
      LIMIT 1
    `,
    [tabela]
  );

  return resultado.length > 0;
}

async function adicionarColunaSeNecessario(
  db: Awaited<ReturnType<typeof obterBanco>>,
  tabela: string,
  coluna: string,
  definicao: string
) {
  const existe = await colunaExiste(db, tabela, coluna);

  if (!existe) {
    await db.execute(
      `ALTER TABLE ${tabela} ADD COLUMN ${coluna} ${definicao}`
    );
  }
}

export async function bancoPossuiDados() {
  const db = await obterBanco();

  const possuiLivros = await tabelaExiste(db, "livros");
  const possuiPessoas = await tabelaExiste(db, "pessoas");
  const possuiEmprestimos = await tabelaExiste(
    db,
    "emprestimos"
  );

  if (!possuiLivros && !possuiPessoas && !possuiEmprestimos) {
    return false;
  }

  let totalRegistros = 0;

  if (possuiLivros) {
    const resultado = await db.select<{ total: number }[]>(
      `SELECT COUNT(*) AS total FROM livros`
    );

    totalRegistros += Number(resultado[0]?.total ?? 0);
  }

  if (possuiPessoas) {
    const resultado = await db.select<{ total: number }[]>(
      `SELECT COUNT(*) AS total FROM pessoas`
    );

    totalRegistros += Number(resultado[0]?.total ?? 0);
  }

  if (possuiEmprestimos) {
    const resultado = await db.select<{ total: number }[]>(
      `SELECT COUNT(*) AS total FROM emprestimos`
    );

    totalRegistros += Number(resultado[0]?.total ?? 0);
  }

  return totalRegistros > 0;
}

export async function iniciarBanco() {
  const db = await obterBanco();

  await db.execute(`
    CREATE TABLE IF NOT EXISTS livros (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      codigo TEXT NOT NULL UNIQUE,
      codigo_barras TEXT,
      titulo TEXT NOT NULL,
      autor TEXT NOT NULL,
      espirito TEXT NOT NULL DEFAULT '',
      medium TEXT NOT NULL DEFAULT '',
      editora TEXT NOT NULL DEFAULT '',
      observacao TEXT NOT NULL DEFAULT '',
      quantidade_total INTEGER NOT NULL DEFAULT 1,
      disponivel INTEGER NOT NULL DEFAULT 1,
      ativo INTEGER NOT NULL DEFAULT 1
    )
  `);

  await adicionarColunaSeNecessario(
    db,
    "livros",
    "codigo_barras",
    "TEXT"
  );

  await adicionarColunaSeNecessario(
    db,
    "livros",
    "espirito",
    "TEXT NOT NULL DEFAULT ''"
  );

  await adicionarColunaSeNecessario(
    db,
    "livros",
    "medium",
    "TEXT NOT NULL DEFAULT ''"
  );

  await adicionarColunaSeNecessario(
    db,
    "livros",
    "editora",
    "TEXT NOT NULL DEFAULT ''"
  );

  await adicionarColunaSeNecessario(
    db,
    "livros",
    "observacao",
    "TEXT NOT NULL DEFAULT ''"
  );

  await adicionarColunaSeNecessario(
    db,
    "livros",
    "quantidade_total",
    "INTEGER NOT NULL DEFAULT 1"
  );

  await adicionarColunaSeNecessario(
    db,
    "livros",
    "ativo",
    "INTEGER NOT NULL DEFAULT 1"
  );

  await db.execute(`
    UPDATE livros
    SET quantidade_total = 1
    WHERE quantidade_total IS NULL
       OR quantidade_total < 1
  `);

  await db.execute(`
    UPDATE livros
    SET ativo = 1
    WHERE ativo IS NULL
  `);

  await db.execute(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_livros_codigo_barras_unico
    ON livros(codigo_barras)
    WHERE codigo_barras IS NOT NULL
      AND TRIM(codigo_barras) <> ''
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS pessoas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      telefone TEXT NOT NULL DEFAULT '',
      observacao TEXT NOT NULL DEFAULT ''
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS emprestimos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pessoa_id INTEGER NOT NULL,
      livro_codigo TEXT NOT NULL,
      data_emprestimo TEXT NOT NULL,
      data_prevista TEXT NOT NULL,
      data_devolucao TEXT,
      FOREIGN KEY (pessoa_id) REFERENCES pessoas(id),
      FOREIGN KEY (livro_codigo) REFERENCES livros(codigo)
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS configuracoes (
      chave TEXT PRIMARY KEY,
      valor TEXT NOT NULL
    )
  `);

  return db;
}