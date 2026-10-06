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
        <p>Carregando Biblioteca Espírita...</p>
      </div>
    );
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
        {tela === "livros" && <Livros />}
        {tela === "emprestimos" && <Emprestimos />}
        {tela === "pessoas" && <Pessoas />}
        {tela === "backup" && <Backup />}
      </main>

      <nav className="menu">
        <button
          className={tela === "livros" ? "menu-ativo" : ""}
          onClick={() => setTela("livros")}
        >
          Livros
        </button>

        <button
          className={tela === "emprestimos" ? "menu-ativo" : ""}
          onClick={() => setTela("emprestimos")}
        >
          Empréstimos
        </button>

        <button
          className={tela === "pessoas" ? "menu-ativo" : ""}
          onClick={() => setTela("pessoas")}
        >
          Leitores
        </button>

        <button
          className={tela === "backup" ? "menu-ativo" : ""}
          onClick={() => setTela("backup")}
        >
          Backup
        </button>
      </nav>
    </div>
  );
}

export default App;