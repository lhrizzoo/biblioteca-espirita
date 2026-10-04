import { useState } from "react";
import { appDataDir, join } from "@tauri-apps/api/path";
import { copyFile } from "@tauri-apps/plugin-fs";
import { open } from "@tauri-apps/plugin-dialog";

function Backup() {
  const [fazendoBackup, setFazendoBackup] = useState(false);
  const [mensagem, setMensagem] = useState("");

  async function fazerBackup() {
    try {
      setFazendoBackup(true);
      setMensagem("");

      const pastaEscolhida = await open({
        directory: true,
        multiple: false,
        title: "Escolha onde salvar o backup",
      });

      setMensagem(`Pasta escolhida: ${String(pastaEscolhida)}`);

      if (!pastaEscolhida) {
        return;
      }

      const pastaDados = await appDataDir();
      const bancoOrigem = await join(pastaDados, "biblioteca.db");

      const agora = new Date();

      const data = agora.toISOString().split("T")[0];
      const hora = String(agora.getHours()).padStart(2, "0");
      const minuto = String(agora.getMinutes()).padStart(2, "0");

      const nomeBackup = `Biblioteca_Backup_${data}_${hora}-${minuto}.db`;

      const destino = await join(pastaEscolhida, nomeBackup);

      await copyFile(bancoOrigem, destino);

      setMensagem(`Backup criado com sucesso: ${nomeBackup}`);
    } catch (erro) {
      console.error("Erro ao criar backup:", erro);

      const detalhe =
        erro instanceof Error ? erro.message : String(erro);

      setMensagem(`Não foi possível criar o backup: ${detalhe}`);
    } finally {
      setFazendoBackup(false);
    }
  }

  return (
    <section>
      <h2>Backup da biblioteca</h2>

      <p>
        Crie uma cópia de segurança dos dados da biblioteca para proteger
        livros, pessoas, empréstimos e histórico.
      </p>

      <button onClick={fazerBackup} disabled={fazendoBackup}>
        {fazendoBackup ? "Criando backup..." : "Fazer backup agora"}
      </button>

      {mensagem && <p>{mensagem}</p>}
    </section>
  );
}

export default Backup;