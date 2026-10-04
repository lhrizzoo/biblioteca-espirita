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
      console.error("Erro ao carregar pessoas:", erro);
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

  function abrirNovaPessoa() {
    limparFormulario();
    setMostrarFormulario(true);
  }

  function abrirEdicao(pessoa: Pessoa) {
    setIdEditando(pessoa.id);
    setNome(pessoa.nome);
    setTelefone(pessoa.telefone);
    setObservacao(pessoa.observacao);
    setMostrarFormulario(true);
  }

  function fecharFormulario() {
    limparFormulario();
    setMostrarFormulario(false);
  }

  async function salvarPessoa() {
    if (!nome.trim()) {
      alert("Informe o nome da pessoa.");
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
      } else {
        await db.execute(
          `
            INSERT INTO pessoas (nome, telefone, observacao)
            VALUES ($1, $2, $3)
          `,
          [nome.trim(), telefone.trim(), observacao.trim()]
        );
      }

      fecharFormulario();
      await carregarPessoas();
    } catch (erro) {
      console.error("Erro ao salvar pessoa:", erro);
      alert("Não foi possível salvar a pessoa.");
    }
  }

  const termo = pesquisa.trim().toLowerCase();

  const pessoasFiltradas = pessoas.filter((pessoa) => {
    if (!termo) return true;

    return (
      pessoa.nome.toLowerCase().includes(termo) ||
      pessoa.telefone.toLowerCase().includes(termo) ||
      pessoa.observacao.toLowerCase().includes(termo)
    );
  });

  return (
    <>
      <section className="acoes">
        <button onClick={abrirNovaPessoa}>+ Cadastrar pessoa</button>
      </section>

      {mostrarFormulario && (
        <section className="formulario">
          <div className="formulario-topo">
            <h2>{editando ? "Editar pessoa" : "Cadastrar pessoa"}</h2>

            <button className="fechar" onClick={fecharFormulario}>
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
            <button className="cancelar" onClick={fecharFormulario}>
              Cancelar
            </button>

            <button onClick={salvarPessoa}>
              {editando ? "Salvar alterações" : "Salvar pessoa"}
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
        <h2>Pessoas</h2>

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
                    ? "Nenhuma pessoa encontrada."
                    : "Nenhuma pessoa cadastrada."}
                </td>
              </tr>
            ) : (
              pessoasFiltradas.map((pessoa) => (
                <tr key={pessoa.id}>
                  <td>{pessoa.nome}</td>
                  <td>{pessoa.telefone || "—"}</td>
                  <td>{pessoa.observacao || "—"}</td>

                  <td>
                    <button
                      className="botao-editar"
                      onClick={() => abrirEdicao(pessoa)}
                    >
                      Editar
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </>
  );
}

export default Pessoas;