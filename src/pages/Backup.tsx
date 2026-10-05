import { useEffect, useState } from "react";
import { appDataDir, join } from "@tauri-apps/api/path";
import { copyFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { open } from "@tauri-apps/plugin-dialog";

import { obterBanco } from "../database/database";

type LivroExportacao = {
  codigo: string;
  titulo: string;
  autor: string;
  disponivel: number;
};

type PessoaExportacao = {
  id: number;
  nome: string;
  telefone: string;
  observacao: string;
};

type EmprestimoExportacao = {
  id: number;
  pessoa_nome: string;
  livro_codigo: string;
  livro_titulo: string;
  data_emprestimo: string;
  data_prevista: string;
  data_devolucao: string | null;
};

function criarDataHoraArquivo() {
  const agora = new Date();

  const data = agora.toISOString().split("T")[0];
  const hora = String(agora.getHours()).padStart(2, "0");
  const minuto = String(agora.getMinutes()).padStart(2, "0");
  const segundo = String(agora.getSeconds()).padStart(2, "0");

  return `${data}_${hora}-${minuto}-${segundo}`;
}

function criarDataArquivo() {
  return new Date().toISOString().split("T")[0];
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

function escaparCSV(valor: unknown) {
  if (valor === null || valor === undefined) {
    return "";
  }

  const texto = String(valor);

  if (
    texto.includes(",") ||
    texto.includes('"') ||
    texto.includes("\n") ||
    texto.includes("\r")
  ) {
    return `"${texto.split('"').join('""')}"`;
  }

  return texto;
}

function montarCSV(
  cabecalhos: string[],
  linhas: unknown[][]
) {
  const linhasCSV = [
    cabecalhos.map(escaparCSV).join(","),
    ...linhas.map((linha) =>
      linha.map(escaparCSV).join(",")
    ),
  ];

  return linhasCSV.join("\n");
}

function Backup() {
  const [fazendoBackup, setFazendoBackup] = useState(false);
  const [restaurando, setRestaurando] = useState(false);
  const [exportando, setExportando] = useState(false);

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

  async function exportarTodosOsDados() {
    try {
      setExportando(true);
      setMensagem("");

      const pastaEscolhida = await open({
        directory: true,
        multiple: false,
        title: "Escolha onde salvar os arquivos exportados",
      });

      if (!pastaEscolhida || typeof pastaEscolhida !== "string") {
        return;
      }

      const db = await obterBanco();

      const livros = await db.select<LivroExportacao[]>(`
        SELECT codigo, titulo, autor, disponivel
        FROM livros
        ORDER BY titulo
      `);

      const pessoas = await db.select<PessoaExportacao[]>(`
        SELECT id, nome, telefone, observacao
        FROM pessoas
        ORDER BY nome
      `);

      const emprestimos = await db.select<EmprestimoExportacao[]>(`
        SELECT
          e.id,
          p.nome AS pessoa_nome,
          e.livro_codigo,
          l.titulo AS livro_titulo,
          e.data_emprestimo,
          e.data_prevista,
          e.data_devolucao
        FROM emprestimos e
        INNER JOIN pessoas p
          ON p.id = e.pessoa_id
        INNER JOIN livros l
          ON l.codigo = e.livro_codigo
        ORDER BY e.id DESC
      `);

      const ativos = emprestimos.filter(
        (emprestimo) => emprestimo.data_devolucao === null
      );

      const historico = emprestimos.filter(
        (emprestimo) => emprestimo.data_devolucao !== null
      );

      const dataArquivo = criarDataArquivo();

      const csvLivros = montarCSV(
        ["codigo", "titulo", "autor", "situacao"],
        livros.map((livro) => [
          livro.codigo,
          livro.titulo,
          livro.autor,
          livro.disponivel === 1
            ? "Disponível"
            : "Emprestado",
        ])
      );

      const csvPessoas = montarCSV(
        ["id", "nome", "telefone", "observacao"],
        pessoas.map((pessoa) => [
          pessoa.id,
          pessoa.nome,
          pessoa.telefone,
          pessoa.observacao,
        ])
      );

      const csvAtivos = montarCSV(
        [
          "id",
          "pessoa",
          "codigo_livro",
          "titulo_livro",
          "data_emprestimo",
          "data_prevista",
        ],
        ativos.map((emprestimo) => [
          emprestimo.id,
          emprestimo.pessoa_nome,
          emprestimo.livro_codigo,
          emprestimo.livro_titulo,
          emprestimo.data_emprestimo,
          emprestimo.data_prevista,
        ])
      );

      const csvHistorico = montarCSV(
        [
          "id",
          "pessoa",
          "codigo_livro",
          "titulo_livro",
          "data_emprestimo",
          "data_prevista",
          "data_devolucao",
        ],
        historico.map((emprestimo) => [
          emprestimo.id,
          emprestimo.pessoa_nome,
          emprestimo.livro_codigo,
          emprestimo.livro_titulo,
          emprestimo.data_emprestimo,
          emprestimo.data_prevista,
          emprestimo.data_devolucao,
        ])
      );

      const caminhoLivros = await join(
        pastaEscolhida,
        `Livros_${dataArquivo}.csv`
      );

      const caminhoPessoas = await join(
        pastaEscolhida,
        `Pessoas_${dataArquivo}.csv`
      );

      const caminhoAtivos = await join(
        pastaEscolhida,
        `Emprestimos_Ativos_${dataArquivo}.csv`
      );

      const caminhoHistorico = await join(
        pastaEscolhida,
        `Historico_Emprestimos_${dataArquivo}.csv`
      );

      await writeTextFile(
        caminhoLivros,
        `\uFEFF${csvLivros}`
      );

      await writeTextFile(
        caminhoPessoas,
        `\uFEFF${csvPessoas}`
      );

      await writeTextFile(
        caminhoAtivos,
        `\uFEFF${csvAtivos}`
      );

      await writeTextFile(
        caminhoHistorico,
        `\uFEFF${csvHistorico}`
      );

      setMensagem(
        "Exportação concluída com sucesso. Foram criados 4 arquivos CSV."
      );
    } catch (erro) {
      console.error("Erro ao exportar dados:", erro);

      const detalhe =
        erro instanceof Error ? erro.message : String(erro);

      setMensagem(
        `Não foi possível exportar os dados: ${detalhe}`
      );
    } finally {
      setExportando(false);
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
            disabled={
              fazendoBackup ||
              restaurando ||
              exportando
            }
          >
            {fazendoBackup
              ? "Criando backup..."
              : "Fazer backup agora"}
          </button>

          <button
            className="botao-secundario"
            onClick={escolherBackupParaRestaurar}
            disabled={
              fazendoBackup ||
              restaurando ||
              exportando
            }
          >
            Restaurar backup
          </button>

          <button
            className="botao-secundario"
            onClick={exportarTodosOsDados}
            disabled={
              fazendoBackup ||
              restaurando ||
              exportando
            }
          >
            {exportando
              ? "Exportando..."
              : "Exportar todos os dados"}
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