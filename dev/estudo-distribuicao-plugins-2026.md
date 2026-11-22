# Estudo: distribuir o base_project como plugin (2026-11)

Estudo do item M23.17 (decisão D12 do GOALS.md). Ele só analisa e não migra nada. Todos os
fatos externos vêm das páginas oficiais listadas em `## Fontes`, lidas em 2026-11-20. Um fato
que a página não confirma traz `(não confirmado)`.

## Pergunta

O base_project deve ser distribuído como plugin (Claude Code, Codex, opencode) em vez de, ou
além de, o instalador atual (`dev/scripts/install.sh` / `install.ps1`)?

Hoje o instalador escreve em diretórios globais de cada engine (README, seção "What Gets
Installed"):

- Claude Code: bloco delimitado em `~/.claude/CLAUDE.md`, 20 comandos em `~/.claude/commands/`,
  3 agentes em `~/.claude/agents/`, hooks mesclados em `~/.claude/settings.json`, Context7 via
  `claude mcp add --scope user` (install.sh, seções 3, 3b, 5 e 6).
- Codex: bloco em `~/.codex/AGENTS.md`, 20 skills em `~/.agents/skills/`, 3 agentes `.toml` em
  `~/.codex/agents/`, referências em `~/.codex/base_project/references/`, hooks em
  `~/.codex/hooks.json`, MCP em `~/.codex/config.toml` (`dev/scripts/install-codex.js`).
- opencode: `instructions` e MCP mesclados em `opencode.jsonc`, agentes e comandos (perfil
  `dense` ou `lite`) em `~/.config/opencode/` (install.sh, seções 4 e 5).
- Compartilhado: `plugins.json` em cada `base_project/` (seção 7), hooks em
  `~/.claude/base_project/hooks/` (8b), scripts em `~/.claude/base_project/scripts/` (8c a 8c-6),
  referências em `base_project/references/` (8d), estado em `~/.base_project/` (seção 9).

## O que cada engine oferece hoje

| Engine | Mecanismo | Componentes suportados | Instalação e atualização | Fonte |
|---|---|---|---|---|
| Claude Code | Plugin (`.claude-plugin/plugin.json`, opcional) distribuído por marketplace (`.claude-plugin/marketplace.json`) | skills, commands, agents, hooks, MCP, LSP, output styles, workflows, monitors, `bin/`; `CLAUDE.md` na raiz do plugin **não** é carregado | `claude plugin marketplace add <owner>/<repo>` + `claude plugin install <nome>@<marketplace>`; `claude plugin update`; auto-update desligado por padrão para marketplaces de terceiros; `claude plugin uninstall` | https://code.claude.com/docs/en/plugins-reference, https://code.claude.com/docs/en/plugin-marketplaces, https://code.claude.com/docs/en/plugins/loading |
| Claude Code (sem plugin) | Skills pessoais em `~/.claude/skills/<nome>/SKILL.md`; comandos em `~/.claude/commands/` continuam funcionando | skills (com arquivos de apoio), comandos | Cópia de arquivos, como o instalador já faz | https://code.claude.com/docs/en/skills |
| Codex | Plugin com `plugin.json` na raiz (formato portátil) ou `.codex-plugin/plugin.json` (compatibilidade), listado em marketplace | skills, servidores MCP, hooks (só em plugins instalados manualmente no app desktop), apps; agentes e comandos não aparecem na página | `/plugins` no Codex CLI ou aba Plugins no app; marketplace pessoal em `~/.agents/plugins/marketplace.json`; cache em `~/.codex/plugins/cache/...`; atualização de plugin local = trocar os arquivos e reiniciar o app | https://developers.openai.com/codex/plugins (redireciona para https://learn.chatgpt.com/docs/plugins), https://developers.openai.com/codex/plugins/build/ |
| opencode | Plugin JS/TS carregado de `.opencode/plugins/`, `~/.config/opencode/plugins/` ou do array `plugins` do `opencode.json(c)` | parte servidor "adds tools, hooks, integrations, commands, and agents"; mecanismo para comandos/agentes não descrito (não confirmado) | `opencode plugin add <pacote>`, `opencode plugin update`, `opencode plugin check`; npm não fixado é checado no startup | https://opencode.ai/docs/plugins/, https://opencode.ai/docs/build/plugins |
| opencode (sem plugin) | Comandos Markdown em `~/.config/opencode/commands/` ou chave `commands` no JSON | comandos | Cópia de arquivos, como o instalador já faz | https://opencode.ai/docs/commands |

### Respostas às perguntas do bloco 1

**Q1. Regras globais sempre carregadas.** Não há equivalente ao bloco de `~/.claude/CLAUDE.md`.
A referência do manifesto diz que um `CLAUDE.md` na raiz do plugin não é carregado como
contexto, e que `claude plugin validate` avisa quando encontra um; a página manda usar uma skill
(plugins-reference, "Standard layout"). Uma skill só carrega o corpo quando é invocada; só a
descrição fica sempre no contexto (skills). O mecanismo mais próximo é um hook `SessionStart`
que devolve `hookSpecificOutput.additionalContext`; o texto entra como system reminder antes do
primeiro prompt (hooks). Limite: um texto acima de 10.000 caracteres vira arquivo, e o Claude
recebe só o caminho e uma prévia de 2.000 caracteres (hooks). O `source/CLAUDE.md` tem hoje
11.511 bytes, então passaria do limite. Output style também é componente de plugin
(plugins-reference), mas a página não diz se ele substitui um bloco de regras (não confirmado).

**Q2. Caminho dos scripts do plugin.** `${CLAUDE_PLUGIN_ROOT}` resolve em `command` e `args` de
hooks e também é exportado ao processo; `${CLAUDE_PLUGIN_DATA}` aponta para
`~/.claude/plugins/data/<id>/` e sobrevive a atualizações (plugins-reference, "Environment
variables"). No Windows, os caminhos substituídos usam barra normal (`C:/Users/...`), exceto em
hooks exec-form e hooks via PowerShell, que mantêm a barra invertida. O PowerShell é o shell
padrão no Windows quando o Git Bash não está instalado (plugins-reference; hooks). Exec-form
não executa shims `.cmd`/`.bat` como `npx`; rode o script com `node` (hooks). No Codex, hooks
recebem `PLUGIN_ROOT` e `PLUGIN_DATA`, e também `CLAUDE_PLUGIN_ROOT`/`CLAUDE_PLUGIN_DATA` por
compatibilidade (Codex build).

**Q3. Mesmo repositório como marketplace e plugin.** Sim. A página de marketplaces trata "A
plugin at the marketplace root" (seção sobre submódulos), e a referência do manifesto cita "a
marketplace entry whose source is the marketplace root" (plugin-marketplaces; plugins-reference).
O `source` relativo não pode conter `..` (plugin-marketplaces). O Codex também lê
`$REPO_ROOT/.claude-plugin/marketplace.json` como local legado de marketplace de repositório
(Codex build); se ele lê `.claude-plugin/plugin.json` como manifesto não está confirmado (não
confirmado).

**Q4. Namespace.** Sim no Claude Code. "Every component is namespaced under it" (o `name` do
plugin); uma skill vira `/plugin-name:skill-name` (plugins-reference; skills). O `name` não
aceita `:` e deve ser kebab-case, então o prefixo seria `/base-project:newgoal`, não
`/base_project:newgoal` (plugins-reference, `name`). Consequências:
`references/command-menu.md` e o README teriam de listar nomes prefixados; o hábito `/newgoal`
quebra; as regras de `source/CLAUDE.md` que citam `/bootstrap`, `/wpp`, `/execgoals` ficariam
erradas. No Codex, a página não trata namespace de skills de plugin (não confirmado); a
invocação explícita é por `@` ou `$` (Codex plugins; Codex skills).

**Q5. Componentes de um plugin Codex.** Skills, servidores MCP, extensões de navegador e hooks
(Codex plugins). A página de build lista também apps e diz que hooks de ciclo de vida só
funcionam em plugins instalados manualmente no app desktop (Codex build). Agentes não aparecem
em nenhuma das duas páginas (não confirmado). Marketplace pessoal:
`~/.agents/plugins/marketplace.json`; de repositório: `$REPO_ROOT/.agents/plugins/marketplace.json`
(Codex build). A extensão de IDE não suporta plugins (Codex plugins).

**Q6. O que um plugin opencode entrega.** É código: arquivos `.ts`/`.js` ou pacotes, carregados
de `plugins/` ou do array `plugins` da config (opencode plugins). A página de build diz que a
parte servidor adiciona "tools, hooks, integrations, commands, and agents", mas não mostra como
(opencode build/plugins). Ela também não diz se o plugin pode entregar arquivos Markdown ou
skills (não confirmado). Comandos Markdown continuam sendo arquivos em `commands/` ou a chave
`commands` do JSON (opencode commands).

**Q7. Atualização e remoção.** Claude Code: `claude plugin update` carrega a nova versão na
próxima sessão ou após `/reload-plugins`. `claude plugin uninstall` apaga também
`~/.claude/plugins/data/<id>/`, salvo com `--keep-data` (plugins/cli-reference). A versão vem do
campo `version` do manifesto; sem ele, do SHA do commit. Um `version` fixo segura o usuário na
cópia em cache até mudar a string (plugins/loading). O auto-update fica desligado por padrão
para marketplaces de terceiros (plugins/loading, "When auto-update runs"). Versões antigas no
cache são apagadas 14 dias depois (plugins/loading). Codex: plugin local atualiza trocando a
pasta e reiniciando o app (Codex build); remoção por "Uninstall plugin" quando disponível; a
página não descreve um comando de update (Codex plugins). opencode: `opencode plugin update` e
`opencode plugin check` (opencode plugins). Hoje `/update` faz `git pull` no repositório e
reexecuta o instalador, e `/uninstall` remove por níveis de confirmação. Um plugin cobriria só
a parte de cada engine; o bloco de regras, o catálogo e `~/.base_project/` continuariam fora.

**Q8. Instalação antiga + plugin com os mesmos comandos.** Skills de plugin têm namespace, então
"both load" junto com skills pessoais ou de projeto de mesmo nome (skills). O usuário veria
`/newgoal` e `/base-project:newgoal` ao mesmo tempo. Hooks de plugin se somam aos hooks do
usuário, e uma cópia idêntica vinda de plugin "is not deduplicated" (hooks). Os 6 hooks
rodariam duas vezes por evento se o instalador não removesse os seus de `settings.json`. Entre
plugins de mesmo nome vale a ordem managed > `--plugin-dir` > marketplace > skills-dir > synced
(plugins/loading, "Name conflicts").

**Q9. Comandos vs skills.** Os comandos customizados foram fundidos em skills, e
`.claude/commands/` continua funcionando. Quando uma skill e um comando têm o mesmo nome, a
skill vence. Skills pessoais ficam em `~/.claude/skills/<nome>/SKILL.md` (skills). Detalhes e
recomendação em `## Comandos vs skills no Claude Code`.

## Mapeamento dos componentes

| Componente | Plugin Claude Code | Plugin Codex | opencode | Fica no instalador? |
|---|---|---|---|---|
| 20 comandos | Sim, como `skills/` (ou `commands/`), mas com prefixo `/base-project:<nome>` (plugins-reference) | Sim, como skills; hoje já são skills em `~/.agents/skills/` (Codex build) | Plugin promete comandos sem mecanismo documentado (não confirmado); arquivos em `commands/` funcionam (opencode commands) | Sim no opencode; nos outros só se o nome sem prefixo for mantido |
| 3 agentes | Sim, `agents/*.md` (plugins-reference) | Não listado (não confirmado) | Plugin promete agentes sem mecanismo documentado (não confirmado) | Sim no Codex e no opencode |
| 6 hooks (`source/hooks/*.js`) | Sim, `hooks/hooks.json` com `${CLAUDE_PLUGIN_ROOT}` (hooks) | Só em plugin instalado manualmente no app desktop (Codex build) | Hooks em código JS, não os mesmos scripts (opencode build/plugins) | Sim no Codex CLI; o hook do plugin não deduplica com o do usuário (hooks) |
| Context7 MCP | Sim, `.mcp.json` ou `mcpServers` (plugins-reference) | Sim, `mcp.json` (Codex build) | Hoje mesclado em `opencode.jsonc`; plugin não documenta MCP (não confirmado) | Sim no opencode |
| Bloco de regras globais | Não; `CLAUDE.md` do plugin não carrega. Alternativa parcial: `SessionStart` + `additionalContext`, com limite de 10.000 caracteres (plugins-reference; hooks) | Não documentado (não confirmado); hoje é bloco em `~/.codex/AGENTS.md` | Hoje via `instructions` no `opencode.jsonc` | Sim |
| `base_project/references/` | Pode ir dentro do plugin e ser citado como `${CLAUDE_PLUGIN_ROOT}/references/...` no corpo da skill (plugins-reference, "Where each variable resolves") | Arquivos dentro do plugin, sem variável documentada para skills (não confirmado) | Não se aplica | Sim no opencode |
| `base_project/scripts/` | Pode ir no plugin; a variável não existe no ambiente do Bash tool, só no texto da skill (plugins-reference) | Arquivos dentro do plugin (não confirmado para skills) | Não se aplica | Sim no opencode |
| `plugins.json` | Pode ir no plugin como arquivo de apoio | Idem | Não se aplica | Sim; o `/plugins` lê o caminho global hoje |
| Estado `~/.base_project/` | Não; o mais próximo é `${CLAUDE_PLUGIN_DATA}`, apagado no uninstall sem `--keep-data` (plugins/cli-reference) | `PLUGIN_DATA` para hooks (Codex build) | Não se aplica | Sim (`repo-path.txt`, perfil do opencode) |
| Perfil `lite` do opencode | Não se aplica | Não se aplica | Exige escolha na instalação; plugin não oferece perfil (não confirmado) | Sim |

## Comandos vs skills no Claude Code

- A página de skills diz que comandos customizados foram fundidos em skills. Arquivos em
  `.claude/commands/` "still work", e o Claude pode invocá-los sozinho, a menos que o
  frontmatter tenha `disable-model-invocation: true` (skills).
- Uma skill e um comando de mesmo nome: a skill vence. Pessoal vence projeto. Skill de plugin
  carrega ao lado das outras porque tem namespace (skills).
- A descrição de cada skill fica sempre no contexto, cortada em 1.536 caracteres. Skills com
  `disable-model-invocation: true` não ocupam esse espaço (skills).
- A skill aceita arquivos de apoio na própria pasta; para isso a página manda mover
  `.claude/commands/deploy.md` para `.claude/skills/deploy/SKILL.md`, e o nome `/deploy`
  continua (skills).
- Uma pasta em `~/.claude/skills/<nome>/` com `.claude-plugin/plugin.json` vira plugin
  `<nome>@skills-dir`, sem marketplace e sem instalação; carrega no lugar, sem cópia
  (plugins/loading; plugins/cli-reference, `plugin init`). Os componentes desse plugin ainda
  levam o prefixo `/<nome>:` (plugins/loading, "Skills-directory plugins blocked by managed
  settings").

Resposta à Q9: sim, vale instalar os 20 comandos como skills em
`~/.claude/skills/<nome>/SKILL.md` **sem** plugin. O nome `/newgoal` fica igual, a skill vence o
comando antigo de mesmo nome, e o Codex já usa o mesmo formato `SKILL.md`. Os comandos com
efeito colateral (`/ship`, `/pr`, `/undo`, `/uninstall`, `/update`, `/execgoals`, `/fixproject`)
devem levar `disable-model-invocation: true`. Isso mantém o comportamento atual de "só roda
quando o usuário digita" e tira as descrições do contexto. Isso é uma migração à parte, com
plano próprio; este estudo não a executa.

## Riscos

1. **Regras globais fora do plugin.** O plugin Claude Code não carrega `CLAUDE.md`, e o bloco
   atual passa do limite de 10.000 caracteres do `additionalContext` (Q1). Sem instalador, as
   regras de autonomia, segurança e verificação de UI deixam de valer.
2. **Namespace quebra nomes.** `/newgoal` vira `/base-project:newgoal` (Q4). O menu
   `command-menu.md`, o README, as regras em `source/CLAUDE.md` e o hábito do usuário mudam.
3. **Duplicação na migração.** Skills de plugin e comandos antigos carregam juntos, e hooks de
   plugin não deduplicam com os do `settings.json` (Q8). Uma transição mal feita roda cada hook
   duas vezes.
4. **Paridade entre engines cai.** Codex não lista agentes e só roda hooks de plugin no app
   desktop instalado manualmente (Q5). O opencode não documenta como um plugin entrega comandos
   ou agentes (Q6). O instalador continuaria necessário nos dois.
5. **Atualização não fica automática.** O auto-update vem desligado para marketplaces de
   terceiros (Q7). Com `version` fixo, o usuário fica na versão antiga até a string mudar.
6. **Estado apagado no uninstall.** `${CLAUDE_PLUGIN_DATA}` é removido por padrão no uninstall
   (Q7), ao contrário de `~/.base_project/`, que o `/uninstall` só apaga com confirmação.
7. **Promessa de zero footprint.** Um plugin instalado com `--scope project` escreve em
   `.claude/settings.json` do repositório (plugins/cli-reference, `plugin install`). O README
   promete não escrever nada dentro de projetos. Só o escopo `user` preserva a promessa.

## Opções

### Opção A — só instalador

Mantém o modelo atual. Pode incluir, como plano separado, a migração dos 20 comandos Claude
Code para `~/.claude/skills/<nome>/SKILL.md` (seção anterior).

- **Benefícios:** nada muda para quem já usa; nomes sem prefixo; um só caminho de atualização
  (`/update`) e de remoção (`/uninstall`); paridade entre Claude Code, Codex, opencode e Kimi;
  bloco de regras global continua sempre carregado.
- **Riscos:** o base_project não aparece em diretórios de plugins; o instalador continua sendo
  código próprio para manter em PowerShell e Bash.
- **Itens de plano estimados:** 0 para manter; cerca de 4 a 6 se a migração para skills entrar
  (gerar `SKILL.md`, ajustar install.sh/install.ps1, podar comandos antigos com marcador,
  atualizar testes, docs e `/uninstall`).

### Opção B — híbrido: plugins para Claude Code e Codex, instalador para o resto

Um repositório serve de marketplace e plugin (Q3). O instalador continua com o bloco de regras,
o opencode, o Kimi, o catálogo e `~/.base_project/`.

- **Benefícios:** instalação e atualização nativas (`claude plugin update`, `/plugins` no Codex);
  scripts e referências viajam juntos com `${CLAUDE_PLUGIN_ROOT}`; descoberta pelo diretório de
  plugins.
- **Riscos:** riscos 2, 3, 4, 5 e 6 inteiros; dois canais de atualização (plugin e `/update`)
  que podem ficar fora de sincronia; o instalador teria de detectar o plugin e podar os próprios
  comandos e hooks para não duplicar.
- **Itens de plano estimados:** cerca de 12 a 16 (manifestos e marketplace, `hooks/hooks.json`,
  reescrita de caminhos em hooks e comandos, poda e detecção no instalador, menu e docs com
  prefixo, `/update` e `/uninstall` cientes do plugin, testes de CI para `claude plugin
  validate`, verificação nos três sistemas).

### Opção C — só plugins

Remove o instalador.

- **Benefícios:** um formato por engine, mantido pelo fornecedor; sem scripts de instalação
  próprios.
- **Riscos:** riscos 1 a 7; perde o bloco de regras global (Q1), os agentes no Codex (Q5), os
  comandos e o perfil `lite` no opencode (Q6), o Kimi e o estado em `~/.base_project/`.
- **Itens de plano estimados:** cerca de 20 ou mais (tudo de B, mais substituir regras globais,
  reescrever o suporte a opencode como plugin JS sem mecanismo documentado, migrar estado e
  remover o instalador), com partes bloqueadas por fatos não confirmados.

## Recomendação

Recomendação: A

1. O bloco de regras globais, que é o centro do base_project, não cabe em nenhum plugin
   documentado: o `CLAUDE.md` do plugin não carrega e o `additionalContext` corta acima de
   10.000 caracteres (Q1, Risco 1). O instalador fica de qualquer jeito.
2. O namespace obrigatório troca `/newgoal` por `/base-project:newgoal` e invalida menu, docs e
   regras (Q4, Risco 2), sem ganho funcional para quem já usa.
3. Codex e opencode não entregam a paridade atual por plugin: sem agentes e com hooks só no app
   desktop no Codex, e sem mecanismo documentado para comandos no opencode (Q5, Q6, Risco 4).
4. A atualização por plugin não é automática por padrão para marketplaces de terceiros, então B
   não elimina o `/update`; só cria um segundo canal (Q7, Risco 5, Opção B).
5. O ganho real que os plugins sugerem, a convergência de comandos em skills, está disponível sem
   plugin: skills pessoais em `~/.claude/skills/` mantêm o nome sem prefixo e vencem o comando
   antigo (Q9, `## Comandos vs skills no Claude Code`). Vale como plano próprio dentro da opção A.

## Fontes

Todas acessadas em 2026-11-20.

- https://code.claude.com/docs/en/plugins-reference — acesso em 2026-11-20
- https://code.claude.com/docs/en/plugin-marketplaces — acesso em 2026-11-20
- https://code.claude.com/docs/en/skills — acesso em 2026-11-20
- https://code.claude.com/docs/en/hooks — acesso em 2026-11-20
- https://code.claude.com/docs/en/plugins/loading — acesso em 2026-11-20 (página oficial extra,
  para Q7 e Q8)
- https://code.claude.com/docs/en/plugins/cli-reference — acesso em 2026-11-20 (página oficial
  extra, para Q7)
- https://developers.openai.com/codex/plugins — acesso em 2026-11-20 (redireciona com 308 para
  https://learn.chatgpt.com/docs/plugins, lida no mesmo dia)
- https://developers.openai.com/codex/plugins/build/ — acesso em 2026-11-20
- https://developers.openai.com/codex/skills — acesso em 2026-11-20 (redireciona com 308 para
  https://learn.chatgpt.com/docs/build-skills, lida no mesmo dia)
- https://opencode.ai/docs/plugins/ — acesso em 2026-11-20
- https://opencode.ai/docs/build/plugins — acesso em 2026-11-20 (página oficial extra, para Q6)
- https://opencode.ai/docs/commands — acesso em 2026-11-20
- Arquivos locais lidos: `README.md` (seção "What Gets Installed"), `dev/scripts/install.sh`
  (seções 3 a 8d), `dev/scripts/install-codex.js`.
