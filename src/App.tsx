import { useEffect, useState } from "react";
import Database from "@tauri-apps/plugin-sql";
import "./App.css";

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

  return db;
}

function App() {
  const [mostrarCadastro, setMostrarCadastro] = useState(false);
  const [livros, setLivros] = useState<Livro[]>([]);
  const [pesquisa, setPesquisa] = useState("");

  const [codigo, setCodigo] = useState("");
  const [titulo, setTitulo] = useState("");
  const [autor, setAutor] = useState("");

  const [codigoOriginal, setCodigoOriginal] = useState<string | null>(null);

  const editando = codigoOriginal !== null;

  async function carregarLivros() {
    try {
      const db = await Database.load("sqlite:biblioteca.db");

      const registros = await db.select<LivroBanco[]>(`
        SELECT codigo, titulo, autor, disponivel
        FROM livros
        ORDER BY titulo
      `);

      const livrosCarregados: Livro[] = registros.map((livro) => ({
        codigo: livro.codigo,
        titulo: livro.titulo,
        autor: livro.autor,
        disponivel: livro.disponivel === 1,
      }));

      setLivros(livrosCarregados);
    } catch (erro) {
      console.error("Erro ao carregar livros:", erro);
    }
  }

  useEffect(() => {
    async function prepararBanco() {
      try {
        await iniciarBanco();
        await carregarLivros();
      } catch (erro) {
        console.error("Erro ao iniciar banco de dados:", erro);
      }
    }

    prepararBanco();
  }, []);

  function limparFormulario() {
    setCodigo("");
    setTitulo("");
    setAutor("");
    setCodigoOriginal(null);
  }

  function fecharFormulario() {
    limparFormulario();
    setMostrarCadastro(false);
  }

  function abrirNovoLivro() {
    limparFormulario();
    setMostrarCadastro(true);
  }

  function abrirEdicao(livro: Livro) {
    setCodigoOriginal(livro.codigo);
    setCodigo(livro.codigo);
    setTitulo(livro.titulo);
    setAutor(livro.autor);
    setMostrarCadastro(true);
  }

  async function salvarLivro() {
    if (!codigo.trim() || !titulo.trim() || !autor.trim()) {
      alert("Preencha código, título e autor.");
      return;
    }

    try {
      const db = await Database.load("sqlite:biblioteca.db");

      if (editando) {
        await db.execute(
          `
            UPDATE livros
            SET codigo = $1, titulo = $2, autor = $3
            WHERE codigo = $4
          `,
          [
            codigo.trim(),
            titulo.trim(),
            autor.trim(),
            codigoOriginal,
          ]
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

      fecharFormulario();
      await carregarLivros();
    } catch (erro) {
      console.error("Erro ao salvar livro:", erro);

      alert(
        "Não foi possível salvar o livro. Verifique se o código já está sendo utilizado."
      );
    }
  }

  const termoPesquisa = pesquisa.trim().toLowerCase();

  const livrosFiltrados = livros.filter((livro) => {
    if (!termoPesquisa) {
      return true;
    }

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
        <section className="acoes">
          <button onClick={abrirNovoLivro}>+ Cadastrar livro</button>
          <button>+ Novo empréstimo</button>
        </section>

        {mostrarCadastro && (
          <section className="formulario">
            <div className="formulario-topo">
              <h2>{editando ? "Editar livro" : "Cadastrar livro"}</h2>

              <button className="fechar" onClick={fecharFormulario}>
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
              <button className="cancelar" onClick={fecharFormulario}>
                Cancelar
              </button>

              <button onClick={salvarLivro}>
                {editando ? "Salvar alterações" : "Salvar livro"}
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
                          livro.disponivel ? "disponivel" : "emprestado"
                        }
                      >
                        {livro.disponivel ? "Disponível" : "Emprestado"}
                      </span>
                    </td>

                    <td>
                      <button
                        className="botao-editar"
                        onClick={() => abrirEdicao(livro)}
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
      </main>

      <nav className="menu">
        <button>Livros</button>
        <button>Empréstimos</button>
        <button>Pessoas</button>
        <button>Backup</button>
      </nav>
    </div>
  );
}

export default App;