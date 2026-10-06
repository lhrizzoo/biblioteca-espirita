import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { appDataDir, join } from "@tauri-apps/api/path";
import { copyFile, remove } from "@tauri-apps/plugin-fs";
import "./App.css";

import {
  bancoPossuiDados,
  iniciarBanco,
  obterBanco,
} from "./database/database";
import type { Tela } from "./types";

import Livros from "./pages/Livros";
import Emprestimos from "./pages/Emprestimos";
import Pessoas from "./pages/Pessoas";
import Backup from "./pages/Backup";

type EstadoInicial =
  | "verificando"
  | "escolher-base"
  | "pronto"
  | "erro";

function gerarDataHoraArquivo() {
  const agora = new Date();

  const ano = agora.getFullYear();
  const mes = String(agora.getMonth() + 1).padStart(2, "0");
  const dia = String(agora.getDate()).padStart(2, "0");
  const hora = String(agora.getHours()).padStart(2, "0");
  const minuto = String(agora.getMinutes()).padStart(2, "0");
  const segundo = String(agora.getSeconds()).padStart(2, "0");

  return `${ano}-${mes}-${dia}_${hora}-${minuto}-${segundo}`;
}

async function obterInstalacaoRegistrada() {
  const db = await obterBanco();

  const resultado = await db.select<{ valor: string }[]>(
    `
      SELECT valor
      FROM configuracoes
      WHERE chave = 'identificador_instalacao'
      LIMIT 1
    `
  );

  return resultado[0]?.valor ?? null;
}

async function registrarInstalacaoAtual(identificador: string) {
  const db = await obterBanco();

  await db.execute(
    `
      INSERT INTO configuracoes (chave, valor)
      VALUES ('identificador_instalacao', $1)
      ON CONFLICT(chave)
      DO UPDATE SET valor = excluded.valor
    `,
    [identificador]
  );
}

function App() {
  const [tela, setTela] = useState<Tela>("livros");
  const [estadoInicial, setEstadoInicial] =
    useState<EstadoInicial>("verificando");
  const [identificadorAtual, setIdentificadorAtual] =
    useState<string>("");
  const [mensagemErro, setMensagemErro] = useState("");

  useEffect(() => {
    async function prepararSistema() {
      try {
        const restauracaoConfirmada =
          sessionStorage.getItem(
            "biblioteca_restauracao_confirmada"
          ) === "1";

        if (restauracaoConfirmada) {
          sessionStorage.removeItem(
            "biblioteca_restauracao_confirmada"
          );
        }

        const possuiDados = await bancoPossuiDados();

        await iniciarBanco();

        const identificador = await invoke<string>(
          "obter_identificador_instalacao"
        );

        setIdentificadorAtual(identificador);

        const identificadorRegistrado =
          await obterInstalacaoRegistrada();

        if (restauracaoConfirmada) {
          await registrarInstalacaoAtual(identificador);
          setEstadoInicial("pronto");
          return;
        }

        if (
          possuiDados &&
          identificadorRegistrado !== identificador
        ) {
          setEstadoInicial("escolher-base");
          return;
        }

        if (identificadorRegistrado !== identificador) {
          await registrarInstalacaoAtual(identificador);
        }

        setEstadoInicial("pronto");
      } catch (erro) {
        console.error("Erro ao iniciar sistema:", erro);

        setMensagemErro(
          erro instanceof Error
            ? erro.message
            : String(erro)
        );

        setEstadoInicial("erro");
      }
    }

    prepararSistema();
  }, []);

  async function usarBaseExistente() {
    try {
      setEstadoInicial("verificando");

      await registrarInstalacaoAtual(identificadorAtual);

      setEstadoInicial("pronto");
    } catch (erro) {
      console.error("Erro ao confirmar base existente:", erro);

      setMensagemErro(
        erro instanceof Error
          ? erro.message
          : String(erro)
      );

      setEstadoInicial("erro");
    }
  }

  async function iniciarNovaBiblioteca() {
    const confirmou = window.confirm(
      "Deseja realmente iniciar uma nova biblioteca?\n\n" +
        "A base atual NÃO será apagada sem cópia de segurança. " +
        "O sistema criará automaticamente uma cópia da base antiga antes de iniciar uma base vazia."
    );

    if (!confirmou) {
      return;
    }

    try {
      setEstadoInicial("verificando");

      const pastaDados = await appDataDir();
      const bancoAtual = await join(
        pastaDados,
        "biblioteca.db"
      );

      const nomeSeguranca =
        `Biblioteca_Base_Anterior_${gerarDataHoraArquivo()}.db`;

      const bancoSeguranca = await join(
        pastaDados,
        nomeSeguranca
      );

      const db = await obterBanco();
      await db.close();

      await copyFile(bancoAtual, bancoSeguranca);
      await remove(bancoAtual);

      sessionStorage.setItem(
        "biblioteca_restauracao_confirmada",
        "1"
      );

      window.location.reload();
    } catch (erro) {
      console.error(
        "Erro ao iniciar nova biblioteca:",
        erro
      );

      setMensagemErro(
        erro instanceof Error
          ? erro.message
          : String(erro)
      );

      setEstadoInicial("erro");
    }
  }

  if (estadoInicial === "verificando") {
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

  if (estadoInicial === "erro") {
    return (
      <div className="carregando">
        <div className="carregando-conteudo">
          <div className="marca-simbolo">BE</div>

          <div>
            <strong>Não foi possível iniciar o sistema.</strong>
            <p>{mensagemErro}</p>
          </div>
        </div>
      </div>
    );
  }

  if (estadoInicial === "escolher-base") {
    return (
      <div className="carregando">
        <div
          className="carregando-conteudo"
          style={{
            maxWidth: "620px",
            alignItems: "flex-start",
          }}
        >
          <div className="marca-simbolo">BE</div>

          <div>
            <strong>Base de dados anterior encontrada</strong>

            <p>
              O Biblioteca Espírita encontrou dados de uma
              instalação anterior neste computador.
            </p>

            <p>
              Escolha se deseja continuar utilizando esses
              dados ou iniciar uma nova biblioteca.
            </p>

            <p>
              <strong>Importante:</strong> ao iniciar uma nova
              biblioteca, o sistema cria primeiro uma cópia de
              segurança da base anterior.
            </p>

            <div
              style={{
                display: "flex",
                gap: "12px",
                flexWrap: "wrap",
                marginTop: "20px",
              }}
            >
              <button
                type="button"
                onClick={usarBaseExistente}
              >
                Usar dados existentes
              </button>

              <button
                type="button"
                onClick={iniciarNovaBiblioteca}
              >
                Iniciar nova biblioteca
              </button>
            </div>
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