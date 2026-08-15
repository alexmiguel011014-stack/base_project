# base_project:managed

Fonte única do menu "o que você deseja fazer agora?". Editar só aqui — a
instrução em `CLAUDE.md`/`opencode-instructions.md` manda renderizar este
arquivo, não redigitar a lista de memória.

## Menu

O que você deseja fazer agora?

- `/newproject` — começar um projeto novo com a estrutura certa desde o início. Já dispara `/goals` em segundo plano.
- `/goals` — pesquisa profunda de como estruturar o projeto do 0 a 100% (back, front, banco, deploy...) e gera `GOALS.md`.
- `/scanproject` — avaliação completa de um projeto: identidade, CI, testes, lint, segurança básica e estrutura. **Comece aqui.**
- `/cleanproject` — aprofunda só a parte de organização do `/scanproject`: arquivos mortos, pastas erradas, duplicação.
- `/audit` — aprofunda só a parte de segurança do `/scanproject`: vulnerabilidades de dependência, pacotes desatualizados, secrets expostos.
- `/fixproject` — executa as correções apontadas pelo `/scanproject` e/ou `/cleanproject`.
- `/bootstrap` — mapear o projeto atual (repomix + graphify); abre o mapa visual HTML do graphify no browser se der certo. Se falhar, guia passo a passo para instalar ou configurar a API key.
- `/plugins` — ver e instalar plugins opcionais (banco de dados, design, testes de UI, etc.) para este projeto.
- `/council` — pressão-testar uma decisão difícil com várias perspectivas antes de decidir.
- `/status` — ver a versão do base_project e tudo que está ativo agora.
- `/reviewusage` — ver o que você instalou e realmente usa, o que nunca foi usado, e o que anda dando erro.
- `/update` — checar se há uma versão nova do base_project e atualizar.
- `/uninstall` — remover o base_project desta máquina (com confirmação em etapas).
- Ou é só me contar o que você precisa, em português mesmo — eu decido as ferramentas certas.
