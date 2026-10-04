import Database from "@tauri-apps/plugin-sql";

export async function obterBanco() {
  return await Database.load("sqlite:biblioteca.db");
}

export async function iniciarBanco() {
  const db = await obterBanco();

  await db.execute(`
    CREATE TABLE IF NOT EXISTS livros (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      codigo TEXT NOT NULL UNIQUE,
      titulo TEXT NOT NULL,
      autor TEXT NOT NULL,
      disponivel INTEGER NOT NULL DEFAULT 1
    )
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

  return db;
}