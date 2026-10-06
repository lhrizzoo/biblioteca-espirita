import { useEffect, useState } from "react";
import Papa from "papaparse";
import { open } from "@tauri-apps/plugin-dialog";
import { readTextFile } from "@tauri-apps/plugin-fs";

import { obterBanco } from "../database/database";
import type { Livro, LivroBanco } from "../types";

type LivroImportacao = {
  codigo: string;
  codigo_barras: string;
  titulo: string;
  autor: string;
  espirito: string;
  medium: string;
  editora: string;
  observacao: string;
  valido: boolean;
  motivo: string;
};

function normalizarCabecalho(valor: string) {
  return valor
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s_-]/g, "");
}

function encontrarValor(
  linha: Record<string, unknown>,
  nomesAceitos: string[]
) {
  const chaves = Object.keys(linha);

  for (const chave of chaves) {
    const chaveNormalizada = normalizarCabecalho(chave);

    if (
      nomesAceitos.some(
        (nome) => normalizarCabecalho(nome) === chaveNormalizada
      )
    ) {
      const valor = linha[chave];

      if (valor === null || valor === undefined) {
        return "";
      }

      return String(valor).trim();
    }
  }

  return "";
}

function Livros() {
  const [livros, setLivros] = useState<Livro[]>([]);
  const [pesquisa, setPesquisa] = useState("");
  const [mostrarFormulario, setMostrarFormulario] = useState(false);

  const [codigo, setCodigo] = useState("");
  const [codigoBarras, setCodigoBarras] = useState("");
  const [titulo, setTitulo] = useState("");
  const [autor, setAutor] = useState("");
  const [espirito, setEspirito] = useState("");
  const [medium, setMedium] = useState("");
  const [editora, setEditora] = useState("");
  const [observacao, setObservacao] = useState("");

  const [codigoOriginal, setCodigoOriginal] = useState<string | null>(
    null
  );

  const [livroParaExcluir, setLivroParaExcluir] =
    useState<Livro | null>(null);

  const [livroEmprestadoParaExcluir, setLivroEmprestadoParaExcluir] =
    useState(false);

  const [excluindo, setExcluindo] = useState(false);
  const [mensagemExclusao, setMensagemExclusao] = useState("");

  const [arquivoImportacao, setArquivoImportacao] = useState("");
  const [livrosImportacao, setLivrosImportacao] = useState<
    LivroImportacao[]
  >([]);
  const [mostrarImportacao, setMostrarImportacao] = useState(false);
  const [importando, setImportando] = useState(false);
  const [mensagemImportacao, setMensagemImportacao] = useState("");

  const editando = codigoOriginal !== null;

  async function carregarLivros() {
    try {
      const db = await obterBanco();

      const registros = await db.select<LivroBanco[]>(`
        SELECT
          codigo,
          codigo_barras,
          titulo,
          autor,
          espirito,
          medium,
          editora,
          observacao,
          disponivel
        FROM livros
        WHERE ativo = 1
        ORDER BY titulo
      `);

      setLivros(
        registros.map((livro) => ({
          codigo: livro.codigo,
          codigo_barras: livro.codigo_barras ?? "",
          titulo: livro.titulo,
          autor: livro.autor,
          espirito: livro.espirito ?? "",
          medium: livro.medium ?? "",
          editora: livro.editora ?? "",
          observacao: livro.observacao ?? "",
          disponivel: livro.disponivel === 1,
        }))
      );
    } catch (erro) {
      console.error("Erro ao carregar livros:", erro);
    }
  }

  useEffect(() => {
    carregarLivros();
  }, []);

  function limparFormulario() {
    setCodigo("");
    setCodigoBarras("");
    setTitulo("");
    setAutor("");
    setEspirito("");
    setMedium("");
    setEditora("");
    setObservacao("");
    setCodigoOriginal(null);
  }

  function abrirNovoLivro() {
    limparFormulario();
    setMensagemExclusao("");
    setMostrarFormulario(true);
  }

  function abrirEdicao(livro: Livro) {
    setCodigoOriginal(livro.codigo);
    setCodigo(livro.codigo);
    setCodigoBarras(livro.codigo_barras);
    setTitulo(livro.titulo);
    setAutor(livro.autor);
    setEspirito(livro.espirito);
    setMedium(livro.medium);
    setEditora(livro.editora);
    setObservacao(livro.observacao);
    setMensagemExclusao("");
    setMostrarFormulario(true);
  }

  function fecharFormulario() {
    limparFormulario();
    setMostrarFormulario(false);
  }

  async function salvarLivro() {
    if (!codigo.trim() || !titulo.trim() || !autor.trim()) {
      alert("Preencha código, título e autor.");
      return;
    }

    try {
      const db = await obterBanco();

      const codigoBarrasLimpo = codigoBarras.trim();

      if (codigoBarrasLimpo) {
        const parametros = editando
          ? [codigoBarrasLimpo, codigoOriginal]
          : [codigoBarrasLimpo];

        const consulta = editando
          ? `
              SELECT codigo
              FROM livros
              WHERE codigo_barras = $1
                AND codigo <> $2
              LIMIT 1
            `
          : `
              SELECT codigo
              FROM livros
              WHERE codigo_barras = $1
              LIMIT 1
            `;

        const duplicado = await db.select<{ codigo: string }[]>(
          consulta,
          parametros
        );

        if (duplicado.length > 0) {
          alert(
            "Este código de barras já está cadastrado em outro livro."
          );
          return;
        }
      }

      const codigoBarrasBanco =
        codigoBarrasLimpo.length > 0 ? codigoBarrasLimpo : null;

      if (editando) {
        await db.execute(
          `
            UPDATE livros
            SET
              codigo = $1,
              codigo_barras = $2,
              titulo = $3,
              autor = $4,
              espirito = $5,
              medium = $6,
              editora = $7,
              observacao = $8
            WHERE codigo = $9
          `,
          [
            codigo.trim(),
            codigoBarrasBanco,
            titulo.trim(),
            autor.trim(),
            espirito.trim(),
            medium.trim(),
            editora.trim(),
            observacao.trim(),
            codigoOriginal,
          ]
        );
      } else {
        await db.execute(
          `
            INSERT INTO livros (
              codigo,
              codigo_barras,
              titulo,
              autor,
              espirito,
              medium,
              editora,
              observacao,
              disponivel,
              ativo
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1, 1)
          `,
          [
            codigo.trim(),
            codigoBarrasBanco,
            titulo.trim(),
            autor.trim(),
            espirito.trim(),
            medium.trim(),
            editora.trim(),
            observacao.trim(),
          ]
        );
      }

      fecharFormulario();
      await carregarLivros();
    } catch (erro) {
      console.error("Erro ao salvar livro:", erro);

      alert(
        "Não foi possível salvar o livro. Verifique se o código ou o código de barras já está sendo utilizado."
      );
    }
  }

  async function solicitarExclusao(livro: Livro) {
    try {
      setMensagemExclusao("");

      const db = await obterBanco();

      const ativos = await db.select<{ total: number }[]>(
        `
          SELECT COUNT(*) AS total
          FROM emprestimos
          WHERE livro_codigo = $1
            AND data_devolucao IS NULL
        `,
        [livro.codigo]
      );

      const totalAtivos = Number(ativos[0]?.total ?? 0);

      setLivroEmprestadoParaExcluir(totalAtivos > 0);
      setLivroParaExcluir(livro);
    } catch (erro) {
      console.error("Erro ao verificar livro:", erro);

      setMensagemExclusao(
        "Não foi possível verificar o livro antes da exclusão."
      );
    }
  }

  function cancelarExclusao() {
    if (excluindo) {
      return;
    }

    setLivroParaExcluir(null);
    setLivroEmprestadoParaExcluir(false);
  }

  async function confirmarExclusao() {
    if (!livroParaExcluir || excluindo) {
      return;
    }

    try {
      setExcluindo(true);
      setMensagemExclusao("");

      const db = await obterBanco();

      const historico = await db.select<{ total: number }[]>(
        `
          SELECT COUNT(*) AS total
          FROM emprestimos
          WHERE livro_codigo = $1
        `,
        [livroParaExcluir.codigo]
      );

      const totalHistorico = Number(historico[0]?.total ?? 0);

      if (totalHistorico > 0) {
        await db.execute(
          `
            UPDATE livros
            SET ativo = 0,
                disponivel = 0
            WHERE codigo = $1
          `,
          [livroParaExcluir.codigo]
        );
      } else {
        await db.execute(
          `
            DELETE FROM livros
            WHERE codigo = $1
          `,
          [livroParaExcluir.codigo]
        );
      }

      setLivroParaExcluir(null);
      setLivroEmprestadoParaExcluir(false);

      setMensagemExclusao(
        "Livro apagado do acervo com sucesso."
      );

      await carregarLivros();
    } catch (erro) {
      console.error("Erro ao apagar livro:", erro);

      setMensagemExclusao(
        "Não foi possível apagar o livro."
      );
    } finally {
      setExcluindo(false);
    }
  }

  async function escolherArquivoCSV() {
    try {
      setMensagemImportacao("");

      const arquivo = await open({
        multiple: false,
        directory: false,
        title: "Escolha a planilha CSV de livros",
        filters: [
          {
            name: "Arquivo CSV",
            extensions: ["csv"],
          },
        ],
      });

      if (!arquivo || typeof arquivo !== "string") {
        return;
      }

      const conteudo = await readTextFile(arquivo);

      const resultado = Papa.parse<Record<string, unknown>>(conteudo, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (cabecalho) => cabecalho.trim(),
      });

      if (
        resultado.errors.length > 0 &&
        resultado.data.length === 0
      ) {
        setMensagemImportacao(
          "Não foi possível interpretar o arquivo CSV."
        );
        return;
      }

      const db = await obterBanco();

      const livrosCadastrados = await db.select<
        { codigo: string; codigo_barras: string | null }[]
      >(`
        SELECT codigo, codigo_barras
        FROM livros
      `);

      const codigosExistentes = new Set(
        livrosCadastrados.map((livro) =>
          livro.codigo.trim().toLowerCase()
        )
      );

      const barrasExistentes = new Set(
        livrosCadastrados
          .map((livro) => livro.codigo_barras?.trim() ?? "")
          .filter(Boolean)
      );

      const codigosDoArquivo = new Set<string>();
      const barrasDoArquivo = new Set<string>();

      const preparados: LivroImportacao[] =
        resultado.data.map((linha) => {
          const codigoLinha = encontrarValor(linha, [
            "codigo",
            "código",
            "cod",
          ]);

          const codigoBarrasLinha = encontrarValor(linha, [
            "codigo de barras",
            "código de barras",
            "codigobarras",
            "códigobarras",
            "barcode",
            "ean",
          ]);

          const tituloLinha = encontrarValor(linha, [
            "titulo",
            "título",
            "livro",
            "nome",
          ]);

          const autorLinha = encontrarValor(linha, [
            "autor",
            "autoria",
          ]);

          const espiritoLinha = encontrarValor(linha, [
            "espirito",
            "espírito",
          ]);

          const mediumLinha = encontrarValor(linha, [
            "medium",
            "médium",
            "mediumpsicografo",
            "médiumpsicógrafo",
          ]);

          const editoraLinha = encontrarValor(linha, [
            "editora",
            "editor",
          ]);

          const observacaoLinha = encontrarValor(linha, [
            "observacao",
            "observação",
            "obs",
          ]);

          let valido = true;
          let motivo = "";

          if (!codigoLinha || !tituloLinha || !autorLinha) {
            valido = false;
            motivo = "Dados obrigatórios incompletos";
          }

          const codigoNormalizado =
            codigoLinha.toLowerCase();

          if (
            valido &&
            codigosExistentes.has(codigoNormalizado)
          ) {
            valido = false;
            motivo =
              "Código já existe ou pertence a um livro apagado";
          }

          if (
            valido &&
            codigosDoArquivo.has(codigoNormalizado)
          ) {
            valido = false;
            motivo = "Código repetido no arquivo";
          }

          if (
            valido &&
            codigoBarrasLinha &&
            barrasExistentes.has(codigoBarrasLinha)
          ) {
            valido = false;
            motivo =
              "Código de barras já existe ou pertence a um livro apagado";
          }

          if (
            valido &&
            codigoBarrasLinha &&
            barrasDoArquivo.has(codigoBarrasLinha)
          ) {
            valido = false;
            motivo =
              "Código de barras repetido no arquivo";
          }

          if (codigoLinha) {
            codigosDoArquivo.add(codigoNormalizado);
          }

          if (codigoBarrasLinha) {
            barrasDoArquivo.add(codigoBarrasLinha);
          }

          return {
            codigo: codigoLinha,
            codigo_barras: codigoBarrasLinha,
            titulo: tituloLinha,
            autor: autorLinha,
            espirito: espiritoLinha,
            medium: mediumLinha,
            editora: editoraLinha,
            observacao: observacaoLinha,
            valido,
            motivo,
          };
        });

      setArquivoImportacao(
        arquivo
          .split("\\")
          .join("/")
          .split("/")
          .pop() ?? arquivo
      );

      setLivrosImportacao(preparados);
      setMostrarImportacao(true);
    } catch (erro) {
      console.error("Erro ao abrir CSV:", erro);

      const detalhe =
        erro instanceof Error
          ? erro.message
          : String(erro);

      setMensagemImportacao(
        `Não foi possível abrir o arquivo CSV: ${detalhe}`
      );
    }
  }

  function fecharImportacao() {
    if (importando) {
      return;
    }

    setMostrarImportacao(false);
    setArquivoImportacao("");
    setLivrosImportacao([]);
    setMensagemImportacao("");
  }

  async function confirmarImportacao() {
    const validos = livrosImportacao.filter(
      (livro) => livro.valido
    );

    if (validos.length === 0) {
      setMensagemImportacao(
        "Não há nenhum livro válido para importar."
      );
      return;
    }

    setImportando(true);
    setMensagemImportacao("");

    try {
      const db = await obterBanco();

      await db.execute("BEGIN TRANSACTION");

      try {
        for (const livro of validos) {
          const codigoBarrasBanco =
            livro.codigo_barras.trim().length > 0
              ? livro.codigo_barras.trim()
              : null;

          await db.execute(
            `
              INSERT INTO livros (
                codigo,
                codigo_barras,
                titulo,
                autor,
                espirito,
                medium,
                editora,
                observacao,
                disponivel,
                ativo
              )
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1, 1)
            `,
            [
              livro.codigo.trim(),
              codigoBarrasBanco,
              livro.titulo.trim(),
              livro.autor.trim(),
              livro.espirito.trim(),
              livro.medium.trim(),
              livro.editora.trim(),
              livro.observacao.trim(),
            ]
          );
        }

        await db.execute("COMMIT");
      } catch (erro) {
        await db.execute("ROLLBACK");
        throw erro;
      }

      const ignorados =
        livrosImportacao.length - validos.length;

      await carregarLivros();

      setLivrosImportacao([]);
      setArquivoImportacao("");

      setMensagemImportacao(
        `${validos.length} ${
          validos.length === 1
            ? "livro importado"
            : "livros importados"
        } com sucesso${
          ignorados > 0
            ? `. ${ignorados} ${
                ignorados === 1
                  ? "linha foi ignorada"
                  : "linhas foram ignoradas"
              }.`
            : "."
        }`
      );
    } catch (erro) {
      console.error(
        "Erro ao importar livros:",
        erro
      );

      const detalhe =
        erro instanceof Error
          ? erro.message
          : String(erro);

      setMensagemImportacao(
        `Não foi possível concluir a importação: ${detalhe}`
      );
    } finally {
      setImportando(false);
    }
  }

  const termo = pesquisa.trim().toLowerCase();

  const livrosFiltrados = livros.filter(
    (livro) => {
      if (!termo) {
        return true;
      }

      return (
        livro.codigo.toLowerCase().includes(termo) ||
        livro.codigo_barras
          .toLowerCase()
          .includes(termo) ||
        livro.titulo.toLowerCase().includes(termo) ||
        livro.autor.toLowerCase().includes(termo) ||
        livro.espirito
          .toLowerCase()
          .includes(termo) ||
        livro.medium.toLowerCase().includes(termo) ||
        livro.editora.toLowerCase().includes(termo) ||
        livro.observacao
          .toLowerCase()
          .includes(termo)
      );
    }
  );

  const quantidadeValidos =
    livrosImportacao.filter(
      (livro) => livro.valido
    ).length;

  const quantidadeInvalidos =
    livrosImportacao.length -
    quantidadeValidos;

  return (
    <>
      <section className="acoes">
        <button onClick={abrirNovoLivro}>
          + Cadastrar livro
        </button>

        <button
          className="botao-secundario"
          onClick={escolherArquivoCSV}
        >
          Importar CSV
        </button>
      </section>

      {mensagemExclusao && (
        <section className="formulario">
          <p>{mensagemExclusao}</p>
        </section>
      )}

      {mensagemImportacao &&
        !mostrarImportacao && (
          <section className="formulario">
            <p>{mensagemImportacao}</p>
          </section>
        )}

      {mostrarFormulario && (
        <section className="formulario">
          <div className="formulario-topo">
            <h2>
              {editando
                ? "Editar livro"
                : "Cadastrar livro"}
            </h2>

            <button
              className="fechar"
              onClick={fecharFormulario}
            >
              ×
            </button>
          </div>

          <div className="campos">
            <label>
              Código
              <input
                value={codigo}
                onChange={(e) =>
                  setCodigo(e.target.value)
                }
                placeholder="Ex.: 003"
              />
            </label>

            <label>
              Código de barras
              <input
                value={codigoBarras}
                onChange={(e) =>
                  setCodigoBarras(e.target.value)
                }
                placeholder="Digite ou passe o livro no leitor"
                autoComplete="off"
              />
            </label>

            <label>
              Título
              <input
                value={titulo}
                onChange={(e) =>
                  setTitulo(e.target.value)
                }
                placeholder="Nome do livro"
              />
            </label>

            <label>
              Autor
              <input
                value={autor}
                onChange={(e) =>
                  setAutor(e.target.value)
                }
                placeholder="Nome do autor"
              />
            </label>

            <label>
              Espírito
              <input
                value={espirito}
                onChange={(e) =>
                  setEspirito(e.target.value)
                }
                placeholder="Espírito autor da obra"
              />
            </label>

            <label>
              Médium
              <input
                value={medium}
                onChange={(e) =>
                  setMedium(e.target.value)
                }
                placeholder="Nome do médium"
              />
            </label>

            <label>
              Editora
              <input
                value={editora}
                onChange={(e) =>
                  setEditora(e.target.value)
                }
                placeholder="Nome da editora"
              />
            </label>

            <label>
              Observação
              <input
                value={observacao}
                onChange={(e) =>
                  setObservacao(e.target.value)
                }
                placeholder="Informação adicional"
              />
            </label>
          </div>

          <div className="formulario-acoes">
            <button
              className="cancelar"
              onClick={fecharFormulario}
            >
              Cancelar
            </button>

            <button onClick={salvarLivro}>
              {editando
                ? "Salvar alterações"
                : "Salvar livro"}
            </button>
          </div>
        </section>
      )}

      <section className="pesquisa">
        <input
          value={pesquisa}
          onChange={(e) =>
            setPesquisa(e.target.value)
          }
          placeholder="Pesquisar por código, código de barras, título, autor, espírito, médium ou editora..."
          autoComplete="off"
        />
      </section>

      <section className="painel">
        <h2>Acervo</h2>

        <table>
          <thead>
            <tr>
              <th>Código</th>
              <th>Cód. barras</th>
              <th>Livro</th>
              <th>Autor</th>
              <th>Espírito</th>
              <th>Médium</th>
              <th>Editora</th>
              <th>Situação</th>
              <th>Com quem está</th>
              <th>Ações</th>
            </tr>
          </thead>

          <tbody>
            {livrosFiltrados.length === 0 ? (
              <tr>
                <td colSpan={10}>
                  {pesquisa.trim()
                    ? "Nenhum livro encontrado."
                    : "Nenhum livro cadastrado."}
                </td>
              </tr>
            ) : (
              livrosFiltrados.map((livro) => (
                <LinhaLivro
                  key={livro.codigo}
                  livro={livro}
                  abrirEdicao={abrirEdicao}
                  solicitarExclusao={
                    solicitarExclusao
                  }
                />
              ))
            )}
          </tbody>
        </table>
      </section>

      {livroParaExcluir && (
        <div className="modal-fundo">
          <div className="modal">
            <h2>Apagar livro</h2>

            {livroEmprestadoParaExcluir ? (
              <>
                <p>
                  <strong>
                    Este livro está emprestado.
                  </strong>
                </p>

                <p>
                  Tem certeza que deseja apagar?
                </p>
              </>
            ) : (
              <p>
                Tem certeza de que deseja apagar este
                livro do acervo?
              </p>
            )}

            <div className="resumo-devolucao">
              <strong>
                {livroParaExcluir.titulo}
              </strong>

              <span>
                Código: {livroParaExcluir.codigo}
              </span>

              <span>
                Autor: {livroParaExcluir.autor}
              </span>
            </div>

            {livroEmprestadoParaExcluir && (
              <p>
                O empréstimo continuará registrado. Quando
                o livro for devolvido, o sistema perguntará
                se ele deve retornar ao estoque.
              </p>
            )}

            {!livroEmprestadoParaExcluir && (
              <p>
                O histórico de empréstimos, caso exista,
                será preservado.
              </p>
            )}

            <div className="modal-acoes">
              <button
                className="cancelar-modal"
                onClick={cancelarExclusao}
                disabled={excluindo}
              >
                Cancelar
              </button>

              <button
                className="confirmar-devolucao"
                onClick={confirmarExclusao}
                disabled={excluindo}
              >
                {excluindo
                  ? "Apagando..."
                  : "Confirmar exclusão"}
              </button>
            </div>
          </div>
        </div>
      )}

      {mostrarImportacao && (
        <div className="modal-fundo">
          <div
            className="modal"
            style={{ maxWidth: "1100px" }}
          >
            <h2>Importar livros</h2>

            <p>
              Arquivo:{" "}
              <strong>{arquivoImportacao}</strong>
            </p>

            <p>
              Foram encontradas {livrosImportacao.length} linhas.{" "}
              <strong>{quantidadeValidos}</strong>{" "}
              podem ser importadas e{" "}
              <strong>{quantidadeInvalidos}</strong>{" "}
              serão ignoradas.
            </p>

            <div
              style={{
                maxHeight: "360px",
                overflow: "auto",
                border: "1px solid #e1e5e2",
                borderRadius: "8px",
              }}
            >
              <table>
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Cód. barras</th>
                    <th>Título</th>
                    <th>Autor</th>
                    <th>Espírito</th>
                    <th>Médium</th>
                    <th>Editora</th>
                    <th>Validação</th>
                  </tr>
                </thead>

                <tbody>
                  {livrosImportacao.map(
                    (livro, indice) => (
                      <tr
                        key={`${livro.codigo}-${indice}`}
                      >
                        <td>{livro.codigo || "—"}</td>
                        <td>
                          {livro.codigo_barras || "—"}
                        </td>
                        <td>{livro.titulo || "—"}</td>
                        <td>{livro.autor || "—"}</td>
                        <td>{livro.espirito || "—"}</td>
                        <td>{livro.medium || "—"}</td>
                        <td>{livro.editora || "—"}</td>

                        <td>
                          {livro.valido ? (
                            <span className="disponivel">
                              Pronto
                            </span>
                          ) : (
                            <span className="status-atrasado">
                              {livro.motivo}
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>

            {mensagemImportacao && (
              <p>{mensagemImportacao}</p>
            )}

            <div className="modal-acoes">
              <button
                className="cancelar-modal"
                onClick={fecharImportacao}
                disabled={importando}
              >
                Cancelar
              </button>

              <button
                className="confirmar-devolucao"
                onClick={confirmarImportacao}
                disabled={
                  importando ||
                  quantidadeValidos === 0
                }
              >
                {importando
                  ? "Importando..."
                  : `Importar ${quantidadeValidos} ${
                      quantidadeValidos === 1
                        ? "livro"
                        : "livros"
                    }`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function LinhaLivro({
  livro,
  abrirEdicao,
  solicitarExclusao,
}: {
  livro: Livro;
  abrirEdicao: (livro: Livro) => void;
  solicitarExclusao: (livro: Livro) => void;
}) {
  const [emprestadoPara, setEmprestadoPara] =
    useState<string>("");

  useEffect(() => {
    async function buscarPessoa() {
      if (livro.disponivel) {
        setEmprestadoPara("");
        return;
      }

      try {
        const db = await obterBanco();

        const resultado = await db.select<
          { nome: string }[]
        >(
          `
            SELECT p.nome
            FROM emprestimos e
            INNER JOIN pessoas p
              ON p.id = e.pessoa_id
            WHERE e.livro_codigo = $1
              AND e.data_devolucao IS NULL
            ORDER BY e.id DESC
            LIMIT 1
          `,
          [livro.codigo]
        );

        setEmprestadoPara(
          resultado[0]?.nome ?? "Não identificado"
        );
      } catch (erro) {
        console.error(
          "Erro ao localizar empréstimo:",
          erro
        );

        setEmprestadoPara("Não identificado");
      }
    }

    buscarPessoa();
  }, [livro.codigo, livro.disponivel]);

  return (
    <tr>
      <td>{livro.codigo}</td>
      <td>{livro.codigo_barras || "—"}</td>
      <td>{livro.titulo}</td>
      <td>{livro.autor}</td>
      <td>{livro.espirito || "—"}</td>
      <td>{livro.medium || "—"}</td>
      <td>{livro.editora || "—"}</td>

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
        {livro.disponivel
          ? "—"
          : emprestadoPara || "Carregando..."}
      </td>

      <td>
        <div
          style={{
            display: "flex",
            gap: "8px",
            flexWrap: "wrap",
          }}
        >
          <button
            className="botao-editar"
            onClick={() => abrirEdicao(livro)}
          >
            Editar
          </button>

          <button
            className="botao-devolver"
            onClick={() => solicitarExclusao(livro)}
          >
            Excluir
          </button>
        </div>
      </td>
    </tr>
  );
}

export default Livros;