import { useEffect, useState } from "react";
import Database from "@tauri-apps/plugin-sql";
import "./App.css";

type Tela = "livros" | "pessoas";

type Livro = {
  codigo: string;
  titulo: string;
  autor: string;
  disponivel: boolean;
};

type LivroBanco = {
  codigo: string;
  titulo: string;
  autor: string;
  disponivel: number;
};

type Pessoa = {
  id: number;
  nome: string;
  telefone: string;
  observacao: string;
};

async function iniciarBanco() {
  const db = await Database.load("sqlite:biblioteca.db");

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

  return db;
}

function App() {
  const [tela, setTela] = useState<Tela>("livros");

  const [livros, setLivros] = useState<Livro[]>([]);
  const [pesquisa, setPesquisa] = useState("");

  const [mostrarCadastroLivro, setMostrarCadastroLivro] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [titulo, setTitulo] = useState("");
  const [autor, setAutor] = useState("");
  const [codigoOriginal, setCodigoOriginal] = useState<string | null>(null);

  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [mostrarCadastroPessoa, setMostrarCadastroPessoa] = useState(false);
  const [nomePessoa, setNomePessoa] = useState("");
  const [telefonePessoa, setTelefonePessoa] = useState("");
  const [observacaoPessoa, setObservacaoPessoa] = useState("");

  const editandoLivro = codigoOriginal !== null;

  async function carregarLivros() {
    try {
      const db = await Database.load("sqlite:biblioteca.db");

      const registros = await db.select<LivroBanco[]>(`
        SELECT codigo, titulo, autor, disponivel
        FROM livros
        ORDER BY titulo
      `);

      setLivros(
        registros.map((livro) => ({
          codigo: livro.codigo,
          titulo: livro.titulo,
          autor: livro.autor,
          disponivel: livro.disponivel === 1,
        }))
      );
    } catch (erro) {
      console.error("Erro ao carregar livros:", erro);
    }
  }

  async function carregarPessoas() {
    try {
      const db = await Database.load("sqlite:biblioteca.db");

      const registros = await db.select<Pessoa[]>(`
        SELECT id, nome, telefone, observacao
        FROM pessoas
        ORDER BY nome
      `);

      setPessoas(registros);
    } catch (erro) {
      console.error("Erro ao carregar pessoas:", erro);
    }
  }

  useEffect(() => {
    async function prepararBanco() {
      try {
        await iniciarBanco();
        await carregarLivros();
        await carregarPessoas();
      } catch (erro) {
        console.error("Erro ao iniciar banco de dados:", erro);
      }
    }

    prepararBanco();
  }, []);

  function limparFormularioLivro() {
    setCodigo("");
    setTitulo("");
    setAutor("");
    setCodigoOriginal(null);
  }

  function fecharFormularioLivro() {
    limparFormularioLivro();
    setMostrarCadastroLivro(false);
  }

  function abrirNovoLivro() {
    limparFormularioLivro();
    setMostrarCadastroLivro(true);
  }

  function abrirEdicaoLivro(livro: Livro) {
    setCodigoOriginal(livro.codigo);
    setCodigo(livro.codigo);
    setTitulo(livro.titulo);
    setAutor(livro.autor);
    setMostrarCadastroLivro(true);
  }

  async function salvarLivro() {
    if (!codigo.trim() || !titulo.trim() || !autor.trim()) {
      alert("Preencha código, título e autor.");
      return;
    }

    try {
      const db = await Database.load("sqlite:biblioteca.db");

      if (editandoLivro) {
        await db.execute(
          `
            UPDATE livros
            SET codigo = $1, titulo = $2, autor = $3
            WHERE codigo = $4
          `,
          [codigo.trim(), titulo.trim(), autor.trim(), codigoOriginal]
        );
      } else {
        await db.execute(
          `
            INSERT INTO livros (codigo, titulo, autor, disponivel)
            VALUES ($1, $2, $3, 1)
          `,
          [codigo.trim(), titulo.trim(), autor.trim()]
        );
      }

      fecharFormularioLivro();
      await carregarLivros();
    } catch (erro) {
      console.error("Erro ao salvar livro:", erro);

      alert(
        "Não foi possível salvar o livro. Verifique se o código já está sendo utilizado."
      );
    }
  }

  function limparFormularioPessoa() {
    setNomePessoa("");
    setTelefonePessoa("");
    setObservacaoPessoa("");
  }

  function fecharFormularioPessoa() {
    limparFormularioPessoa();
    setMostrarCadastroPessoa(false);
  }

  async function salvarPessoa() {
    if (!nomePessoa.trim()) {
      alert("Informe o nome da pessoa.");
      return;
    }

    try {
      const db = await Database.load("sqlite:biblioteca.db");

      await db.execute(
        `
          INSERT INTO pessoas (nome, telefone, observacao)
          VALUES ($1, $2, $3)
        `,
        [
          nomePessoa.trim(),
          telefonePessoa.trim(),
          observacaoPessoa.trim(),
        ]
      );

      fecharFormularioPessoa();
      await carregarPessoas();
    } catch (erro) {
      console.error("Erro ao cadastrar pessoa:", erro);
      alert("Não foi possível cadastrar a pessoa.");
    }
  }

  const termoPesquisa = pesquisa.trim().toLowerCase();

  const livrosFiltrados = livros.filter((livro) => {
    if (!termoPesquisa) return true;

    return (
      livro.titulo.toLowerCase().includes(termoPesquisa) ||
      livro.autor.toLowerCase().includes(termoPesquisa) ||
      livro.codigo.toLowerCase().includes(termoPesquisa)
    );
  });

  return (
    <div className="app">
      <header className="topo">
        <div>
          <h1>Biblioteca Espírita</h1>
          <p>Controle de acervo e empréstimos</p>
        </div>
      </header>

      <main className="conteudo">
        {tela === "livros" && (
          <>
            <section className="acoes">
              <button onClick={abrirNovoLivro}>+ Cadastrar livro</button>
              <button>+ Novo empréstimo</button>
            </section>

            {mostrarCadastroLivro && (
              <section className="formulario">
                <div className="formulario-topo">
                  <h2>
                    {editandoLivro ? "Editar livro" : "Cadastrar livro"}
                  </h2>

                  <button
                    className="fechar"
                    onClick={fecharFormularioLivro}
                  >
                    ×
                  </button>
                </div>

                <div className="campos">
                  <label>
                    Código
                    <input
                      value={codigo}
                      onChange={(e) => setCodigo(e.target.value)}
                      placeholder="Ex.: 003"
                    />
                  </label>

                  <label>
                    Título
                    <input
                      value={titulo}
                      onChange={(e) => setTitulo(e.target.value)}
                      placeholder="Nome do livro"
                    />
                  </label>

                  <label>
                    Autor
                    <input
                      value={autor}
                      onChange={(e) => setAutor(e.target.value)}
                      placeholder="Nome do autor"
                    />
                  </label>
                </div>

                <div className="formulario-acoes">
                  <button
                    className="cancelar"
                    onClick={fecharFormularioLivro}
                  >
                    Cancelar
                  </button>

                  <button onClick={salvarLivro}>
                    {editandoLivro ? "Salvar alterações" : "Salvar livro"}
                  </button>
                </div>
              </section>
            )}

            <section className="pesquisa">
              <input
                type="text"
                value={pesquisa}
                onChange={(e) => setPesquisa(e.target.value)}
                placeholder="Pesquisar por código, título ou autor..."
              />
            </section>

            <section className="painel">
              <h2>Acervo</h2>

              <table>
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Livro</th>
                    <th>Autor</th>
                    <th>Situação</th>
                    <th>Ações</th>
                  </tr>
                </thead>

                <tbody>
                  {livrosFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan={5}>
                        {pesquisa.trim()
                          ? "Nenhum livro encontrado."
                          : "Nenhum livro cadastrado."}
                      </td>
                    </tr>
                  ) : (
                    livrosFiltrados.map((livro) => (
                      <tr key={livro.codigo}>
                        <td>{livro.codigo}</td>
                        <td>{livro.titulo}</td>
                        <td>{livro.autor}</td>
                        <td>
                          <span
                            className={
                              livro.disponivel
                                ? "disponivel"
                                : "emprestado"
                            }
                          >
                            {livro.disponivel
                              ? "Disponível"
                              : "Emprestado"}
                          </span>
                        </td>

                        <td>
                          <button
                            className="botao-editar"
                            onClick={() => abrirEdicaoLivro(livro)}
                          >
                            Editar
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </section>
          </>
        )}

        {tela === "pessoas" && (
          <>
            <section className="acoes">
              <button onClick={() => setMostrarCadastroPessoa(true)}>
                + Cadastrar pessoa
              </button>
            </section>

            {mostrarCadastroPessoa && (
              <section className="formulario">
                <div className="formulario-topo">
                  <h2>Cadastrar pessoa</h2>

                  <button
                    className="fechar"
                    onClick={fecharFormularioPessoa}
                  >
                    ×
                  </button>
                </div>

                <div className="campos">
                  <label>
                    Nome
                    <input
                      value={nomePessoa}
                      onChange={(e) => setNomePessoa(e.target.value)}
                      placeholder="Nome completo"
                    />
                  </label>

                  <label>
                    Telefone
                    <input
                      value={telefonePessoa}
                      onChange={(e) => setTelefonePessoa(e.target.value)}
                      placeholder="Telefone"
                    />
                  </label>

                  <label>
                    Observação
                    <input
                      value={observacaoPessoa}
                      onChange={(e) => setObservacaoPessoa(e.target.value)}
                      placeholder="Opcional"
                    />
                  </label>
                </div>

                <div className="formulario-acoes">
                  <button
                    className="cancelar"
                    onClick={fecharFormularioPessoa}
                  >
                    Cancelar
                  </button>

                  <button onClick={salvarPessoa}>Salvar pessoa</button>
                </div>
              </section>
            )}

            <section className="painel">
              <h2>Pessoas</h2>

              <table>
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Telefone</th>
                    <th>Observação</th>
                  </tr>
                </thead>

                <tbody>
                  {pessoas.length === 0 ? (
                    <tr>
                      <td colSpan={3}>Nenhuma pessoa cadastrada.</td>
                    </tr>
                  ) : (
                    pessoas.map((pessoa) => (
                      <tr key={pessoa.id}>
                        <td>{pessoa.nome}</td>
                        <td>{pessoa.telefone || "—"}</td>
                        <td>{pessoa.observacao || "—"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </section>
          </>
        )}
      </main>

      <nav className="menu">
        <button onClick={() => setTela("livros")}>Livros</button>
        <button>Empréstimos</button>
        <button onClick={() => setTela("pessoas")}>Pessoas</button>
        <button>Backup</button>
      </nav>
    </div>
  );
}

export default App;