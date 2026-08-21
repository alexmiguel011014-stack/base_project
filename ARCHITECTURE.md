# base_project — arquitetura interna

Este documento é sobre **como o código funciona por dentro** — funções, arquivos, fluxo
de dados. Para a visão de usuário (o que instalar, como usar `/plugins`, etc.), veja
`README.md`. Para o histórico de decisões e o que falta fazer, veja `dev/ROADMAP.md`.
Para lições aprendidas com bugs reais, veja `CLAUDE.md` (regras deste repo) e
`dev/scripts/NPInstructions.md` (erros conhecidos do catálogo de plugins).

---

## 1. O que este projeto é, em uma frase

Um instalador (`dev/scripts/install.ps1` / `install.sh`) que copia arquivos de `source/`
para `~/.claude/` e `~/.config/opencode/` — nada mais. Não é um servidor rodando o
tempo todo, não é um pacote npm publicado, não escreve nada dentro de projetos que o
usam. O "produto" real são os arquivos que acabam instalados: regras globais, 3
subagentes, 21 comandos, um catálogo de plugins opcionais, e 4 hooks com comportamento
real. (O dashboard web existiu até o ROADMAP item 13 — removido por completo, ver
histórico lá.) Versão rastreada via `package.json` (`version`) + git tag — sem nenhum
fluxo de release/publicação.

---

## 2. Mapa de diretórios

```
base_project/
├── source/                    ← ORIGEM. Tudo aqui é "distribuído" pelo installer.
│   ├── CLAUDE.md               → ~/.claude/CLAUDE.md (bloco delimitado)
│   ├── opencode-instructions.md→ linkado de ~/.config/opencode/opencode.jsonc
│   ├── claude/
│   │   ├── agents/*.md         → ~/.claude/agents/       (architect, coder, reviewer)
│   │   ├── commands/*.md       → ~/.claude/commands/     (21 comandos — ver README.md § Commands pra lista completa)
│   │   └── references/        → ~/.claude/base_project/references/ (project-standards.md,
│   │                            command-menu.md, goal-types/*.md — build/fix/feature/process/
│   │                            research, lidos por /newgoal pra classificar cada meta)
│   ├── opencode/
│   │   ├── agent/*.md          → ~/.config/opencode/agent/     (mesmo trio, formato opencode)
│   │   ├── command/*.md        → ~/.config/opencode/command/   (mesmos comandos, formato opencode)
│   │   ├── references/        → ~/.config/opencode/base_project/references/ (mesmo conteúdo,
│   │                            formato opencode)
│   │   └── mcp.json            → ~/.config/opencode/mcp.json + registrado via `claude mcp add`
│   ├── plugins.json            → ~/.claude/base_project/plugins.json (+ cópia opencode)
│   └── hooks/*.js              → ~/.claude/base_project/hooks/
│
├── dev/                        ← ADMIN-ONLY. Nada aqui importa pra quem só USA o base_project.
│   ├── scripts/
│   │   ├── install.ps1 / install.sh  ← o instalador de verdade (idempotente, faz merge não overwrite)
│   │   ├── validate-plugins.js       ← CLI: valida source/plugins.json contra o schema (ajv)
│   │   ├── scan-skill.js             ← CLI: scan leve de segurança pra skills de terceiro
│   │   ├── contrast-check.js         ← CLI: contraste WCAG + tamanho mínimo de alvo de toque (usado por /designreview)
│   │   ├── diary-source.js           ← CLI: extrai ledger de uso + histórico git por projeto/dia (usado por /diario)
│   │   └── NPInstructions.md         ← guia "como cadastrar plugin novo" + ledger de erros conhecidos
│   ├── schemas/
│   │   └── plugins.schema.json ← JSON Schema draft-07 validando a forma de plugins.json
│   ├── tests/                  ← node:test, roda com `npm test`
│   └── ROADMAP.md              ← histórico de decisões, o que foi feito e por quê, o que ficou de fora
│
├── assets/                     ← ícone de pasta do Windows Explorer (desktop.ini + icone.ico), aplicado por install.ps1 em source/, dev/, assets/ — puramente cosmético, não distribuído a ninguém
├── .github/workflows/ci.yml    ← lint, typecheck, schema, testes, e testa os instaladores de verdade
├── .github/ISSUE_TEMPLATE/     ← templates de bug report / feature request
├── biome.json / tsconfig.json  ← ficam na raiz (motivo: ver nota abaixo), escopo cobre source/hooks + dev/scripts + dev/tests
├── package.json                ← fica na raiz (convenção npm/CI), mas seus scripts apontam pra dev/
├── LICENSE                     ← MIT
├── SECURITY.md                 ← política de divulgação de vulnerabilidade
├── CONTRIBUTING.md             ← como contribuir
├── CODE_OF_CONDUCT.md          ← Contributor Covenant
├── README.md                   ← visão de usuário
├── GOALS.md                    ← planos de feature/iniciativa em formato executável por /execgoals (diferente do ROADMAP.md: aqui é o plano, lá é o histórico)
└── ARCHITECTURE.md             ← este arquivo
```

**Por que `dev/` existe**: separar o que é "admin" (só quem desenvolve o instalador
precisa) do que é "produto" (`source/`, o que qualquer usuário do base_project usa,
mesmo sem saber). Raiz do repositório fica enxuta: `source/`, `dev/`, `README.md`,
`ARCHITECTURE.md`, `package.json`, `biome.json`/`tsconfig.json`, `.github/`.

**Por que `biome.json`/`tsconfig.json` ficaram na raiz, não em `dev/`**: tentativa real
de mover os dois pra `dev/` foi revertida depois de testar — o Biome 2.x recusa um
padrão de `includes` que escape do diretório do próprio config via `../`
("Found a nested root configuration" / caminho reportado como ignorado). Como o lint
precisa cobrir `source/hooks/**/*.js` (fora de `dev/`) e `dev/scripts/*.js`/
`dev/tests/**/*.js` (dentro), o único lugar que enxerga as duas árvores sem violar essa
regra é a raiz. `tsconfig.json` foi junto por consistência (o `tsc` em si não tem essa
restrição, mas manter os dois configs de tooling no mesmo lugar evita confusão).

**Regra de sincronização**: editar só `source/` não tem efeito imediato na máquina —
`source/` é o "código-fonte", os arquivos instalados em `~/.claude/base_project/` são o
"binário". Depois de editar `source/`, rode o installer de novo
(`dev/scripts/install.ps1`/`.sh`) pra sincronizar. Ver seção 6.

---

## 3. Os 3 subagentes (architect / coder / reviewer)

Arquivos: `source/claude/agents/*.md` (formato Claude Code) e `source/opencode/agent/*.md`
(formato opencode) — conteúdo espelhado entre os dois pares.

| Agente | Papel | Ferramentas |
|---|---|---|
| `architect` | Planeja mudanças não-triviais. Só leitura, nunca edita. | Read-only |
| `coder` | Aplica o plano com edições cirúrgicas e escopadas. | Read, Bash, Grep, Glob, Edit, Write |
| `reviewer` | Roda lint/typecheck/test do próprio projeto, prepara mensagens de commit (Conventional Commits). Nunca commita sem pedido explícito. | Read, Bash, Grep, Glob |

`reviewer.md` também carrega a **régua de verificação de entrega** (seção "Verifying
the delivery matches the original ask"): 4 gates em ordem — existe / é substancial (grep
por `TODO`/`stub`/corpo vazio) / está conectado (tem call-site real, não só definição) /
tem prova comportamental (teste passando, output real, não só a forma do código). Essa
régua foi portada do padrão "loop-verifier" pesquisado externamente — decisão registrada
no ROADMAP: reimplementar como texto, não instalar a skill de terceiro.

---

## 4. Os 21 comandos

Arquivos: `source/claude/commands/*.md` + `source/opencode/command/*.md`.

| Comando | O que faz |
|---|---|
| `/newproject` | Planeja a estrutura de um projeto novo (stack, checklist inicial, plugins relevantes). Read-only, como `architect` — nunca cria arquivo sozinho. Dispara `/newgoal` em segundo plano ao final. |
| `/newgoal` | Classifica o tipo de meta (`build`/`fix`/`feature`/`process`/`research` — ver `references/goal-types/*.md`) e pesquisa + escreve `GOALS.md` na raiz do projeto-alvo, o plano que `/execgoals` consome. |
| `/repertoire` | Pesquisa o domínio real do projeto-alvo — base científica, regulatória/legal, cultural, mídia — não a stack técnica. Sempre confirma antes de rodar; combina com `/newgoal /repertoire` na mesma mensagem, ou roda sozinho. |
| `/execgoals` | Executa `GOALS.md` item por item, na ordem que `/newgoal` escreveu, usando `architect`/`coder` pra qualquer mudança não-trivial. Só marca item como feito depois de verificar de verdade. |
| `/scanproject` | Avalia um projeto existente contra `references/project-standards.md`, reporta achados com severidade e arquivo/linha. Read-only — nunca corrige. |
| `/cleanproject` | Avalia organização de arquivo/pasta (arquivo morto, estrutura fora de convenção, duplicação) e propõe reorganização. Read-only — nunca move/apaga nada. |
| `/fixproject` | Corrige os achados do `/scanproject` e/ou `/cleanproject` (rodando o que faltar primeiro), com reverificação real de cada correção antes de reportar "resolvido". |
| `/undo` | Reverte o último lote de mudança — não commitada, arquivo novo não rastreado, ou o último commit — com confirmação em tiers separados por risco. Nunca `git reset --hard`/force-push sem um gate explícito à parte; commit já enviado é desfeito com `git revert`, nunca reescrito. |
| `/diario` | Registra o que foi feito no diário de contribuições do projeto (entradas datadas + tabela de horas), sintetizado do ledger de uso + histórico git. Os diários ficam num diretório central **fora de todos os repositórios** — garantia arquitetural de que nunca chegam ao GitHub. |
| `/ship` | Commita e sobe as mudanças do projeto atual pro remoto — confere prontidão (estado limpo, sem segredo, lint/teste passando, remoto configurado) antes, guia passo a passo em cada bloqueio. Nunca força push, nunca resolve conflito sozinho. |
| `/pr` | Abre um pull request pra branch atual — rascunha título/corpo a partir do range de commits real contra a branch base, confirma antes de criar. O passo que o próprio `/ship` (passo 9) já menciona mas nunca executa. |
| `/bootstrap` | Sincroniza com o remoto do projeto (pull se estiver atrás), depois mapeia em `graphify-out/` + `repomix-output.xml` (contexto eficiente em tokens). |
| `/audit` | Scan de segurança (vulnerabilidade de dependência, segredo exposto). Usa Strix se instalado, senão `npm audit`/`pip-audit` + `gitleaks`/`trufflehog`. |
| `/plugins` | Lê `plugins.json`, recomenda plugins pro projeto atual, instala os escolhidos. Aceita um preset (`/plugins minimal`) que pula a etapa de recomendação. Depois de instalar uma skill de terceiro, roda `scan-skill.js` na pasta baixada antes de dizer que está pronta pra uso. |
| `/council` | Pressão-testa uma decisão difícil através de 5 perspectivas de conselheiro independentes + veredito sintetizado. Sempre pede confirmação antes — custa ~6x uma resposta de passada única. |
| `/designreview` | Critica um design (mockup/screenshot/URL externo, ou algo que o próprio Claude acabou de gerar) contra uma rubrica com base em pesquisa. Roda o check determinístico de contraste WCAG/alvo de toque (`contrast-check.js`) primeiro, depois julgamento global-antes-local. |
| `/wpp` | Mostra o menu "o que você deseja fazer agora?" sob demanda (mesmo conteúdo que aparece automaticamente no início de sessão / fim de tarefa). |
| `/status` | Mostra a versão do base_project e uma lista simples (só nomes) de tudo que está ativo agora — agentes, comandos, hooks, plugins instalados. |
| `/reviewusage` | Lê o ledger de uso local (escrito pelo hook `usage-log`) e reporta o que foi instalado mas nunca usado, o que é usado e onde, o que está falhando. Só cobre Claude Code — atividade do opencode não é rastreada. |
| `/update` | Confere se há commits novos no repositório do base_project, mostra o que mudou, e — só com confirmação — dá `git pull` e reroda o installer. Nunca mexe se houver mudança local não commitada. |
| `/uninstall` | Remove tudo que o base_project instalou globalmente, em 3 níveis de confirmação por raio de impacto. Nunca apaga o repositório em si. |

### 4.1 `/newproject` → `/scanproject` / `/cleanproject` → `/fixproject`, e a referência compartilhada

Os três comandos apontam pro mesmo arquivo — `references/project-standards.md` — em vez
de cada um definir "projeto bem formado" à sua maneira. 9 categorias: identidade,
controle de versão, segredos, dependências, testes, qualidade de código, CI, segurança
básica, estrutura.

- `/newproject` usa o checklist como **forma do plano** (o que criar primeiro, nessa
  ordem). Read-only — nunca escreve arquivo, mesmo contrato do `architect`.
- `/scanproject` usa o checklist como **critério de avaliação** — cada item vira
  `ok`/`missing`/`broken` com severidade e arquivo/linha, mesmo formato que `reviewer`
  já usa pra achado de revisão de código. Também read-only: garante que o resultado é
  confiável antes de qualquer correção agir sobre ele.
- `/cleanproject` é um zoom na categoria 9 ("Estrutura") do mesmo checklist — arquivo
  morto, pasta fora de convenção, duplicação — sempre com evidência real (grep
  confirmando zero referência, não inferência pelo nome do arquivo). Também read-only;
  se `/scanproject` já rodou na mesma conversa, reaproveita o achado da seção 9 em vez
  de escanear tudo de novo.
- `/fixproject` roda `/scanproject` e/ou `/cleanproject` primeiro (ou reaproveita
  achados recentes da mesma conversa), corrige cada achado (`architect`→`coder` pra
  mudança não-trivial, direto pra correção de uma linha — mover arquivo inclui
  atualizar toda referência/import no mesmo passo), e **reverifica de verdade** —
  re-roda o comando que originou o achado, não assume pela forma do diff. Mesma régua
  de 4 gates que `reviewer.md` já usa (seção 3), aplicada aqui a "a correção resolveu,
  não só existe".

### 4.2 O menu "o que você deseja fazer agora?" (estilo WhatsApp)

Instrução em `CLAUDE.md`/`opencode-instructions.md`: renderizar
`references/command-menu.md` **verbatim** (nunca redigitar a lista de memória) em dois
momentos automáticos — início de sessão sem pedido específico já dado, e logo depois de
fechar uma tarefa substancial (múltiplos edits, subagentes, ou TodoWrite envolvido).
Não dispara a cada turno — existe pra baixar a fricção de quem não sabe por onde
começar, não pra virar ruído em uso avançado. `/wpp` é o mesmo menu sob demanda, pra
quando o usuário quer vê-lo fora dos dois gatilhos automáticos. `command-menu.md` é a
mesma fonte única que `plugins.json`/`project-standards.md`: um arquivo, todos os
pontos de entrada (`CLAUDE.md`, `opencode-instructions.md`, `/wpp` nos dois engines)
apontam pra ele em vez de duplicar a lista.

### 4.3 `/update` e `/uninstall` — ciclo de vida da própria instalação

- **`/update`**: lê `~/.base_project/repo-path.txt` pra achar o repositório do
  base_project, confere `git status --porcelain` primeiro — **para sem fazer nada** se
  houver mudança local não commitada (nunca `stash`/`reset` por conta própria), depois
  `git fetch` + compara `HEAD` com `@{u}`. Se houver novidade, mostra o log e só dá
  `git pull` (nunca `--force`) com confirmação explícita, seguido de rerodar o
  installer certo pro SO. Nunca dá push nem toca no remoto — só puxa.
- **`/uninstall`**: inventário real primeiro (nunca por suposição), depois 3 tiers de
  confirmação **separados** por raio de impacto — Tier A (arquivos próprios do
  base_project, reversível reinstalando), Tier B (os 3 registros de hook em
  `settings.json` + `instructions`/`mcp.file` do `opencode.jsonc` — muda comportamento
  de toda sessão futura), Tier C (os 4 registros de MCP server via `claude mcp remove
  --scope user` — afeta todo projeto da máquina, não só quem usa base_project). Nunca
  toca em arquivo sem o marcador `base_project:managed`, e **nunca apaga o repositório
  do base_project em si**, só os efeitos instalados globalmente.

---

## 5. O catálogo de plugins (`plugins.json`)

**Schema**: `dev/schemas/plugins.schema.json` (JSON Schema draft-07). Raiz exige
`_managed_by` (const `"base_project"`) e `catalog` (array). Cada `catalogEntry` exige
`id`/`name`/`kind` (`mcp`|`cli`|`skill`)/`summary`/`recommend_if`; campos opcionais
incluem `pluginName` (nome real do plugin instalado, quando difere do `id`),
`dependsOn` (ainda não populado — ver seção 5.1), `claude`/`opencode` (blocos de
instalação por engine), `install` (comando CLI).

**Validação**: `dev/scripts/validate-plugins.js` compila o schema com `ajv`+`ajv-formats`,
roda contra o catálogo real, e faz uma checagem extra pós-schema (não expressável em
JSON Schema puro): toda referência em `dependsOn`/`profiles` precisa apontar pra um `id`
que existe de verdade no catálogo. Exporta `validate(path)` — reusado pelos testes e
pelo CI (`npm run validate:plugins`).

### 5.1 Perfis (`profiles`)

Campo raiz opcional: `{ "minimal": ["headroom", "ponytail"], "design": [...], "full": [...] }`.
`/plugins <nome-do-perfil>` reconhece isso em `$ARGUMENTS` e pula direto pra instalação,
sem passar pela recomendação interativa. `dependsOn` por entrada existe no schema mas
**não está populado** — decisão deliberada: as 13 entradas atuais não têm dependência
técnica real entre si (são MCPs/CLIs/skills independentes), popular seria dado falso.

---

## 5.2 Tudo que o projeto tem, organizado por área de atuação

Visão de referência rápida — cada peça com seu nome, tipo, e o que faz. Complementa o
mapa técnico das seções 3/4/5 acima (que explica *como* cada categoria funciona por
dentro); aqui é só *o que existe*, agrupado por pra que serve.

### 🎨 Design / UI / animação
| Nome | Tipo | O que faz |
|---|---|---|
| **Skill UI bundle** (`skill-ui`) | plugin (skill) | Gera direção de design real, remove "cara de IA" (espaçamento, tipografia, estados), cobre acessibilidade. |
| **Emil Kowalski — Design Engineering** (`emil-design-eng`) | plugin (skill, 10 sub-skills) | Animação/polish de componente: easing customizado, transições <300ms, critério de revisão de design engineer sênior. |
| **Impeccable** (`impeccable`) | plugin (skill) | Sistema anti-"design genérico de IA" — 23 comandos, dezenas de regras determinísticas (gradiente roxo, cartão aninhado, etc.). |
| **Taste Skill** (`taste-skill`) | plugin (skill) | Define direção de design a partir do briefing antes de tocar em código — evita hero centralizado, gradiente roxo, emoji em excesso. |
| **StyleSeed** (`styleseed`) | plugin (skill) | Engine de julgamento de design — 74 regras + gate pontuado (0-100) de render/score/revise, com skins de referência compiladas de Stripe/Linear/Vercel/Notion/Toss. Contraparte de geração do `/designreview`: corrige de verdade o que foi criticado. |
| **UX/UI Agent Skills** (`ux-ui-agent-skills`) | plugin (skill) | Biblioteca de 138 design systems + tokens DTCG, specs de componente, auditoria WCAG 2.2, geração de código pra qualquer framework. Mais abrangente e focado em geração de código que o StyleSeed. |
| **`/designreview`** | comando | Critica um design (mockup/screenshot/URL externo, ou algo que o próprio Claude acabou de gerar) contra uma rubrica com base em pesquisa. Roda `contrast-check.js` (WCAG/alvo de toque), depois calibra contra exemplares reais nomeados (Stripe/Linear/Vercel/Notion) antes do julgamento global-antes-local. |

### 🗄️ Banco de dados / infraestrutura
| Nome | Tipo | O que faz |
|---|---|---|
| **Supabase MCP** (`supabase`) | plugin (MCP) | Gerencia tabelas, roda SQL, lê config direto de um projeto Supabase. |
| **Postgres MCP** (`postgres`) | plugin (MCP) | Consulta/inspeciona um Postgres local ou remoto. |
| **SQLite MCP** (`sqlite`) | plugin (MCP) | Consulta/inspeciona um arquivo SQLite local. |

### 🔒 Segurança
| Nome | Tipo | O que faz |
|---|---|---|
| **Strix** (`strix`) | plugin (CLI) | Pentest autônomo com prova de exploração real (não só lista estática), roda isolado em Docker. Usado por `/audit` quando instalado. |
| **`/audit`** | comando | Scan de vulnerabilidade de dependência + segredo exposto no projeto atual. |
| **`scan-skill.js`** | script interno | Varre uma skill de terceiro baixada em busca de padrão suspeito (comando remoto, Unicode escondido) antes de confiar nela. Roda sozinho dentro do `/plugins`. |

### 🧭 Navegador / teste de UI
| Nome | Tipo | O que faz |
|---|---|---|
| **Playwright MCP** (`playwright`) | plugin (MCP) | Controla um navegador de verdade via linguagem natural, pra validar mudança de UI ponta a ponta. |
| **Anthropic Example Skills** (`example-skills`) | plugin (skill) | Inclui `webapp-testing` (checagem automatizada de frontend local) e `mcp-builder` (guia pra construir servidor MCP próprio). |

### 🧠 Orquestração / disciplina de código
| Nome | Tipo | O que faz |
|---|---|---|
| **architect** | subagente | Planeja mudança não-trivial. Só lê, nunca edita. |
| **coder** | subagente | Aplica o plano com edição cirúrgica e escopada. |
| **reviewer** | subagente | Roda lint/typecheck/teste do projeto, monta mensagem de commit, confere se a entrega bate com o pedido (régua de 4 níveis). Nunca commita sem pedido. |
| **`/newproject`** | comando | Planeja a estrutura de um projeto novo contra `project-standards.md`. Read-only. |
| **`/scanproject`** | comando | Avalia um projeto existente contra `project-standards.md`, reporta achados. Read-only. |
| **`/cleanproject`** | comando | Avalia organização de arquivo/pasta (arquivo morto, estrutura, duplicação), propõe reorganização. Read-only. |
| **`/fixproject`** | comando | Corrige os achados do `/scanproject` e/ou `/cleanproject`, com reverificação real de cada correção. |
| **`/undo`** | comando | Reverte o último lote de mudança (não commitada ou o último commit), confirmação em tiers por risco. Nunca `reset --hard`/force-push sem gate separado. |
| **`/diario`** | comando | Escreve o diário de contribuições do projeto a partir do ledger + git, num diretório fora de todo repositório. Nunca escreve dentro de um projeto. |
| **`diary-source.js`** | script interno | Extração determinística por projeto/dia (duração com corte de ociosidade >30min, arquivos tocados, commits). Roda dentro do `/diario`. |
| **`/newgoal`** | comando | Classifica o tipo de meta (`build`/`fix`/`feature`/`process`/`research`) e pesquisa + escreve `GOALS.md`, o plano que `/execgoals` consome. |
| **`/execgoals`** | comando | Executa `GOALS.md` item por item na ordem escrita, verificando cada um antes de marcar como feito. |
| **`/repertoire`** | comando | Pesquisa domínio real (científico/regulatório/cultural/mídia) do projeto-alvo antes do `/newgoal` planejar. Confirma antes de rodar; combina ou roda sozinho. |
| **`/ship`** | comando | Commita e sobe as mudanças pro remoto (GitHub etc.), com checagem de prontidão e guia passo a passo pra cada bloqueio (repo sem remoto, segredo detectado, lint quebrado, divergência com upstream...). Nunca força push, nunca resolve conflito sozinho. |
| **`/pr`** | comando | Abre PR pra branch atual, título/corpo a partir do range de commits real, confirma antes de criar. |
| **`/council`** | comando | Pressão-testa uma decisão difícil com 5 perspectivas de conselheiro independentes + veredito. |
| **`/status`** | comando | Lista, só por nome, tudo que está ativo agora + versão do base_project. |
| **Ruflo** (`ruflo`) | plugin (MCP) | Meta-orquestrador multi-agente pesado (~98 agentes especializados, memória vetorial persistente) — infraestrutura, não uma skill única. |
| **Ponytail** (`ponytail`) | plugin (skill) | Disciplina "sempre a solução mais simples que funciona" — reforça o próprio `coder`. |
| **Headroom** (`headroom`) | plugin (CLI) | Comprime output de tool/log/JSON antes de chegar no modelo — economia de token. |

### 🗂️ Contexto do projeto / mapeamento
| Nome | Tipo | O que faz |
|---|---|---|
| **`/bootstrap`** | comando | Sincroniza com o remoto do projeto (pull se estiver atrás), depois mapeia em `graphify-out/` + `repomix-output.xml` — contexto eficiente em token. |
| **`session-start-git-context`** | hook (`SessionStart`) | Injeta o estado do git (branch, mudanças pendentes, commits recentes) no início da sessão — evita "cold start". |
| **Menu "o que você deseja fazer agora?"** | instrução (`CLAUDE.md`/`opencode-instructions.md`) | Renderiza `references/command-menu.md` no início de sessão e ao fechar tarefa substancial — lista todos os comandos em linguagem simples. |
| **context7** | MCP (sempre ativo) | Busca documentação atualizada de biblioteca/framework. |
| **filesystem** | MCP (sempre ativo) | Acesso a arquivo fora do diretório de trabalho padrão. |
| **git** | MCP (sempre ativo) | Operações git estruturadas. |
| **github** | MCP (sempre ativo) | Lê/escreve issues, PRs, código de repositório no GitHub. |

### 🛡️ Qualidade / comportamento automático
| Nome | Tipo | O que faz |
|---|---|---|
| **`loop-detect`** | hook (`PostToolUse`) | Avisa se o mesmo comando repetir 5x seguidas — sinal de que travou. |
| **`post-edit-format`** | hook (`PostToolUse`) | Formata automaticamente só o arquivo que acabou de ser editado. |

### 📦 Instalação / catálogo
| Nome | Tipo | O que faz |
|---|---|---|
| **`/plugins`** | comando | Recomenda e instala plugins do catálogo pro projeto atual, ou instala um perfil pronto. |
| **`/update`** | comando | Confere e aplica atualização do base_project (`git pull` + reroda o installer), com confirmação. |
| **`/uninstall`** | comando | Remove o que o base_project instalou globalmente, em 3 níveis de confirmação. |
| **`/reviewusage`** | comando | Lê o ledger de uso (hook `usage-log`) e reporta instalado-mas-nunca-usado, uso real por projeto, falhas. Só Claude Code — opencode não é rastreado. |
| **`install.ps1` / `install.sh`** | script | O instalador de verdade — copia tudo isso pra `~/.claude/`/`~/.config/opencode/`. Também sugere (nunca aplica sozinho) configurar `fallbackModel`. |
| **`validate-plugins.js`** | script | Valida `plugins.json` contra o schema antes de aceitar. |

---

## 6. Os 4 hooks com comportamento real

Todos com efeito de verdade, não só observação. Nenhum **falha** o tool call/sessão que
os disparou (tudo dentro de `try/catch` que engole erro).

### `source/hooks/loop-detect.js` (`PostToolUse`, síncrono)
Mantém um contador por `session_id` (arquivo em `os.tmpdir()`, não em
`~/.base_project/`) da assinatura `tool_name + JSON(tool_input)`. Se a mesma
assinatura repetir 5x seguidas, escreve um aviso em stderr (nunca bloqueia). Existe
porque um padrão assim precedeu um acidente real de perda de dados nesta mesma sessão de
desenvolvimento (`git checkout --` repetido).

### `source/hooks/post-edit-format.js` (`PostToolUse`, síncrono)
Depois de `Edit`/`Write`/`MultiEdit` num arquivo `.js`/`.jsx`/`.ts`/`.tsx`/`.json`/`.css`,
roda `biome format --write` **só nesse arquivo** — nunca o projeto inteiro. Escopo
restrito é deliberado: um `biome format .` amplo já causou um incidente de reformatação
não intencional nesta mesma sessão. Silenciosamente não faz nada se não houver
`biome.json`/binário disponível no projeto alvo (não instala nada por conta própria).

### `source/hooks/session-start-git-context.js` (`SessionStart`, matcher `startup|resume|clear`)
Injeta um resumo compacto do estado git (branch, commits à frente/atrás do upstream,
arquivos com mudança não commitada, `git log -3 --oneline`) direto no contexto da
sessão — evita "cold start" (ter que redescobrir o que estava em andamento gastando
tool calls). Mecanismo: stdout puro em exit 0 vira contexto automaticamente (sem
wrapper JSON) — confirmado contra a documentação oficial do Claude Code antes de
implementar, não assumido. **Fica em silêncio (zero stdout) se a árvore estiver limpa e
sincronizada com o upstream** — decisão deliberada de economia de token: a maioria das
aberturas de sessão não tem nada de novo pra reportar. Deliberadamente não registrado
pros matchers `compact`/`fork` (não são cold start de verdade).

### `source/hooks/usage-log.js` (`PostToolUse` + `UserPromptSubmit`, síncrono)
Grava um ledger de fatos crus — um arquivo `.jsonl` por sessão por dia em
`~/.claude/base_project/usage/`, uma linha por chamada de tool (`ts`, `session`,
`prompt_id`, `agent_type`, `agent_id`, `cwd`, `tool`, `input`, `response`, `ms`) e uma
linha por prompt de usuário (mesmo cabeçalho + `prompt`), mais uma linha `install` quando
`/plugins` instala algo (`--install <id> --kind <kind> --origin <catalog|discovery>`).
**Não classifica nada** — toda interpretação (o que está sendo usado, o que nunca foi
tocado) acontece só na leitura, dentro de `/reviewusage`; a decisão deliberada de manter
o hook burro existe porque uma versão anterior classificava no momento da escrita e
sub-reportava plugins que na verdade estavam em uso (ver `dev/scripts/NPInstructions.md`).
Input grande é truncado pra um `Write` não inflar o ledger; sobrevive a input circular sem
lançar exceção; cada entrada é uma linha só, então uma escrita corrompida não contamina as
vizinhas.

**Importante**: editar esses arquivos em `source/hooks/` não muda o comportamento da sua
sessão atual — o `settings.json` real só é atualizado rodando o installer de novo (ele
faz merge idempotente na lista de hooks, preservando qualquer hook seu que não seja do
base_project).

---

## 7. Scan de segurança pra skill de terceiro (`dev/scripts/scan-skill.js`)

Node puro (decisão deliberada: não depender de `rg`/ripgrep estar instalado no sistema
do usuário). Varre um diretório recursivamente (pula `.git`/`node_modules`/`.venv`/
`__pycache__`, pula arquivos binários via detecção de byte NUL, ignora arquivos >2MB) e
testa 6 regras de regex de alto sinal: Unicode de largura zero, `curl`/`wget | sh`,
PowerShell `-EncodedCommand` com base64, `eval(atob(...))`, `child_process.exec` com
interpolação de string. Retorna findings com arquivo+linha; nunca lança exceção, nunca
apaga nada — puramente consultivo.

**Integrado ao `/plugins`**: depois de instalar uma entrada `kind: skill` que baixa
arquivos localmente (`npx skills add`), o comando roda esse scanner na pasta resultante
antes de dizer que está pronta pra uso.

Sincronizado pelo installer pra `~/.claude/base_project/scripts/scan-skill.js`.

---

## 8. Testes (`dev/tests/`, `node:test`)

`npm test` = `node --test dev/tests/*.test.js`. Sem framework externo (Jest/Vitest) —
`node:test` nativo, zero dependência nova. 46 testes cobrindo:

- `loop-detect.test.js` / `post-edit-format.test.js` / `session-start-git-context.test.js`
  / `usage-log.test.js` — os 4 hooks
- `scan-skill.test.js` — as 6 regras do scanner + falsos-positivos (binário,
  `node_modules`)
- `validate-plugins.test.js` — o validador de schema, incluindo casos malformados de
  propósito
- `contrast-check.test.js` — as regras de contraste WCAG e tamanho mínimo de alvo de
  toque usadas por `/designreview`

Escopo deliberado: testa lógica de instalador/hook/script, não "qualidade" de skill —
mesmo princípio que a pesquisa achou no próprio ECC (maior projeto do gênero, só testa 2
coisas de conteúdo de skill em ~130 arquivos de teste).

---

## 9. CI (`.github/workflows/ci.yml`)

Dois jobs:

1. **`validate`** (ubuntu-latest): `npm ci` → `npx biome check .` → `npx biome format .`
   → `npx tsc` → `npm run validate:plugins` → `npm test`.
2. **`install-test`** (matriz `ubuntu-latest`/`windows-latest`): roda
   `dev/scripts/install.sh`/`install.ps1` de verdade contra um `$HOME` descartável (via
   os overrides `CLAUDE_HOME`/`OPENCODE_HOME` que os scripts já suportam nativamente),
   confere que os artefatos-chave existem e que `settings.json` é JSON válido, e roda o
   installer uma 2ª vez pra confirmar idempotência.

`biome.json`/`tsconfig.json` (raiz — ver seção 2 sobre por que não estão em `dev/`)
escopam `source/hooks/**/*.js`, `dev/scripts/*.js`, `dev/tests/**/*.js` — sem isso o
Biome varre `.opencode/`, `graphify-out/`, e outro conteúdo gerado/de terceiros que não
devia ser lintado.

---

## 10. Decisões de arquitetura que valem lembrar

- **Zero pegada em projeto consumidor** — regra central, não negociável. Tudo vive em
  `~/.claude/`/`~/.config/opencode/`.
- **`source/` → instalado é sempre um passo manual** (rodar o installer) — nunca
  automático, nunca silencioso, porque muda comportamento de toda sessão futura.
- **Merge, nunca overwrite** — todo arquivo gerenciado carrega o marcador
  `base_project:managed`; se existir um arquivo no destino sem esse marcador, o
  installer pula e avisa em vez de sobrescrever.
- **Catálogo à la carte, não bundle monolítico** — decisão deliberada e contrária ao
  padrão do ECC (que empacota tudo em 1 plugin só); ver ROADMAP para o raciocínio.
- **Prefira reimplementar como instrução a instalar dependência de terceiro** quando o
  valor real cabe em um parágrafo — aplicado às 4 skills de orquestração de prompt
  pesquisadas (caveman/skill-router/loop-verifier/task-sizing); nenhuma foi instalada,
  os textos relevantes foram portados direto pro `CLAUDE.md`/`reviewer.md`.
- **Hooks nunca bloqueiam por engolir exceção** — `loop-detect`/`post-edit-format`
  sempre em `try/catch`, sempre retornam sem quebrar o tool call que os disparou.

Para o histórico completo de *por que* cada decisão foi tomada (pesquisa, comparação com
ECC, trade-offs descartados), ver `ROADMAP.md`.
