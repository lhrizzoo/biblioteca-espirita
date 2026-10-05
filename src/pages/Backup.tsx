import { useState } from "react";
import { appDataDir, join } from "@tauri-apps/api/path";
import { copyFile } from "@tauri-apps/plugin-fs";
import { open } from "@tauri-apps/plugin-dialog";

import { obterBanco } from "../database/database";

function criarDataHora() {
  const agora = new Date();

  const data = agora.toISOString().split("T")[0];
  const hora = String(agora.getHours()).padStart(2, "0");
  const minuto = String(agora.getMinutes()).padStart(2, "0");
  const segundo = String(agora.getSeconds()).padStart(2, "0");

  return `${data}_${hora}-${minuto}-${segundo}`;
}

function Backup() {
  const [fazendoBackup, setFazendoBackup] = useState(false);
  const [restaurando, setRestaurando] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [arquivoRestauracao, setArquivoRestauracao] =
    useState<string | null>(null);

  async function fazerBackup() {
    try {
      setFazendoBackup(true);
      setMensagem("");

      const pastaEscolhida = await open({
        directory: true,
        multiple: false,
        title: "Escolha onde salvar o backup",
      });

      if (!pastaEscolhida || typeof pastaEscolhida !== "string") {
        return;
      }

      const pastaDados = await appDataDir();
      const bancoOrigem = await join(pastaDados, "biblioteca.db");

      const nomeBackup = `Biblioteca_Backup_${criarDataHora()}.db`;
      const destino = await join(pastaEscolhida, nomeBackup);

      await copyFile(bancoOrigem, destino);

      setMensagem(`Backup criado com sucesso: ${nomeBackup}`);
    } catch (erro) {
      console.error("Erro ao criar backup:", erro);

      const detalhe =
        erro instanceof Error ? erro.message : String(erro);

      setMensagem(`Não foi possível criar o backup: ${detalhe}`);
    } finally {
      setFazendoBackup(false);
    }
  }

  async function escolherBackupParaRestaurar() {
    try {
      setMensagem("");

      const arquivo = await open({
        multiple: false,
        directory: false,
        title: "Escolha o backup da biblioteca",
        filters: [
          {
            name: "Backup da Biblioteca",
            extensions: ["db"],
          },
        ],
      });

      if (!arquivo || typeof arquivo !== "string") {
        return;
      }

      setArquivoRestauracao(arquivo);
    } catch (erro) {
      console.error("Erro ao escolher backup:", erro);

      const detalhe =
        erro instanceof Error ? erro.message : String(erro);

      setMensagem(`Não foi possível abrir o backup: ${detalhe}`);
    }
  }

  function cancelarRestauracao() {
    if (restaurando) {
      return;
    }

    setArquivoRestauracao(null);
  }

  async function confirmarRestauracao() {
    if (!arquivoRestauracao || restaurando) {
      return;
    }

    let copiaSeguranca = "";

    try {
      setRestaurando(true);
      setMensagem("");

      const pastaDados = await appDataDir();
      const bancoAtual = await join(pastaDados, "biblioteca.db");

      copiaSeguranca = await join(
        pastaDados,
        `Biblioteca_Antes_Restauracao_${criarDataHora()}.db`
      );

      const db = await obterBanco();

      await db.close();

      await copyFile(bancoAtual, copiaSeguranca);
      await copyFile(arquivoRestauracao, bancoAtual);

      setArquivoRestauracao(null);

      setMensagem(
        "Backup restaurado com sucesso. A biblioteca será recarregada."
      );

      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (erro) {
      console.error("Erro ao restaurar backup:", erro);

      if (copiaSeguranca) {
        try {
          const pastaDados = await appDataDir();
          const bancoAtual = await join(pastaDados, "biblioteca.db");

          await copyFile(copiaSeguranca, bancoAtual);
        } catch (erroRecuperacao) {
          console.error(
            "Erro ao recuperar banco após falha na restauração:",
            erroRecuperacao
          );
        }
      }

      const detalhe =
        erro instanceof Error ? erro.message : String(erro);

      setMensagem(
        `Não foi possível restaurar o backup: ${detalhe}`
      );
    } finally {
      setRestaurando(false);
    }
  }

  function nomeDoArquivo(caminho: string) {
    const partes = caminho.split("\\").join("/").split("/");
    return partes[partes.length - 1];
  }

  return (
    <>
      <section>
        <h2>Backup da biblioteca</h2>

        <p>
          Crie uma cópia de segurança dos dados da biblioteca para
          proteger livros, pessoas, empréstimos e histórico.
        </p>

        <div className="acoes">
          <button
            onClick={fazerBackup}
            disabled={fazendoBackup || restaurando}
          >
            {fazendoBackup
              ? "Criando backup..."
              : "Fazer backup agora"}
          </button>

          <button
            className="botao-secundario"
            onClick={escolherBackupParaRestaurar}
            disabled={fazendoBackup || restaurando}
          >
            Restaurar backup
          </button>
        </div>

        {mensagem && <p>{mensagem}</p>}
      </section>

      {arquivoRestauracao && (
        <div className="modal-fundo">
          <div className="modal">
            <h2>Restaurar biblioteca</h2>

            <p>
              Você está prestes a substituir os dados atuais da
              biblioteca pelos dados deste backup:
            </p>

            <div className="resumo-devolucao">
              <strong>
                {nomeDoArquivo(arquivoRestauracao)}
              </strong>

              <span>
                Antes da restauração, o sistema criará automaticamente
                uma cópia de segurança dos dados atuais.
              </span>
            </div>

            <p>
              Livros, pessoas, empréstimos e histórico passarão a
              refletir o conteúdo do backup escolhido.
            </p>

            <div className="modal-acoes">
              <button
                className="cancelar-modal"
                onClick={cancelarRestauracao}
                disabled={restaurando}
              >
                Cancelar
              </button>

              <button
                className="confirmar-devolucao"
                onClick={confirmarRestauracao}
                disabled={restaurando}
              >
                {restaurando
                  ? "Restaurando..."
                  : "Confirmar restauração"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default Backup;