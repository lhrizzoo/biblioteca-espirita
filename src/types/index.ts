export type Tela = "livros" | "emprestimos" | "pessoas" | "backup";

export type Livro = {
  codigo: string;
  titulo: string;
  autor: string;
  disponivel: boolean;
};

export type LivroBanco = {
  codigo: string;
  titulo: string;
  autor: string;
  disponivel: number;
};

export type Pessoa = {
  id: number;
  nome: string;
  telefone: string;
  observacao: string;
};

export type Emprestimo = {
  id: number;
  pessoa_id: number;
  pessoa_nome: string;
  livro_codigo: string;
  livro_titulo: string;
  data_emprestimo: string;
  data_prevista: string;
  data_devolucao: string | null;
};