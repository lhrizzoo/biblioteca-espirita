import { useEffect, useState } from "react";
import { obterBanco } from "../database/database";
import type { Livro, LivroBanco } from "../types";

function Livros() {
  const [livros, setLivros] = useState<Livro[]>([]);
  const [pesquisa, setPesquisa] = useState("");
  const [mostrarFormulario, setMostrarFormulario] = useState(false);

  const [codigo, setCodigo] = useState("");
  const [titulo, setTitulo] = useState("");
  const [autor, setAutor] = useState("");
  const [codigoOriginal, setCodigoOriginal] = useState<string | null>(null);

  const editando = codigoOriginal !== null;

  async function carregarLivros() {
    try {
      const db = await obterBanco();

      const registros = await db.select<LivroBanco[]>(`
        SELECT codigo, titulo, autor, disponivel
        FROM livros
        ORDER BY titulo
      `);

      setLivros(
        registros.map((livro) => ({
          codigo: livro.codigo,
          titulo: livro.titulo,
          autor: livro.autor,
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
    setTitulo("");
    setAutor("");
    setCodigoOriginal(null);
  }

  function abrirNovoLivro() {
    limparFormulario();
    setMostrarFormulario(true);
  }

  function abrirEdicao(livro: Livro) {
    setCodigoOriginal(livro.codigo);
    setCodigo(livro.codigo);
    setTitulo(livro.titulo);
    setAutor(livro.autor);
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

      if (editando) {
        await db.execute(
          `
            UPDATE livros
            SET codigo = $1, titulo = $2, autor = $3
            WHERE codigo = $4
          `,
          [codigo.trim(), titulo.trim(), autor.trim(), codigoOriginal]
        );
      } else {
        await db.execute(
          `
            INSERT INTO livros (codigo, titulo, autor, disponivel)
            VALUES ($1, $2, $3, 1)
          `,
          [codigo.trim(), titulo.trim(), autor.trim()]
        );
      }

      fecharFormulario();
      await carregarLivros();
    } catch (erro) {
      console.error("Erro ao salvar livro:", erro);
      alert(
        "Não foi possível salvar o livro. Verifique se o código já está sendo utilizado."
      );
    }
  }

  const termo = pesquisa.trim().toLowerCase();

  const livrosFiltrados = livros.filter((livro) => {
    if (!termo) return true;

    return (
      livro.codigo.toLowerCase().includes(termo) ||
      livro.titulo.toLowerCase().includes(termo) ||
      livro.autor.toLowerCase().includes(termo)
    );
  });

  return (
    <>
      <section className="acoes">
        <button onClick={abrirNovoLivro}>+ Cadastrar livro</button>
      </section>

      {mostrarFormulario && (
        <section className="formulario">
          <div className="formulario-topo">
            <h2>{editando ? "Editar livro" : "Cadastrar livro"}</h2>

            <button className="fechar" onClick={fecharFormulario}>
              ×
            </button>
          </div>

          <div className="campos">
            <label>
              Código
              <input
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                placeholder="Ex.: 003"
              />
            </label>

            <label>
              Título
              <input
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Nome do livro"
              />
            </label>

            <label>
              Autor
              <input
                value={autor}
                onChange={(e) => setAutor(e.target.value)}
                placeholder="Nome do autor"
              />
            </label>
          </div>

          <div className="formulario-acoes">
            <button className="cancelar" onClick={fecharFormulario}>
              Cancelar
            </button>

            <button onClick={salvarLivro}>
              {editando ? "Salvar alterações" : "Salvar livro"}
            </button>
          </div>
        </section>
      )}

      <section className="pesquisa">
        <input
          value={pesquisa}
          onChange={(e) => setPesquisa(e.target.value)}
          placeholder="Pesquisar por código, título ou autor..."
        />
      </section>

      <section className="painel">
        <h2>Acervo</h2>

        <table>
          <thead>
            <tr>
              <th>Código</th>
              <th>Livro</th>
              <th>Autor</th>
              <th>Situação</th>
              <th>Com quem está</th>
              <th>Ações</th>
            </tr>
          </thead>

          <tbody>
            {livrosFiltrados.length === 0 ? (
              <tr>
                <td colSpan={6}>
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
                />
              ))
            )}
          </tbody>
        </table>
      </section>
    </>
  );
}

function LinhaLivro({
  livro,
  abrirEdicao,
}: {
  livro: Livro;
  abrirEdicao: (livro: Livro) => void;
}) {
  const [emprestadoPara, setEmprestadoPara] = useState<string>("");

  useEffect(() => {
    async function buscarPessoa() {
      if (livro.disponivel) {
        setEmprestadoPara("");
        return;
      }

      try {
        const db = await obterBanco();

        const resultado = await db.select<{ nome: string }[]>(`
          SELECT p.nome
          FROM emprestimos e
          INNER JOIN pessoas p ON p.id = e.pessoa_id
          WHERE e.livro_codigo = '${livro.codigo.replaceAll("'", "''")}'
            AND e.data_devolucao IS NULL
          ORDER BY e.id DESC
          LIMIT 1
        `);

        setEmprestadoPara(resultado[0]?.nome ?? "Não identificado");
      } catch (erro) {
        console.error("Erro ao localizar empréstimo:", erro);
        setEmprestadoPara("Não identificado");
      }
    }

    buscarPessoa();
  }, [livro.codigo, livro.disponivel]);

  return (
    <tr>
      <td>{livro.codigo}</td>
      <td>{livro.titulo}</td>
      <td>{livro.autor}</td>

      <td>
        <span className={livro.disponivel ? "disponivel" : "emprestado"}>
          {livro.disponivel ? "Disponível" : "Emprestado"}
        </span>
      </td>

      <td>{livro.disponivel ? "—" : emprestadoPara || "Carregando..."}</td>

      <td>
        <button className="botao-editar" onClick={() => abrirEdicao(livro)}>
          Editar
        </button>
      </td>
    </tr>
  );
}

export default Livros;