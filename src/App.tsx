import { useEffect, useState } from "react";
import "./App.css";

import { iniciarBanco } from "./database/database";
import type { Tela } from "./types";

import Livros from "./pages/Livros";
import Emprestimos from "./pages/Emprestimos";
import Pessoas from "./pages/Pessoas";
import Backup from "./pages/Backup";

function App() {
  const [tela, setTela] = useState<Tela>("livros");
  const [bancoPronto, setBancoPronto] = useState(false);

  useEffect(() => {
    async function prepararSistema() {
      try {
        await iniciarBanco();
        setBancoPronto(true);
      } catch (erro) {
        console.error("Erro ao iniciar banco de dados:", erro);
      }
    }

    prepararSistema();
  }, []);

  if (!bancoPronto) {
    return (
      <div className="carregando">
        <div className="carregando-conteudo">
          <div className="marca-simbolo">BE</div>

          <div>
            <strong>Biblioteca Espírita</strong>
            <p>Carregando o sistema...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="topo">
        <div className="topo-conteudo">
          <div className="marca">
            <div className="marca-simbolo">BE</div>

            <div className="marca-texto">
              <h1>Biblioteca Espírita</h1>
              <p>Controle de acervo e empréstimos</p>
            </div>
          </div>
        </div>
      </header>

      <div className="corpo-app">
        <main className={`conteudo conteudo-${tela}`}>
          {tela === "livros" && <Livros />}
          {tela === "emprestimos" && <Emprestimos />}
          {tela === "pessoas" && <Pessoas />}
          {tela === "backup" && <Backup />}
        </main>

        <footer className="rodape">
          <div className="rodape-conteudo">
            <span className="rodape-titulo">
              Biblioteca Espírita
            </span>

            <span className="rodape-separador">•</span>

            <span className="rodape-texto">
              Distribuído gratuitamente pelo Centro Espírita Dias da Cruz,
              Passo Fundo, Rio Grande do Sul.
            </span>
          </div>
        </footer>
      </div>

      <nav className="menu">
        <button
          className={tela === "livros" ? "menu-ativo" : ""}
          onClick={() => setTela("livros")}
        >
          <span className="menu-icone">▣</span>
          <span>Livros</span>
        </button>

        <button
          className={tela === "emprestimos" ? "menu-ativo" : ""}
          onClick={() => setTela("emprestimos")}
        >
          <span className="menu-icone">⇄</span>
          <span>Empréstimos</span>
        </button>

        <button
          className={tela === "pessoas" ? "menu-ativo" : ""}
          onClick={() => setTela("pessoas")}
        >
          <span className="menu-icone">◉</span>
          <span>Leitores</span>
        </button>

        <button
          className={tela === "backup" ? "menu-ativo" : ""}
          onClick={() => setTela("backup")}
        >
          <span className="menu-icone">↥</span>
          <span>Backup</span>
        </button>
      </nav>
    </div>
  );
}

export default App;