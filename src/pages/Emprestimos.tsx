import { useEffect, useState } from "react";
import { obterBanco } from "../database/database";
import type { Emprestimo, Livro, LivroBanco, Pessoa } from "../types";

function hoje() {
  return new Date().toISOString().split("T")[0];
}

function daquiADias(dias: number) {
  const data = new Date();
  data.setDate(data.getDate() + dias);
  return data.toISOString().split("T")[0];
}

function formatarData(data: string | null) {
  if (!data) return "—";

  const [ano, mes, dia] = data.split("-");
  return `${dia}/${mes}/${ano}`;
}

function Emprestimos() {
  const [emprestimos, setEmprestimos] = useState<Emprestimo[]>([]);
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [livros, setLivros] = useState<Livro[]>([]);

  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [mostrarHistorico, setMostrarHistorico] = useState(false);

  const [mostrarDevolucaoCodigo, setMostrarDevolucaoCodigo] =
    useState(false);

  const [pessoaId, setPessoaId] = useState("");
  const [livroCodigo, setLivroCodigo] = useState("");

  const [codigoBarrasEmprestimo, setCodigoBarrasEmprestimo] =
    useState("");

  const [mensagemCodigoBarras, setMensagemCodigoBarras] =
    useState("");

  const [codigoBarrasDevolucao, setCodigoBarrasDevolucao] =
    useState("");

  const [mensagemDevolucaoCodigo, setMensagemDevolucaoCodigo] =
    useState("");

  const [dataEmprestimo, setDataEmprestimo] = useState(hoje());
  const [dataPrevista, setDataPrevista] = useState(daquiADias(14));

  const [emprestimoParaDevolver, setEmprestimoParaDevolver] =
    useState<Emprestimo | null>(null);

  const [devolvendo, setDevolvendo] = useState(false);

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
        ORDER BY titulo
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
          disponivel: livro.disponivel === 1,
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
    setLivroCodigo("");
    setCodigoBarrasEmprestimo("");
    setMensagemCodigoBarras("");
  }

  function abrirDevolucaoPorCodigo() {
    setCodigoBarrasDevolucao("");
    setMensagemDevolucaoCodigo("");
    setMostrarDevolucaoCodigo(true);
  }

  function fecharDevolucaoPorCodigo() {
    setMostrarDevolucaoCodigo(false);
    setCodigoBarrasDevolucao("");
    setMensagemDevolucaoCodigo("");
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
          WHERE codigo_barras = $1
          LIMIT 1
        `,
        [codigo]
      );

      if (resultado.length === 0) {
        setMensagemCodigoBarras(
          "Nenhum livro foi encontrado com este código de barras."
        );
        return;
      }

      const livro = resultado[0];

      if (livro.disponivel !== 1) {
        setMensagemCodigoBarras(
          `O livro "${livro.titulo}" já está emprestado.`
        );
        return;
      }

      setLivroCodigo(livro.codigo);

      setMensagemCodigoBarras(
        `Livro localizado: ${livro.codigo} — ${livro.titulo}`
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
    const codigo = codigoBarrasDevolucao.trim();

    setMensagemDevolucaoCodigo("");

    if (!codigo) {
      setMensagemDevolucaoCodigo(
        "Digite ou passe um código de barras no leitor."
      );
      return;
    }

    try {
      const db = await obterBanco();

      const livroEncontrado = await db.select<
        { codigo: string; titulo: string }[]
      >(
        `
          SELECT codigo, titulo
          FROM livros
          WHERE codigo_barras = $1
          LIMIT 1
        `,
        [codigo]
      );

      if (livroEncontrado.length === 0) {
        setMensagemDevolucaoCodigo(
          "Nenhum livro foi encontrado com este código de barras."
        );
        return;
      }

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
          WHERE l.codigo_barras = $1
            AND e.data_devolucao IS NULL
          ORDER BY e.id DESC
          LIMIT 1
        `,
        [codigo]
      );

      if (resultado.length === 0) {
        setMensagemDevolucaoCodigo(
          `O livro "${livroEncontrado[0].titulo}" não possui empréstimo ativo.`
        );
        return;
      }

      const emprestimo = resultado[0];

      setMensagemDevolucaoCodigo(
        `Livro localizado: ${emprestimo.livro_titulo} — emprestado para ${emprestimo.pessoa_nome}.`
      );

      setEmprestimoParaDevolver(emprestimo);
    } catch (erro) {
      console.error(
        "Erro ao localizar empréstimo pelo código de barras:",
        erro
      );

      setMensagemDevolucaoCodigo(
        "Não foi possível localizar o empréstimo."
      );
    }
  }

  async function salvarEmprestimo() {
    if (!pessoaId || !livroCodigo || !dataEmprestimo || !dataPrevista) {
      alert("Preencha todos os dados do empréstimo.");
      return;
    }

    if (dataPrevista < dataEmprestimo) {
      alert(
        "A previsão de devolução não pode ser anterior à data do empréstimo."
      );
      return;
    }

    try {
      const db = await obterBanco();

      const disponibilidade = await db.select<{ disponivel: number }[]>(
        `
          SELECT disponivel
          FROM livros
          WHERE codigo = $1
        `,
        [livroCodigo]
      );

      if (
        disponibilidade.length === 0 ||
        disponibilidade[0].disponivel !== 1
      ) {
        alert("Este livro não está disponível para empréstimo.");
        await carregarDados();
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
            SET disponivel = 0
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
      console.error("Erro ao registrar empréstimo:", erro);
      alert("Não foi possível registrar o empréstimo.");
    }
  }

  function solicitarDevolucao(emprestimo: Emprestimo) {
    setEmprestimoParaDevolver(emprestimo);
  }

  function cancelarDevolucao() {
    if (devolvendo) return;
    setEmprestimoParaDevolver(null);
  }

  async function confirmarDevolucao() {
    if (!emprestimoParaDevolver || devolvendo) return;

    setDevolvendo(true);

    try {
      const db = await obterBanco();

      await db.execute("BEGIN TRANSACTION");

      try {
        await db.execute(
          `
            UPDATE emprestimos
            SET data_devolucao = $1
            WHERE id = $2
              AND data_devolucao IS NULL
          `,
          [hoje(), emprestimoParaDevolver.id]
        );

        await db.execute(
          `
            UPDATE livros
            SET disponivel = 1
            WHERE codigo = $1
          `,
          [emprestimoParaDevolver.livro_codigo]
        );

        await db.execute("COMMIT");
      } catch (erro) {
        await db.execute("ROLLBACK");
        throw erro;
      }

      setEmprestimoParaDevolver(null);
      setMostrarDevolucaoCodigo(false);
      setCodigoBarrasDevolucao("");
      setMensagemDevolucaoCodigo("");

      await carregarDados();
    } catch (erro) {
      console.error("Erro ao devolver livro:", erro);
      alert("Não foi possível registrar a devolução.");
    } finally {
      setDevolvendo(false);
    }
  }

  const ativos = emprestimos.filter(
    (emprestimo) => emprestimo.data_devolucao === null
  );

  const historico = emprestimos.filter(
    (emprestimo) => emprestimo.data_devolucao !== null
  );

  const livrosDisponiveis = livros.filter((livro) => livro.disponivel);

  const livroSelecionado = livros.find(
    (livro) => livro.codigo === livroCodigo
  );

  function estaAtrasado(emprestimo: Emprestimo) {
    return (
      emprestimo.data_devolucao === null &&
      emprestimo.data_prevista < hoje()
    );
  }

  return (
    <>
      <section className="acoes">
        <button onClick={abrirNovoEmprestimo}>
          + Novo empréstimo
        </button>

        <button
          className="botao-secundario"
          onClick={abrirDevolucaoPorCodigo}
        >
          Devolver por código de barras
        </button>

        <button
          className="botao-secundario"
          onClick={() => setMostrarHistorico(!mostrarHistorico)}
        >
          {mostrarHistorico ? "Ocultar histórico" : "Ver histórico"}
        </button>
      </section>

      {mostrarFormulario && (
        <section className="formulario">
          <div className="formulario-topo">
            <h2>Novo empréstimo</h2>

            <button className="fechar" onClick={fecharFormulario}>
              ×
            </button>
          </div>

          <div className="campos campos-emprestimo">
            <label>
              Código de barras
              <input
                value={codigoBarrasEmprestimo}
                onChange={(e) =>
                  setCodigoBarrasEmprestimo(e.target.value)
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    localizarLivroPorCodigoBarras();
                  }
                }}
                placeholder="Digite ou passe o livro no leitor"
                autoComplete="off"
                autoFocus
              />
            </label>

            <div
              style={{
                display: "flex",
                alignItems: "end",
              }}
            >
              <button
                type="button"
                className="botao-secundario"
                onClick={localizarLivroPorCodigoBarras}
              >
                Localizar livro
              </button>
            </div>

            <label>
              Leitor
              <select
                value={pessoaId}
                onChange={(e) => setPessoaId(e.target.value)}
              >
                <option value="">Selecione...</option>

                {pessoas.map((pessoa) => (
                  <option key={pessoa.id} value={pessoa.id}>
                    {pessoa.nome}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Livro
              <select
                value={livroCodigo}
                onChange={(e) => {
                  setLivroCodigo(e.target.value);
                  setMensagemCodigoBarras("");
                }}
              >
                <option value="">Selecione...</option>

                {livrosDisponiveis.map((livro) => (
                  <option key={livro.codigo} value={livro.codigo}>
                    {livro.codigo} — {livro.titulo}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Data do empréstimo
              <input
                type="date"
                value={dataEmprestimo}
                onChange={(e) => setDataEmprestimo(e.target.value)}
              />
            </label>

            <label>
              Previsão de devolução
              <input
                type="date"
                value={dataPrevista}
                onChange={(e) => setDataPrevista(e.target.value)}
              />
            </label>
          </div>

          {mensagemCodigoBarras && (
            <div className="resumo-devolucao">
              <span>{mensagemCodigoBarras}</span>
            </div>
          )}

          {livroSelecionado && (
            <div className="resumo-devolucao">
              <strong>{livroSelecionado.titulo}</strong>

              <span>
                Código interno: {livroSelecionado.codigo}
              </span>

              <span>
                Código de barras:{" "}
                {livroSelecionado.codigo_barras || "—"}
              </span>

              <span>Autor: {livroSelecionado.autor}</span>

              <span>
                Situação:{" "}
                {livroSelecionado.disponivel
                  ? "Disponível"
                  : "Emprestado"}
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

            <button onClick={salvarEmprestimo}>
              Confirmar empréstimo
            </button>
          </div>
        </section>
      )}

      {mostrarDevolucaoCodigo && (
        <section className="formulario">
          <div className="formulario-topo">
            <h2>Devolver por código de barras</h2>

            <button
              className="fechar"
              onClick={fecharDevolucaoPorCodigo}
            >
              ×
            </button>
          </div>

          <div className="campos">
            <label>
              Código de barras
              <input
                value={codigoBarrasDevolucao}
                onChange={(e) =>
                  setCodigoBarrasDevolucao(e.target.value)
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    localizarEmprestimoPorCodigoBarras();
                  }
                }}
                placeholder="Digite ou passe o livro no leitor"
                autoComplete="off"
                autoFocus
              />
            </label>

            <div
              style={{
                display: "flex",
                alignItems: "end",
              }}
            >
              <button
                type="button"
                className="botao-secundario"
                onClick={localizarEmprestimoPorCodigoBarras}
              >
                Localizar empréstimo
              </button>
            </div>
          </div>

          {mensagemDevolucaoCodigo && (
            <div className="resumo-devolucao">
              <span>{mensagemDevolucaoCodigo}</span>
            </div>
          )}
        </section>
      )}

      <section className="painel">
        <div className="painel-titulo">
          <h2>Empréstimos em aberto</h2>

          <span className="contador">
            {ativos.length} {ativos.length === 1 ? "livro" : "livros"}
          </span>
        </div>

        <table>
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
                  Nenhum empréstimo em aberto.
                </td>
              </tr>
            ) : (
              ativos.map((emprestimo) => {
                const atrasado = estaAtrasado(emprestimo);

                return (
                  <tr key={emprestimo.id}>
                    <td>{emprestimo.pessoa_nome}</td>

                    <td>
                      {emprestimo.livro_codigo} —{" "}
                      {emprestimo.livro_titulo}
                    </td>

                    <td>
                      {formatarData(emprestimo.data_emprestimo)}
                    </td>

                    <td>
                      {formatarData(emprestimo.data_prevista)}
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
                          : "Emprestado"}
                      </span>
                    </td>

                    <td>
                      <button
                        className="botao-devolver"
                        onClick={() =>
                          solicitarDevolucao(emprestimo)
                        }
                      >
                        Devolver
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </section>

      {mostrarHistorico && (
        <section className="painel painel-historico">
          <h2>Histórico de devoluções</h2>

          <table>
            <thead>
              <tr>
                <th>Leitor</th>
                <th>Livro</th>
                <th>Empréstimo</th>
                <th>Previsto</th>
                <th>Devolvido em</th>
              </tr>
            </thead>

            <tbody>
              {historico.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    Nenhuma devolução registrada.
                  </td>
                </tr>
              ) : (
                historico.map((emprestimo) => (
                  <tr key={emprestimo.id}>
                    <td>{emprestimo.pessoa_nome}</td>

                    <td>
                      {emprestimo.livro_codigo} —{" "}
                      {emprestimo.livro_titulo}
                    </td>

                    <td>
                      {formatarData(emprestimo.data_emprestimo)}
                    </td>

                    <td>
                      {formatarData(emprestimo.data_prevista)}
                    </td>

                    <td>
                      {formatarData(emprestimo.data_devolucao)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>
      )}

      {emprestimoParaDevolver && (
        <div className="modal-fundo">
          <div className="modal">
            <h2>Confirmar devolução</h2>

            <p>Você está registrando a devolução de:</p>

            <div className="resumo-devolucao">
              <strong>
                {emprestimoParaDevolver.livro_titulo}
              </strong>

              <span>
                Código:{" "}
                {emprestimoParaDevolver.livro_codigo}
              </span>

              <span>
                Leitor:{" "}
                {emprestimoParaDevolver.pessoa_nome}
              </span>

              <span>
                Data da devolução: {formatarData(hoje())}
              </span>
            </div>

            <p>
              Após confirmar, o livro ficará disponível
              novamente para empréstimo.
            </p>

            <div className="modal-acoes">
              <button
                className="cancelar-modal"
                onClick={cancelarDevolucao}
                disabled={devolvendo}
              >
                Cancelar
              </button>

              <button
                className="confirmar-devolucao"
                onClick={confirmarDevolucao}
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
    </>
  );
}

export default Emprestimos;