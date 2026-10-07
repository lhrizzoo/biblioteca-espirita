import { useEffect, useState } from "react";
import { obterBanco } from "../database/database";
import type { Emprestimo, Livro, LivroBanco, Pessoa } from "../types";

function formatarDataLocal(data: Date) {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");

  return `${ano}-${mes}-${dia}`;
}

function hoje() {
  return formatarDataLocal(new Date());
}

function daquiADias(dias: number) {
  const data = new Date();
  data.setDate(data.getDate() + dias);
  return formatarDataLocal(data);
}

function formatarData(data: string | null) {
  if (!data) return "—";

  const [ano, mes, dia] = data.split("-");
  return `${dia}/${mes}/${ano}`;
}

function normalizarTexto(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

type LivroApagadoDevolvido = {
  codigo: string;
  titulo: string;
};

type FiltroStatus =
  | "todos"
  | "pendente"
  | "atrasado"
  | "devolvido";

function Emprestimos() {
  const [emprestimos, setEmprestimos] = useState<Emprestimo[]>([]);
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [livros, setLivros] = useState<Livro[]>([]);

  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [mostrarHistorico, setMostrarHistorico] = useState(false);

  const [mostrarDevolucaoCodigo, setMostrarDevolucaoCodigo] =
    useState(false);

  const [pessoaId, setPessoaId] = useState("");
  const [buscaLeitor, setBuscaLeitor] = useState("");
  const [mostrarResultadosLeitor, setMostrarResultadosLeitor] =
    useState(false);
  const [livroCodigo, setLivroCodigo] = useState("");

  const [codigoBarrasEmprestimo, setCodigoBarrasEmprestimo] =
    useState("");

  const [mensagemCodigoBarras, setMensagemCodigoBarras] =
    useState("");

  const [codigoBarrasDevolucao, setCodigoBarrasDevolucao] =
    useState("");

  const [mensagemDevolucaoCodigo, setMensagemDevolucaoCodigo] =
    useState("");

  const [emprestimosCodigoBarras, setEmprestimosCodigoBarras] =
    useState<Emprestimo[]>([]);

  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] =
    useState<FiltroStatus>("todos");

  const [dataEmprestimo, setDataEmprestimo] = useState(hoje());
  const [dataPrevista, setDataPrevista] = useState(daquiADias(14));

  const [emprestimoParaDevolver, setEmprestimoParaDevolver] =
    useState<Emprestimo | null>(null);

  const [livroApagadoDevolvido, setLivroApagadoDevolvido] =
    useState<LivroApagadoDevolvido | null>(null);

  const [devolvendo, setDevolvendo] = useState(false);
  const [restaurandoLivro, setRestaurandoLivro] = useState(false);

  async function carregarDados() {
    try {
      const db = await obterBanco();

      const registrosEmprestimos = await db.select<Emprestimo[]>(`
        SELECT
          e.id,
          e.pessoa_id,
          p.nome AS pessoa_nome,
          e.livro_codigo,
          l.titulo AS livro_titulo,
          e.data_emprestimo,
          e.data_prevista,
          e.data_devolucao
        FROM emprestimos e
        INNER JOIN pessoas p ON p.id = e.pessoa_id
        INNER JOIN livros l ON l.codigo = e.livro_codigo
        ORDER BY
          CASE WHEN e.data_devolucao IS NULL THEN 0 ELSE 1 END,
          e.data_prevista ASC,
          e.id DESC
      `);

      const registrosPessoas = await db.select<Pessoa[]>(`
        SELECT id, nome, telefone, observacao
        FROM pessoas
        ORDER BY nome
      `);

      const registrosLivros = await db.select<LivroBanco[]>(`
        SELECT
          l.codigo,
          l.codigo_barras,
          l.titulo,
          l.autor,
          l.espirito,
          l.medium,
          l.editora,
          l.observacao,
          l.quantidade_total,
          CAST((
            SELECT COUNT(*)
            FROM emprestimos e
            WHERE e.livro_codigo = l.codigo
              AND e.data_devolucao IS NULL
          ) AS INTEGER) AS quantidade_emprestada,
          MAX(
            0,
            l.quantidade_total - (
              SELECT COUNT(*)
              FROM emprestimos e
              WHERE e.livro_codigo = l.codigo
                AND e.data_devolucao IS NULL
            )
          ) AS quantidade_disponivel,
          l.disponivel
        FROM livros l
        WHERE l.ativo = 1
        ORDER BY l.titulo
      `);

      setEmprestimos(registrosEmprestimos);
      setPessoas(registrosPessoas);

      setLivros(
        registrosLivros.map((livro) => ({
          codigo: livro.codigo,
          codigo_barras: livro.codigo_barras ?? "",
          titulo: livro.titulo,
          autor: livro.autor,
          espirito: livro.espirito ?? "",
          medium: livro.medium ?? "",
          editora: livro.editora ?? "",
          observacao: livro.observacao ?? "",
          quantidade_total: Number(livro.quantidade_total),
          quantidade_emprestada: Number(livro.quantidade_emprestada),
          quantidade_disponivel: Number(livro.quantidade_disponivel),
          disponivel: Number(livro.quantidade_disponivel) > 0,
        }))
      );
    } catch (erro) {
      console.error("Erro ao carregar empréstimos:", erro);
    }
  }

  useEffect(() => {
    carregarDados();
  }, []);

  function abrirNovoEmprestimo() {
    setPessoaId("");
    setBuscaLeitor("");
    setMostrarResultadosLeitor(false);
    setLivroCodigo("");
    setCodigoBarrasEmprestimo("");
    setMensagemCodigoBarras("");
    setDataEmprestimo(hoje());
    setDataPrevista(daquiADias(14));
    setMostrarFormulario(true);
  }

  function fecharFormulario() {
    setMostrarFormulario(false);
    setPessoaId("");
    setBuscaLeitor("");
    setMostrarResultadosLeitor(false);
    setLivroCodigo("");
    setCodigoBarrasEmprestimo("");
    setMensagemCodigoBarras("");
  }

  function abrirDevolucaoPorCodigo() {
    setCodigoBarrasDevolucao("");
    setMensagemDevolucaoCodigo("");
    setEmprestimosCodigoBarras([]);
    setMostrarDevolucaoCodigo(true);
  }

  function fecharDevolucaoPorCodigo() {
    setMostrarDevolucaoCodigo(false);
    setCodigoBarrasDevolucao("");
    setMensagemDevolucaoCodigo("");
    setEmprestimosCodigoBarras([]);
  }

  async function localizarLivroPorCodigoBarras() {
    const codigo = codigoBarrasEmprestimo.trim();

    setMensagemCodigoBarras("");
    setLivroCodigo("");

    if (!codigo) {
      setMensagemCodigoBarras(
        "Digite ou passe um código de barras no leitor."
      );
      return;
    }

    try {
      const db = await obterBanco();

      const resultado = await db.select<LivroBanco[]>(
        `
          SELECT
            l.codigo,
            l.codigo_barras,
            l.titulo,
            l.autor,
            l.espirito,
            l.medium,
            l.editora,
            l.observacao,
            l.quantidade_total,
            CAST((
              SELECT COUNT(*)
              FROM emprestimos e
              WHERE e.livro_codigo = l.codigo
                AND e.data_devolucao IS NULL
            ) AS INTEGER) AS quantidade_emprestada,
            MAX(
              0,
              l.quantidade_total - (
                SELECT COUNT(*)
                FROM emprestimos e
                WHERE e.livro_codigo = l.codigo
                  AND e.data_devolucao IS NULL
              )
            ) AS quantidade_disponivel,
            l.disponivel
          FROM livros l
          WHERE l.codigo_barras = $1
            AND l.ativo = 1
          LIMIT 1
        `,
        [codigo]
      );

      if (resultado.length === 0) {
        setMensagemCodigoBarras(
          "Nenhum livro ativo foi encontrado com este código de barras."
        );
        return;
      }

      const livro = resultado[0];
      const disponiveis = Number(livro.quantidade_disponivel);

      if (disponiveis <= 0) {
        setMensagemCodigoBarras(
          `O livro "${livro.titulo}" não possui exemplares disponíveis.`
        );
        return;
      }

      setLivroCodigo(livro.codigo);

      setMensagemCodigoBarras(
        `Livro localizado: ${livro.codigo} — ${livro.titulo}. ${disponiveis} ${
          disponiveis === 1
            ? "exemplar disponível"
            : "exemplares disponíveis"
        }.`
      );
    } catch (erro) {
      console.error(
        "Erro ao localizar livro pelo código de barras:",
        erro
      );

      setMensagemCodigoBarras(
        "Não foi possível localizar o livro pelo código de barras."
      );
    }
  }

  async function localizarEmprestimoPorCodigoBarras() {
    const termo = codigoBarrasDevolucao.trim();

    setMensagemDevolucaoCodigo("");
    setEmprestimosCodigoBarras([]);

    if (!termo) {
      setMensagemDevolucaoCodigo(
        "Digite o código de barras, código interno ou título do livro."
      );
      return;
    }

    try {
      const db = await obterBanco();
      const termoNormalizado = `%${termo.toLowerCase()}%`;

      const resultado = await db.select<Emprestimo[]>(
        `
          SELECT
            e.id,
            e.pessoa_id,
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
          WHERE e.data_devolucao IS NULL
            AND (
              l.codigo_barras = $1
              OR LOWER(l.codigo) = LOWER($1)
              OR LOWER(l.titulo) LIKE $2
            )
          ORDER BY
            CASE
              WHEN l.codigo_barras = $1 THEN 0
              WHEN LOWER(l.codigo) = LOWER($1) THEN 1
              ELSE 2
            END,
            l.titulo,
            p.nome,
            e.id DESC
        `,
        [termo, termoNormalizado]
      );

      if (resultado.length === 0) {
        setMensagemDevolucaoCodigo(
          "Nenhum empréstimo ativo foi encontrado para esta busca."
        );
        return;
      }

      if (resultado.length === 1) {
        const emprestimo = resultado[0];

        setMensagemDevolucaoCodigo(
          `Livro localizado: ${emprestimo.livro_titulo} — emprestado para ${emprestimo.pessoa_nome}.`
        );

        setEmprestimoParaDevolver(emprestimo);
        return;
      }

      setEmprestimosCodigoBarras(resultado);
      setMensagemDevolucaoCodigo(
        `Foram encontrados ${resultado.length} empréstimos ativos. Selecione abaixo o livro e o leitor corretos.`
      );
    } catch (erro) {
      console.error(
        "Erro ao localizar empréstimo para devolução:",
        erro
      );

      setMensagemDevolucaoCodigo(
        "Não foi possível localizar o empréstimo."
      );
    }
  }

  async function salvarEmprestimo() {
    if (
      !pessoaId ||
      !livroCodigo ||
      !dataEmprestimo ||
      !dataPrevista
    ) {
      alert("Preencha todos os dados do empréstimo.");
      return;
    }

    const dataAtual = hoje();

    if (dataEmprestimo !== dataAtual) {
      alert(
        `A data do empréstimo deve ser hoje (${formatarData(dataAtual)}).`
      );
      setDataEmprestimo(dataAtual);
      return;
    }

    if (dataPrevista < dataEmprestimo) {
      alert(
        "A previsão de devolução não pode ser anterior à data do empréstimo."
      );
      return;
    }

    if (dataPrevista < dataAtual) {
      alert(
        "A previsão de devolução não pode estar no passado."
      );
      return;
    }

    try {
      const db = await obterBanco();

      const quantidadeAtivos = await db.select<{ total: number }[]>(
        `
          SELECT COUNT(*) AS total
          FROM emprestimos
          WHERE pessoa_id = $1
            AND data_devolucao IS NULL
        `,
        [Number(pessoaId)]
      );

      const totalAtivos = Number(
        quantidadeAtivos[0]?.total ?? 0
      );

      if (totalAtivos >= 2) {
        alert(
          "Este leitor já possui 2 livros emprestados. É necessário devolver um livro antes de realizar um novo empréstimo."
        );
        return;
      }

      const disponibilidade = await db.select<
        {
          quantidade_total: number;
          quantidade_emprestada: number;
          ativo: number;
        }[]
      >(
        `
          SELECT
            l.quantidade_total,
            CAST((
              SELECT COUNT(*)
              FROM emprestimos e
              WHERE e.livro_codigo = l.codigo
                AND e.data_devolucao IS NULL
            ) AS INTEGER) AS quantidade_emprestada,
            l.ativo
          FROM livros l
          WHERE l.codigo = $1
          LIMIT 1
        `,
        [livroCodigo]
      );

      const livroAtual = disponibilidade[0];

      if (
        !livroAtual ||
        livroAtual.ativo !== 1 ||
        Number(livroAtual.quantidade_emprestada) >=
          Number(livroAtual.quantidade_total)
      ) {
        alert(
          "Este livro não possui exemplares disponíveis para empréstimo."
        );
        await carregarDados();
        return;
      }

      const dataAtualBanco = hoje();

      if (dataEmprestimo !== dataAtualBanco) {
        alert(
          "A data do empréstimo ficou desatualizada. O empréstimo deve ser registrado com a data de hoje."
        );
        setDataEmprestimo(dataAtualBanco);
        return;
      }

      if (dataPrevista < dataAtualBanco) {
        alert(
          "A previsão de devolução não pode estar no passado."
        );
        return;
      }

      await db.execute("BEGIN TRANSACTION");

      try {
        await db.execute(
          `
            INSERT INTO emprestimos (
              pessoa_id,
              livro_codigo,
              data_emprestimo,
              data_prevista
            )
            VALUES ($1, $2, $3, $4)
          `,
          [
            Number(pessoaId),
            livroCodigo,
            dataEmprestimo,
            dataPrevista,
          ]
        );

        await db.execute(
          `
            UPDATE livros
            SET disponivel = CASE
              WHEN quantidade_total > (
                SELECT COUNT(*)
                FROM emprestimos
                WHERE livro_codigo = $1
                  AND data_devolucao IS NULL
              ) THEN 1
              ELSE 0
            END
            WHERE codigo = $1
          `,
          [livroCodigo]
        );

        await db.execute("COMMIT");
      } catch (erro) {
        await db.execute("ROLLBACK");
        throw erro;
      }

      fecharFormulario();
      await carregarDados();
    } catch (erro) {
      console.error(
        "Erro ao registrar empréstimo:",
        erro
      );
      alert(
        "Não foi possível registrar o empréstimo."
      );
    }
  }

  function solicitarDevolucao(
    emprestimo: Emprestimo
  ) {
    setEmprestimoParaDevolver(emprestimo);
  }

  function cancelarDevolucao() {
    if (devolvendo) return;

    setEmprestimoParaDevolver(null);
  }

  async function confirmarDevolucao() {
    if (
      !emprestimoParaDevolver ||
      devolvendo
    ) {
      return;
    }

    const dataAtual = hoje();

    if (emprestimoParaDevolver.data_emprestimo > dataAtual) {
      alert(
        "Este empréstimo está registrado com uma data futura e não pode ser devolvido ainda. Corrija o registro antes de continuar."
      );
      return;
    }

    if (
      emprestimoParaDevolver.data_devolucao &&
      emprestimoParaDevolver.data_devolucao > dataAtual
    ) {
      alert(
        "A data de devolução registrada está no futuro. Corrija o registro antes de continuar."
      );
      return;
    }

    setDevolvendo(true);

    try {
      const db = await obterBanco();

      const livro = await db.select<
        { ativo: number; titulo: string }[]
      >(
        `
          SELECT ativo, titulo
          FROM livros
          WHERE codigo = $1
          LIMIT 1
        `,
        [emprestimoParaDevolver.livro_codigo]
      );

      if (livro.length === 0) {
        alert(
          "O livro deste empréstimo não foi encontrado."
        );
        return;
      }

      const livroEstavaApagado =
        livro[0].ativo !== 1;

      await db.execute("BEGIN TRANSACTION");

      try {
        await db.execute(
          `
            UPDATE emprestimos
            SET data_devolucao = $1
            WHERE id = $2
              AND data_devolucao IS NULL
              AND data_emprestimo <= $1
          `,
          [
            dataAtual,
            emprestimoParaDevolver.id,
          ]
        );

        if (livroEstavaApagado) {
          await db.execute(
            `
              UPDATE livros
              SET disponivel = 0
              WHERE codigo = $1
            `,
            [
              emprestimoParaDevolver.livro_codigo,
            ]
          );
        } else {
          await db.execute(
            `
              UPDATE livros
              SET disponivel = CASE
                WHEN quantidade_total > (
                  SELECT COUNT(*)
                  FROM emprestimos
                  WHERE livro_codigo = $1
                    AND data_devolucao IS NULL
                ) THEN 1
                ELSE 0
              END
              WHERE codigo = $1
            `,
            [
              emprestimoParaDevolver.livro_codigo,
            ]
          );
        }

        await db.execute("COMMIT");
      } catch (erro) {
        await db.execute("ROLLBACK");
        throw erro;
      }

      const codigoLivro =
        emprestimoParaDevolver.livro_codigo;

      const tituloLivro =
        emprestimoParaDevolver.livro_titulo;

      setEmprestimoParaDevolver(null);
      setMostrarDevolucaoCodigo(false);
      setCodigoBarrasDevolucao("");
      setMensagemDevolucaoCodigo("");
      setEmprestimosCodigoBarras([]);

      await carregarDados();

      if (livroEstavaApagado) {
        setLivroApagadoDevolvido({
          codigo: codigoLivro,
          titulo: tituloLivro,
        });
      }
    } catch (erro) {
      console.error(
        "Erro ao devolver livro:",
        erro
      );

      alert(
        "Não foi possível registrar a devolução."
      );
    } finally {
      setDevolvendo(false);
    }
  }

  async function retornarLivroAoEstoque() {
    if (
      !livroApagadoDevolvido ||
      restaurandoLivro
    ) {
      return;
    }

    setRestaurandoLivro(true);

    try {
      const db = await obterBanco();

      await db.execute(
        `
          UPDATE livros
          SET ativo = 1,
              disponivel = CASE
                WHEN quantidade_total > (
                  SELECT COUNT(*)
                  FROM emprestimos
                  WHERE livro_codigo = $1
                    AND data_devolucao IS NULL
                ) THEN 1
                ELSE 0
              END
          WHERE codigo = $1
        `,
        [livroApagadoDevolvido.codigo]
      );

      setLivroApagadoDevolvido(null);

      await carregarDados();
    } catch (erro) {
      console.error(
        "Erro ao retornar livro ao estoque:",
        erro
      );

      alert(
        "Não foi possível retornar o livro ao estoque."
      );
    } finally {
      setRestaurandoLivro(false);
    }
  }

  function manterLivroForaDoEstoque() {
    if (restaurandoLivro) {
      return;
    }

    setLivroApagadoDevolvido(null);
  }

  function estaAtrasado(
    emprestimo: Emprestimo
  ) {
    return (
      emprestimo.data_devolucao === null &&
      emprestimo.data_prevista < hoje()
    );
  }

  function correspondeBusca(
    emprestimo: Emprestimo
  ) {
    const termo = normalizarTexto(busca);

    if (!termo) {
      return true;
    }

    return (
      normalizarTexto(
        emprestimo.pessoa_nome
      ).includes(termo) ||
      normalizarTexto(
        emprestimo.livro_codigo
      ).includes(termo) ||
      normalizarTexto(
        emprestimo.livro_titulo
      ).includes(termo)
    );
  }

  function correspondeStatus(
    emprestimo: Emprestimo
  ) {
    if (filtroStatus === "todos") {
      return true;
    }

    if (filtroStatus === "pendente") {
      return emprestimo.data_devolucao === null;
    }

    if (filtroStatus === "atrasado") {
      return estaAtrasado(emprestimo);
    }

    if (filtroStatus === "devolvido") {
      return emprestimo.data_devolucao !== null;
    }

    return true;
  }

  const emprestimosFiltrados =
    emprestimos.filter(
      (emprestimo) =>
        correspondeBusca(emprestimo) &&
        correspondeStatus(emprestimo)
    );

  const ativos =
    emprestimosFiltrados.filter(
      (emprestimo) =>
        emprestimo.data_devolucao === null
    );

  const historico =
    emprestimosFiltrados.filter(
      (emprestimo) =>
        emprestimo.data_devolucao !== null
    );

  const leitoresFiltrados = pessoas
    .filter((pessoa) => {
      const termo = normalizarTexto(buscaLeitor);

      if (!termo) {
        return true;
      }

      return (
        normalizarTexto(pessoa.nome).includes(termo) ||
        normalizarTexto(pessoa.telefone ?? "").includes(termo)
      );
    })
    .slice(0, 8);

  const leitorSelecionado = pessoas.find(
    (pessoa) => String(pessoa.id) === pessoaId
  );

  const livrosDisponiveis =
    livros.filter(
      (livro) => livro.quantidade_disponivel > 0
    );

  const livroSelecionado =
    livros.find(
      (livro) =>
        livro.codigo === livroCodigo
    );

  const mostrarSecaoAbertos =
    filtroStatus !== "devolvido";

  const mostrarSecaoHistorico =
    filtroStatus === "devolvido" ||
    (filtroStatus === "todos" &&
      mostrarHistorico);

  return (
    <>
      <section className="acoes acoes-emprestimos">
        <button
          onClick={abrirNovoEmprestimo}
        >
          + Novo empréstimo
        </button>

        <button
          className="botao-secundario"
          onClick={abrirDevolucaoPorCodigo}
        >
          Devolver livro
        </button>

        <button
          className="botao-secundario"
          onClick={() =>
            setMostrarHistorico(
              !mostrarHistorico
            )
          }
        >
          {mostrarHistorico
            ? "Ocultar histórico"
            : "Ver histórico"}
        </button>
      </section>

      <section className="filtros-emprestimos">
        <label className="filtro-emprestimos-busca">
          <span>Buscar</span>
          <div className="filtro-emprestimos-campo">
            <span
              className="filtro-emprestimos-icone"
              aria-hidden="true"
            >
              ⌕
            </span>
            <input
              type="search"
              value={busca}
              onChange={(e) =>
                setBusca(e.target.value)
              }
              placeholder="Buscar por leitor, código ou título do livro..."
              autoComplete="off"
            />
          </div>
        </label>

        <label className="filtro-emprestimos-status">
          <span>Status</span>
          <select
            value={filtroStatus}
            onChange={(e) =>
              setFiltroStatus(
                e.target
                  .value as FiltroStatus
              )
            }
          >
            <option value="todos">
              Todos
            </option>

            <option value="pendente">
              Pendente de devolução
            </option>

            <option value="atrasado">
              Atrasado
            </option>

            <option value="devolvido">
              Devolvido
            </option>
          </select>
        </label>
      </section>

      {mostrarFormulario && (
        <section className="formulario">
          <div className="formulario-topo">
            <h2>Novo empréstimo</h2>

            <button
              className="fechar"
              onClick={fecharFormulario}
            >
              ×
            </button>
          </div>

          <div className="campos campos-emprestimo">
            <label>
              Código de barras

              <input
                value={
                  codigoBarrasEmprestimo
                }
                onChange={(e) =>
                  setCodigoBarrasEmprestimo(
                    e.target.value
                  )
                }
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter"
                  ) {
                    e.preventDefault();
                    localizarLivroPorCodigoBarras();
                  }
                }}
                placeholder="Digite ou passe o livro no leitor"
                autoComplete="off"
                autoFocus
              />
            </label>

            <div className="campo-acao-emprestimo">
              <button
                type="button"
                className="botao-secundario"
                onClick={
                  localizarLivroPorCodigoBarras
                }
              >
                Localizar livro
              </button>
            </div>

            <label className="campo-leitor-pesquisavel">
              Leitor

              <input
                type="search"
                value={buscaLeitor}
                onChange={(e) => {
                  const valor = e.target.value;
                  setBuscaLeitor(valor);
                  setPessoaId("");
                  setMostrarResultadosLeitor(
                    valor.trim().length > 0
                  );
                }}
                onFocus={() =>
                  setMostrarResultadosLeitor(
                    buscaLeitor.trim().length > 0 &&
                      !pessoaId
                  )
                }
                onBlur={() => {
                  window.setTimeout(() => {
                    setMostrarResultadosLeitor(false);
                  }, 150);
                }}
                placeholder="Digite o nome ou telefone do leitor"
                autoComplete="off"
              />

              {leitorSelecionado && !mostrarResultadosLeitor && (
                <span className="leitor-selecionado">
                  Selecionado: {leitorSelecionado.nome}
                </span>
              )}

              {mostrarResultadosLeitor &&
                buscaLeitor.trim().length > 0 && (
                <div className="resultados-leitor">
                  {leitoresFiltrados.length === 0 ? (
                    <span className="resultado-leitor-vazio">
                      Nenhum leitor encontrado.
                    </span>
                  ) : (
                    leitoresFiltrados.map((pessoa) => (
                      <button
                        key={pessoa.id}
                        type="button"
                        className={
                          String(pessoa.id) === pessoaId
                            ? "resultado-leitor ativo"
                            : "resultado-leitor"
                        }
                        onClick={() => {
                          setPessoaId(String(pessoa.id));
                          setBuscaLeitor(pessoa.nome);
                          setMostrarResultadosLeitor(false);
                        }}
                      >
                        <strong>{pessoa.nome}</strong>
                        {pessoa.telefone && (
                          <span>{pessoa.telefone}</span>
                        )}
                      </button>
                    ))
                  )}
                </div>
              )}
            </label>

            <label>
              Livro

              <select
                value={livroCodigo}
                onChange={(e) => {
                  setLivroCodigo(
                    e.target.value
                  );

                  setMensagemCodigoBarras(
                    ""
                  );
                }}
              >
                <option value="">
                  Selecione...
                </option>

                {livrosDisponiveis.map(
                  (livro) => (
                    <option
                      key={livro.codigo}
                      value={livro.codigo}
                    >
                      {livro.codigo} —{" "}
                      {livro.titulo} —{" "}
                      {livro.quantidade_disponivel}{" "}
                      {livro.quantidade_disponivel === 1
                        ? "disponível"
                        : "disponíveis"}
                    </option>
                  )
                )}
              </select>
            </label>

            <label>
              Data do empréstimo

              <input
                type="date"
                value={dataEmprestimo}
                onChange={(e) =>
                  setDataEmprestimo(
                    e.target.value
                  )
                }
              />
            </label>

            <label>
              Previsão de devolução

              <input
                type="date"
                value={dataPrevista}
                onChange={(e) =>
                  setDataPrevista(
                    e.target.value
                  )
                }
              />
            </label>
          </div>

          {mensagemCodigoBarras && (
            <div className="resumo-devolucao">
              <span>
                {mensagemCodigoBarras}
              </span>
            </div>
          )}

          {livroSelecionado && (
            <div className="resumo-devolucao">
              <strong>
                {livroSelecionado.titulo}
              </strong>

              <span>
                Código interno:{" "}
                {
                  livroSelecionado.codigo
                }
              </span>

              <span>
                Código de barras:{" "}
                {livroSelecionado.codigo_barras ||
                  "—"}
              </span>

              <span>
                Autor:{" "}
                {
                  livroSelecionado.autor
                }
              </span>

              <span>
                Exemplares disponíveis:{" "}
                {livroSelecionado.quantidade_disponivel} de{" "}
                {livroSelecionado.quantidade_total}
              </span>
            </div>
          )}

          <div className="formulario-acoes">
            <button
              className="cancelar"
              onClick={fecharFormulario}
            >
              Cancelar
            </button>

            <button
              onClick={
                salvarEmprestimo
              }
            >
              Confirmar empréstimo
            </button>
          </div>
        </section>
      )}

      {mostrarDevolucaoCodigo && (
        <section className="formulario">
          <div className="formulario-topo">
            <h2>
              Devolver livro
            </h2>

            <button
              className="fechar"
              onClick={
                fecharDevolucaoPorCodigo
              }
            >
              ×
            </button>
          </div>

          <div className="campos">
            <label>
              Localizar livro

              <input
                value={
                  codigoBarrasDevolucao
                }
                onChange={(e) =>
                  setCodigoBarrasDevolucao(
                    e.target.value
                  )
                }
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter"
                  ) {
                    e.preventDefault();
                    localizarEmprestimoPorCodigoBarras();
                  }
                }}
                placeholder="Código de barras, código interno ou título"
                autoComplete="off"
                autoFocus
              />
            </label>

            <div className="campo-acao-emprestimo">
              <button
                type="button"
                className="botao-secundario"
                onClick={
                  localizarEmprestimoPorCodigoBarras
                }
              >
                Localizar empréstimo
              </button>
            </div>
          </div>

          {mensagemDevolucaoCodigo && (
            <div className="resumo-devolucao">
              <span>
                {
                  mensagemDevolucaoCodigo
                }
              </span>
            </div>
          )}

          {emprestimosCodigoBarras.length > 1 && (
            <div className="lista-devolucoes-codigo">
              {emprestimosCodigoBarras.map(
                (emprestimo) => (
                  <div
                    key={emprestimo.id}
                    className="resumo-devolucao"
                  >
                    <strong>
                      {emprestimo.livro_titulo}
                    </strong>

                    <span>
                      Código: {emprestimo.livro_codigo}
                    </span>

                    <span>
                      Leitor: {emprestimo.pessoa_nome}
                    </span>

                    <span>
                      Empréstimo:{" "}
                      {formatarData(
                        emprestimo.data_emprestimo
                      )}
                    </span>

                    <span>
                      Previsão:{" "}
                      {formatarData(
                        emprestimo.data_prevista
                      )}
                    </span>

                    <button
                      type="button"
                      className="botao-devolver"
                      onClick={() =>
                        setEmprestimoParaDevolver(
                          emprestimo
                        )
                      }
                    >
                      Selecionar devolução
                    </button>
                  </div>
                )
              )}
            </div>
          )}
        </section>
      )}

      {mostrarSecaoAbertos && (
        <section className="painel painel-emprestimos">
          <div className="painel-titulo">
            <h2>
              {filtroStatus ===
              "atrasado"
                ? "Empréstimos atrasados"
                : filtroStatus ===
                    "pendente"
                  ? "Pendentes de devolução"
                  : "Empréstimos em aberto"}
            </h2>

            <span className="contador">
              {ativos.length}{" "}
              {ativos.length === 1
                ? "livro"
                : "livros"}
            </span>
          </div>

          <table className="tabela-emprestimos">
            <thead>
              <tr>
                <th>Leitor</th>
                <th>Livro</th>
                <th>Empréstimo</th>
                <th>Previsão</th>
                <th>Status</th>
                <th>Ação</th>
              </tr>
            </thead>

            <tbody>
              {ativos.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    {busca ||
                    filtroStatus !==
                      "todos"
                      ? "Nenhum empréstimo encontrado para os filtros selecionados."
                      : "Nenhum empréstimo em aberto."}
                  </td>
                </tr>
              ) : (
                ativos.map(
                  (emprestimo) => {
                    const atrasado =
                      estaAtrasado(
                        emprestimo
                      );

                    return (
                      <tr
                        key={
                          emprestimo.id
                        }
                      >
                        <td>
                          {
                            emprestimo.pessoa_nome
                          }
                        </td>

                        <td>
                          {
                            emprestimo.livro_codigo
                          }{" "}
                          —{" "}
                          {
                            emprestimo.livro_titulo
                          }
                        </td>

                        <td>
                          {formatarData(
                            emprestimo.data_emprestimo
                          )}
                        </td>

                        <td>
                          {formatarData(
                            emprestimo.data_prevista
                          )}
                        </td>

                        <td>
                          <span
                            className={
                              atrasado
                                ? "status-atrasado"
                                : "emprestado"
                            }
                          >
                            {atrasado
                              ? "Atrasado"
                              : "Pendente"}
                          </span>
                        </td>

                        <td>
                          <button
                            className="botao-devolver"
                            onClick={() =>
                              solicitarDevolucao(
                                emprestimo
                              )
                            }
                          >
                            Devolver
                          </button>
                        </td>
                      </tr>
                    );
                  }
                )
              )}
            </tbody>
          </table>
        </section>
      )}

      {mostrarSecaoHistorico && (
        <section className="painel painel-historico painel-emprestimos">
          <h2>
            Histórico de devoluções
          </h2>

          <table className="tabela-emprestimos tabela-historico-emprestimos">
            <thead>
              <tr>
                <th>Leitor</th>
                <th>Livro</th>
                <th>Empréstimo</th>
                <th>Previsto</th>
                <th>Devolvido em</th>
                <th>Status</th>
              </tr>
            </thead>

            <tbody>
              {historico.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    {busca ||
                    filtroStatus !==
                      "todos"
                      ? "Nenhum registro encontrado para os filtros selecionados."
                      : "Nenhuma devolução registrada."}
                  </td>
                </tr>
              ) : (
                historico.map(
                  (emprestimo) => (
                    <tr
                      key={
                        emprestimo.id
                      }
                    >
                      <td>
                        {
                          emprestimo.pessoa_nome
                        }
                      </td>

                      <td>
                        {
                          emprestimo.livro_codigo
                        }{" "}
                        —{" "}
                        {
                          emprestimo.livro_titulo
                        }
                      </td>

                      <td>
                        {formatarData(
                          emprestimo.data_emprestimo
                        )}
                      </td>

                      <td>
                        {formatarData(
                          emprestimo.data_prevista
                        )}
                      </td>

                      <td>
                        {formatarData(
                          emprestimo.data_devolucao
                        )}
                      </td>

                      <td>
                        <span className="disponivel">
                          Devolvido
                        </span>
                      </td>
                    </tr>
                  )
                )
              )}
            </tbody>
          </table>
        </section>
      )}

      {emprestimoParaDevolver && (
        <div className="modal-fundo">
          <div className="modal">
            <h2>
              Confirmar devolução
            </h2>

            <p>
              Você está registrando a
              devolução de:
            </p>

            <div className="resumo-devolucao">
              <strong>
                {
                  emprestimoParaDevolver.livro_titulo
                }
              </strong>

              <span>
                Código:{" "}
                {
                  emprestimoParaDevolver.livro_codigo
                }
              </span>

              <span>
                Leitor:{" "}
                {
                  emprestimoParaDevolver.pessoa_nome
                }
              </span>

              <span>
                Data da devolução:{" "}
                {formatarData(hoje())}
              </span>
            </div>

            <p>
              Confirme para registrar a
              devolução.
            </p>

            <div className="modal-acoes">
              <button
                className="cancelar-modal"
                onClick={
                  cancelarDevolucao
                }
                disabled={devolvendo}
              >
                Cancelar
              </button>

              <button
                className="confirmar-devolucao"
                onClick={
                  confirmarDevolucao
                }
                disabled={devolvendo}
              >
                {devolvendo
                  ? "Registrando..."
                  : "Confirmar devolução"}
              </button>
            </div>
          </div>
        </div>
      )}

      {livroApagadoDevolvido && (
        <div className="modal-fundo">
          <div className="modal">
            <h2>Livro devolvido</h2>

            <p>
              <strong>
                Esse livro foi devolvido.
              </strong>
            </p>

            <p>
              Anteriormente ele foi
              apagado. Deseja retornar ao
              estoque esse livro?
            </p>

            <div className="resumo-devolucao">
              <strong>
                {
                  livroApagadoDevolvido.titulo
                }
              </strong>

              <span>
                Código:{" "}
                {
                  livroApagadoDevolvido.codigo
                }
              </span>
            </div>

            <div className="modal-acoes">
              <button
                className="cancelar-modal"
                onClick={
                  manterLivroForaDoEstoque
                }
                disabled={
                  restaurandoLivro
                }
              >
                Não
              </button>

              <button
                className="confirmar-devolucao"
                onClick={
                  retornarLivroAoEstoque
                }
                disabled={
                  restaurandoLivro
                }
              >
                {restaurandoLivro
                  ? "Retornando..."
                  : "Sim, retornar ao estoque"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default Emprestimos;