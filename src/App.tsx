import "./App.css";

function App() {
  return (
    <div className="app">
      <header className="topo">
        <div>
          <h1>Biblioteca Espírita</h1>
          <p>Controle de acervo e empréstimos</p>
        </div>
      </header>

      <main className="conteudo">
        <section className="acoes">
          <button>+ Cadastrar livro</button>
          <button>+ Novo empréstimo</button>
        </section>

        <section className="pesquisa">
          <input
            type="text"
            placeholder="Pesquisar livro por título ou autor..."
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
              </tr>
            </thead>

            <tbody>
              <tr>
                <td>001</td>
                <td>Nosso Lar</td>
                <td>Chico Xavier</td>
                <td>
                  <span className="disponivel">Disponível</span>
                </td>
              </tr>

              <tr>
                <td>002</td>
                <td>O Livro dos Espíritos</td>
                <td>Allan Kardec</td>
                <td>
                  <span className="emprestado">Emprestado</span>
                </td>
              </tr>
            </tbody>
          </table>
        </section>
      </main>

      <nav className="menu">
        <button>Livros</button>
        <button>Empréstimos</button>
        <button>Pessoas</button>
        <button>Backup</button>
      </nav>
    </div>
  );
}

export default App;