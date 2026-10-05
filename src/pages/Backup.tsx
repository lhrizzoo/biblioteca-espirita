import { useEffect, useState } from "react";
import { appDataDir, join } from "@tauri-apps/api/path";
import { copyFile } from "@tauri-apps/plugin-fs";
import { open } from "@tauri-apps/plugin-dialog";

import { obterBanco } from "../database/database";

function criarDataHoraArquivo() {
  const agora = new Date();

  const data = agora.toISOString().split("T")[0];
  const hora = String(agora.getHours()).padStart(2, "0");
  const minuto = String(agora.getMinutes()).padStart(2, "0");
  const segundo = String(agora.getSeconds()).padStart(2, "0");

  return `${data}_${hora}-${minuto}-${segundo}`;
}

function formatarDataHora(dataIso: string | null) {
  if (!dataIso) {
    return "Nenhum backup registrado";
  }

  const data = new Date(dataIso);

  return data.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function calcularDiasSemBackup(dataIso: string | null) {
  if (!dataIso) {
    return null;
  }

  const ultimo = new Date(dataIso);
  const agora = new Date();

  const diferenca = agora.getTime() - ultimo.getTime();

  return Math.floor(diferenca / (1000 * 60 * 60 * 24));
}

function Backup() {
  const [fazendoBackup, setFazendoBackup] = useState(false);
  const [restaurando, setRestaurando] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [arquivoRestauracao, setArquivoRestauracao] =
    useState<string | null>(null);

  const [ultimoBackup, setUltimoBackup] = useState<string | null>(null);

  async function carregarUltimoBackup() {
    try {
      const db = await obterBanco();

      const resultado = await db.select<{ valor: string }[]>(
        `
          SELECT valor
          FROM configuracoes
          WHERE chave = $1
          LIMIT 1
        `,
        ["ultimo_backup"]
      );

      setUltimoBackup(resultado[0]?.valor ?? null);
    } catch (erro) {
      console.error("Erro ao carregar último backup:", erro);
    }
  }

  useEffect(() => {
    carregarUltimoBackup();
  }, []);

  async function registrarUltimoBackup() {
    const agora = new Date().toISOString();

    const db = await obterBanco();

    await db.execute(
      `
        INSERT INTO configuracoes (chave, valor)
        VALUES ($1, $2)
        ON CONFLICT(chave)
        DO UPDATE SET valor = excluded.valor
      `,
      ["ultimo_backup", agora]
    );

    setUltimoBackup(agora);
  }

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

      const nomeBackup =
        `Biblioteca_Backup_${criarDataHoraArquivo()}.db`;

      const destino = await join(
        pastaEscolhida,
        nomeBackup
      );

      await copyFile(bancoOrigem, destino);

      await registrarUltimoBackup();

      setMensagem(
        `Backup criado com sucesso: ${nomeBackup}`
      );
    } catch (erro) {
      console.error("Erro ao criar backup:", erro);

      const detalhe =
        erro instanceof Error ? erro.message : String(erro);

      setMensagem(
        `Não foi possível criar o backup: ${detalhe}`
      );
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

      setMensagem(
        `Não foi possível abrir o backup: ${detalhe}`
      );
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
      const bancoAtual = await join(
        pastaDados,
        "biblioteca.db"
      );

      copiaSeguranca = await join(
        pastaDados,
        `Biblioteca_Antes_Restauracao_${criarDataHoraArquivo()}.db`
      );

      const db = await obterBanco();

      await db.close();

      await copyFile(
        bancoAtual,
        copiaSeguranca
      );

      await copyFile(
        arquivoRestauracao,
        bancoAtual
      );

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

          const bancoAtual = await join(
            pastaDados,
            "biblioteca.db"
          );

          await copyFile(
            copiaSeguranca,
            bancoAtual
          );
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
    const partes = caminho
      .split("\\")
      .join("/")
      .split("/");

    return partes[partes.length - 1];
  }

  const diasSemBackup = calcularDiasSemBackup(ultimoBackup);
  const backupAtrasado =
    ultimoBackup === null ||
    (diasSemBackup !== null && diasSemBackup >= 3);

  return (
    <>
      <section>
        <h2>Backup da biblioteca</h2>

        <p>
          Crie uma cópia de segurança dos dados da biblioteca para
          proteger livros, pessoas, empréstimos e histórico.
        </p>

        <p>
          <strong>Último backup:</strong>{" "}
          {formatarDataHora(ultimoBackup)}
        </p>

        {backupAtrasado && (
          <p>
            <strong>Atenção:</strong>{" "}
            {ultimoBackup === null
              ? "Nenhum backup foi registrado ainda."
              : `O último backup foi feito há ${diasSemBackup} dias.`}{" "}
            Recomendamos fazer um novo backup agora.
          </p>
        )}

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
                Antes da restauração, o sistema criará
                automaticamente uma cópia de segurança dos dados
                atuais.
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