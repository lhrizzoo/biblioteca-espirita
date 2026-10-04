import { useEffect, useState } from "react";
import Database from "@tauri-apps/plugin-sql";
import "./App.css";

type Livro = {
  codigo: string;
  titulo: string;
  autor: string;
  disponivel: boolean;
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
  useEffect(() => {
    async function prepararBanco() {
      try {
        await iniciarBanco();
        console.log("Banco de dados iniciado com sucesso.");
      } catch (erro) {
        console.error("Erro ao iniciar banco de dados:", erro);
      }
    }

    prepararBanco();
  }, []);
  const [mostrarCadastro, setMostrarCadastro] = useState(false);

  const [livros, setLivros] = useState<Livro[]>([
    {
      codigo: "001",
      titulo: "Nosso Lar",
      autor: "Chico Xavier",
      disponivel: true,
    },
    {
      codigo: "002",
      titulo: "O Livro dos Espíritos",
      autor: "Allan Kardec",
      disponivel: false,
    },
  ]);

  const [codigo, setCodigo] = useState("");
  const [titulo, setTitulo] = useState("");
  const [autor, setAutor] = useState("");

  function cadastrarLivro() {
    if (!codigo.trim() || !titulo.trim() || !autor.trim()) {
      alert("Preencha código, título e autor.");
      return;
    }

    const novoLivro: Livro = {
      codigo: codigo.trim(),
      titulo: titulo.trim(),
      autor: autor.trim(),
      disponivel: true,
    };

    setLivros([...livros, novoLivro]);

    setCodigo("");
    setTitulo("");
    setAutor("");
    setMostrarCadastro(false);
  }

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
          <button onClick={() => setMostrarCadastro(true)}>
            + Cadastrar livro
          </button>

          <button>+ Novo empréstimo</button>
        </section>

        {mostrarCadastro && (
          <section className="formulario">
            <div className="formulario-topo">
              <h2>Cadastrar livro</h2>

              <button
                className="fechar"
                onClick={() => setMostrarCadastro(false)}
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
                onClick={() => setMostrarCadastro(false)}
              >
                Cancelar
              </button>

              <button onClick={cadastrarLivro}>Salvar livro</button>
            </div>
          </section>
        )}

        <section className="pesquisa">
          <input
            type="text"
            placeholder="Pesquisar livro por título ou autor..."
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
              </tr>
            </thead>

            <tbody>
              {livros.map((livro) => (
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
                </tr>
              ))}
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