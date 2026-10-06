import { useEffect, useState } from "react";
import { obterBanco } from "../database/database";
import type { Pessoa } from "../types";

function Pessoas() {
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [pesquisa, setPesquisa] = useState("");
  const [mostrarFormulario, setMostrarFormulario] = useState(false);

  const [idEditando, setIdEditando] = useState<number | null>(null);
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [observacao, setObservacao] = useState("");

  const [pessoaParaExcluir, setPessoaParaExcluir] =
    useState<Pessoa | null>(null);

  const [excluindo, setExcluindo] = useState(false);
  const [mensagem, setMensagem] = useState("");

  const editando = idEditando !== null;

  async function carregarPessoas() {
    try {
      const db = await obterBanco();

      const registros = await db.select<Pessoa[]>(`
        SELECT id, nome, telefone, observacao
        FROM pessoas
        ORDER BY nome
      `);

      setPessoas(registros);
    } catch (erro) {
      console.error("Erro ao carregar leitores:", erro);
    }
  }

  useEffect(() => {
    carregarPessoas();
  }, []);

  function limparFormulario() {
    setIdEditando(null);
    setNome("");
    setTelefone("");
    setObservacao("");
  }

  function abrirNovoLeitor() {
    limparFormulario();
    setMensagem("");
    setMostrarFormulario(true);
  }

  function abrirEdicao(pessoa: Pessoa) {
    setIdEditando(pessoa.id);
    setNome(pessoa.nome);
    setTelefone(pessoa.telefone);
    setObservacao(pessoa.observacao);
    setMensagem("");
    setMostrarFormulario(true);
  }

  function fecharFormulario() {
    limparFormulario();
    setMostrarFormulario(false);
  }

  async function salvarLeitor() {
    if (!nome.trim()) {
      setMensagem("Informe o nome do leitor.");
      return;
    }

    try {
      const db = await obterBanco();

      if (editando) {
        await db.execute(
          `
            UPDATE pessoas
            SET nome = $1, telefone = $2, observacao = $3
            WHERE id = $4
          `,
          [
            nome.trim(),
            telefone.trim(),
            observacao.trim(),
            idEditando,
          ]
        );

        setMensagem("Leitor atualizado com sucesso.");
      } else {
        await db.execute(
          `
            INSERT INTO pessoas (nome, telefone, observacao)
            VALUES ($1, $2, $3)
          `,
          [nome.trim(), telefone.trim(), observacao.trim()]
        );

        setMensagem("Leitor cadastrado com sucesso.");
      }

      fecharFormulario();
      await carregarPessoas();
    } catch (erro) {
      console.error("Erro ao salvar leitor:", erro);
      setMensagem("Não foi possível salvar o leitor.");
    }
  }

  async function solicitarExclusao(pessoa: Pessoa) {
    try {
      setMensagem("");

      const db = await obterBanco();

      const resultado = await db.select<{ total: number }[]>(
        `
          SELECT COUNT(*) AS total
          FROM emprestimos
          WHERE pessoa_id = $1
        `,
        [pessoa.id]
      );

      const totalEmprestimos = Number(resultado[0]?.total ?? 0);

      if (totalEmprestimos > 0) {
        setMensagem(
          "Este leitor não pode ser excluído porque possui empréstimos ou histórico registrados."
        );
        return;
      }

      setPessoaParaExcluir(pessoa);
    } catch (erro) {
      console.error("Erro ao verificar leitor:", erro);
      setMensagem(
        "Não foi possível verificar se o leitor pode ser excluído."
      );
    }
  }

  function cancelarExclusao() {
    if (excluindo) {
      return;
    }

    setPessoaParaExcluir(null);
  }

  async function confirmarExclusao() {
    if (!pessoaParaExcluir || excluindo) {
      return;
    }

    try {
      setExcluindo(true);
      setMensagem("");

      const db = await obterBanco();

      await db.execute(
        `
          DELETE FROM pessoas
          WHERE id = $1
        `,
        [pessoaParaExcluir.id]
      );

      setPessoaParaExcluir(null);

      setMensagem("Leitor excluído com sucesso.");

      await carregarPessoas();
    } catch (erro) {
      console.error("Erro ao excluir leitor:", erro);
      setMensagem("Não foi possível excluir o leitor.");
    } finally {
      setExcluindo(false);
    }
  }

  const termo = pesquisa.trim().toLowerCase();

  const pessoasFiltradas = pessoas.filter((pessoa) => {
    if (!termo) {
      return true;
    }

    return (
      pessoa.nome.toLowerCase().includes(termo) ||
      pessoa.telefone.toLowerCase().includes(termo) ||
      pessoa.observacao.toLowerCase().includes(termo)
    );
  });

  return (
    <>
      <section className="acoes">
        <button onClick={abrirNovoLeitor}>
          + Cadastrar leitor
        </button>
      </section>

      {mensagem && (
        <section className="formulario">
          <p>{mensagem}</p>
        </section>
      )}

      {mostrarFormulario && (
        <section className="formulario">
          <div className="formulario-topo">
            <h2>
              {editando
                ? "Editar leitor"
                : "Cadastrar leitor"}
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
              Nome
              <input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Nome completo"
              />
            </label>

            <label>
              Telefone
              <input
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                placeholder="Telefone"
              />
            </label>

            <label>
              Observação
              <input
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                placeholder="Opcional"
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

            <button onClick={salvarLeitor}>
              {editando
                ? "Salvar alterações"
                : "Salvar leitor"}
            </button>
          </div>
        </section>
      )}

      <section className="pesquisa">
        <input
          value={pesquisa}
          onChange={(e) => setPesquisa(e.target.value)}
          placeholder="Pesquisar por nome, telefone ou observação..."
        />
      </section>

      <section className="painel">
        <h2>Leitores</h2>

        <table>
          <thead>
            <tr>
              <th>Nome</th>
              <th>Telefone</th>
              <th>Observação</th>
              <th>Ações</th>
            </tr>
          </thead>

          <tbody>
            {pessoasFiltradas.length === 0 ? (
              <tr>
                <td colSpan={4}>
                  {pesquisa.trim()
                    ? "Nenhum leitor encontrado."
                    : "Nenhum leitor cadastrado."}
                </td>
              </tr>
            ) : (
              pessoasFiltradas.map((pessoa) => (
                <tr key={pessoa.id}>
                  <td>{pessoa.nome}</td>
                  <td>{pessoa.telefone || "—"}</td>
                  <td>{pessoa.observacao || "—"}</td>

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
                        onClick={() => abrirEdicao(pessoa)}
                      >
                        Editar
                      </button>

                      <button
                        className="botao-devolver"
                        onClick={() =>
                          solicitarExclusao(pessoa)
                        }
                      >
                        Excluir
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      {pessoaParaExcluir && (
        <div className="modal-fundo">
          <div className="modal">
            <h2>Excluir leitor</h2>

            <p>
              Tem certeza de que deseja excluir este leitor?
            </p>

            <div className="resumo-devolucao">
              <strong>{pessoaParaExcluir.nome}</strong>

              <span>
                Telefone:{" "}
                {pessoaParaExcluir.telefone || "Não informado"}
              </span>
            </div>

            <p>
              Esta ação não poderá ser desfeita.
            </p>

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
                  ? "Excluindo..."
                  : "Confirmar exclusão"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default Pessoas;