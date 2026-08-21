# base_project:managed

Fonte única do menu "o que você deseja fazer agora?". Editar só aqui — a
instrução em `CLAUDE.md`/`opencode-instructions.md` manda renderizar este
arquivo, não redigitar a lista de memória.

## Menu

O que você deseja fazer agora?

- `/bootstrap` — sincroniza com o remoto (pull se estiver atrás) e mapeia o projeto atual (repomix + graphify); abre o mapa visual HTML do graphify no browser se der certo. Se falhar, guia passo a passo para instalar ou configurar a API key.
- `/newproject` — começar um projeto novo com a estrutura certa desde o início. Já dispara `/newgoal` em segundo plano.
- `/newgoal` — pesquisa profunda de como estruturar o projeto do 0 a 100% (back, front, banco, deploy...) e gera `GOALS.md`.
- `/repertoire` — pesquisa o domínio do projeto (base científica, regulatória, cultural, midiática) antes do `/newgoal` planejar. Sempre confirma antes de rodar. Combina com `/newgoal /repertoire` na mesma mensagem, ou roda sozinho.
- `/execgoals` — executa o `GOALS.md` gerado pelo `/newgoal`, item por item, marcando cada um como feito conforme verifica de verdade.
- `/scanproject` — avaliação completa de um projeto: identidade, CI, testes, lint, segurança básica e estrutura. **Comece aqui.**
- `/audit` — aprofunda só a parte de segurança do `/scanproject`: vulnerabilidades de dependência, pacotes desatualizados, secrets expostos.
- `/cleanproject` — aprofunda só a parte de organização do `/scanproject`: arquivos mortos, pastas erradas, duplicação.
- `/fixproject` — executa as correções apontadas pelo `/scanproject` e/ou `/cleanproject`.
- `/undo` — reverte o último lote de mudança (não commitada, ou o último commit) em etapas de confirmação separadas por risco. Nunca `reset --hard` nem force-push sem um gate explícito à parte.
- `/diario` — registra o que foi feito no diário de contribuições deste projeto (entradas datadas + tabela de horas), a partir do que já foi gravado automaticamente. Os diários ficam numa pasta fora de todos os repositórios — nunca vão pro GitHub.
- `/ship` — commita e sobe pro GitHub (ou outro remoto). Confere se está tudo pronto antes; se não estiver, guia passo a passo em vez de só falhar.
- `/pr` — abre um pull request pra branch atual, com título/corpo rascunhados a partir dos commits reais. Sempre confirma antes de criar.
- `/plugins` — ver e instalar plugins opcionais (banco de dados, design, testes de UI, etc.) para este projeto.
- `/council` — pressão-testar uma decisão difícil com várias perspectivas antes de decidir.
- `/designreview` — criticar um design (mockup, screenshot, URL, ou algo que o próprio Claude acabou de gerar) contra uma rubrica com base em pesquisa, com achados acionáveis.
- `/status` — ver a versão do base_project e tudo que está ativo agora.
- `/reviewusage` — ver o que você instalou e realmente usa, o que nunca foi usado, e o que anda dando erro.
- `/update` — checar se há uma versão nova do base_project e atualizar.
- `/uninstall` — remover o base_project desta máquina (com confirmação em etapas).
- Ou é só me contar o que você precisa, em português mesmo — eu decido as ferramentas certas.
