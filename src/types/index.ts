export type Tela = "livros" | "emprestimos" | "pessoas" | "backup";

export type Livro = {
  codigo: string;
  codigo_barras: string;
  titulo: string;
  autor: string;
  espirito: string;
  medium: string;
  editora: string;
  observacao: string;
  quantidade_total: number;
  quantidade_emprestada: number;
  quantidade_disponivel: number;
  disponivel: boolean;
};

export type LivroBanco = {
  codigo: string;
  codigo_barras: string | null;
  titulo: string;
  autor: string;
  espirito: string;
  medium: string;
  editora: string;
  observacao: string;
  quantidade_total: number;
  quantidade_emprestada: number;
  quantidade_disponivel: number;
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