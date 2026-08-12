# base_project — arquitetura interna

Este documento é sobre **como o código funciona por dentro** — funções, arquivos, fluxo
de dados. Para a visão de usuário (o que instalar, como usar `/plugins`, etc.), veja
`README.md`. Para o histórico de decisões e o que falta fazer, veja `ROADMAP.md`. Para
lições aprendidas com bugs reais, veja `CLAUDE.md` (regras deste repo) e
`scripts/NPInstructions.md` (erros conhecidos do catálogo de plugins).

---

## 1. O que este projeto é, em uma frase

Um instalador (`scripts/install.ps1` / `install.sh`) que copia arquivos de `source/`
para `~/.claude/` e `~/.config/opencode/` — nada mais. Não é um servidor rodando o
tempo todo, não é um pacote npm publicado, não escreve nada dentro de projetos que o
usam. O "produto" real são os arquivos que acabam instalados: regras globais, 3
subagentes, 5 comandos, um catálogo de plugins opcionais, um dashboard local, e 2 hooks
com comportamento real.

---

## 2. Mapa de diretórios

```
base_project/
├── source/                    ← ORIGEM. Tudo aqui é "distribuído" pelo installer.
│   ├── CLAUDE.md               → ~/.claude/CLAUDE.md (bloco delimitado)
│   ├── opencode-instructions.md→ linkado de ~/.config/opencode/opencode.jsonc
│   ├── claude/
│   │   ├── agents/*.md         → ~/.claude/agents/       (architect, coder, reviewer)
│   │   └── commands/*.md       → ~/.claude/commands/     (/bootstrap /audit /plugins /council /dashboard)
│   ├── opencode/
│   │   ├── agent/*.md          → ~/.config/opencode/agent/     (mesmo trio, formato opencode)
│   │   ├── command/*.md        → ~/.config/opencode/command/   (mesmos comandos, formato opencode)
│   │   └── mcp.json            → ~/.config/opencode/mcp.json + registrado via `claude mcp add`
│   ├── plugins.json            → ~/.claude/base_project/plugins.json (+ cópia opencode)
│   ├── dashboard/*.js          → ~/.claude/base_project/dashboard/ (+ cópia opencode)
│   └── hooks/*.js              → ~/.claude/base_project/hooks/
│
├── scripts/
│   ├── install.ps1 / install.sh   ← o instalador de verdade (idempotente, faz merge não overwrite)
│   ├── validate-plugins.js        ← CLI: valida source/plugins.json contra o schema (ajv)
│   ├── scan-skill.js              ← CLI: scan leve de segurança pra skills de terceiro
│   └── NPInstructions.md          ← guia "como cadastrar plugin novo" + ledger de erros conhecidos
│
├── schemas/
│   └── plugins.schema.json     ← JSON Schema draft-07 validando a forma de plugins.json
│
├── tests/                      ← node:test, roda com `npm test`
│
├── .github/workflows/ci.yml    ← lint, typecheck, schema, testes, e testa os instaladores de verdade
├── biome.json / tsconfig.json  ← escopo: source/dashboard, source/hooks, scripts/*.js, tests/
├── package.json                ← só tooling de dev (ajv, biome, typescript) — não é `npm publish`
├── README.md                   ← visão de usuário
├── ROADMAP.md                  ← histórico de decisões, o que foi feito e por quê, o que ficou de fora
└── ARCHITECTURE.md             ← este arquivo
```

**Regra de sincronização**: editar só `source/` não tem efeito imediato na máquina —
`source/` é o "código-fonte", os arquivos instalados em `~/.claude/base_project/` são o
"binário". Depois de editar `source/`, rode o installer de novo (`install.ps1`/`.sh`)
pra sincronizar. Ver seção 7.

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

## 4. Os 5 comandos

Arquivos: `source/claude/commands/*.md` + `source/opencode/command/*.md`.

| Comando | O que faz |
|---|---|
| `/bootstrap` | Mapeia o projeto atual em `graphify-out/` + `repomix-output.xml` (contexto eficiente em tokens). |
| `/audit` | Scan de segurança (vulnerabilidade de dependência, segredo exposto). Usa Strix se instalado, senão `npm audit`/`pip-audit` + `gitleaks`/`trufflehog`. |
| `/plugins` | Lê `plugins.json`, recomenda plugins pro projeto atual, instala os escolhidos. Aceita um preset (`/plugins minimal`) que pula a etapa de recomendação. Depois de instalar uma skill de terceiro, roda `scan-skill.js` na pasta baixada antes de dizer que está pronta pra uso. |
| `/council` | Pressão-testa uma decisão difícil através de 5 perspectivas de conselheiro independentes + veredito sintetizado. |
| `/dashboard` | Abre o dashboard local (`http://127.0.0.1:4317`). |

---

## 5. O catálogo de plugins (`plugins.json`)

**Schema**: `schemas/plugins.schema.json` (JSON Schema draft-07). Raiz exige
`_managed_by` (const `"base_project"`) e `catalog` (array). Cada `catalogEntry` exige
`id`/`name`/`kind` (`mcp`|`cli`|`skill`)/`summary`/`recommend_if`; campos opcionais
incluem `pluginName` (nome real do plugin instalado, quando difere do `id`),
`dependsOn` (ainda não populado — ver seção 5.1), `claude`/`opencode` (blocos de
instalação por engine), `install` (comando CLI).

**Validação**: `scripts/validate-plugins.js` compila o schema com `ajv`+`ajv-formats`,
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

## 6. O dashboard

### 6.1 Peças e por que existem separadas

```
source/dashboard/
├── server.js              ← servidor HTTP + página HTML/CSS/JS embutida como string (PAGE)
├── lib/snapshot.js         ← lógica PURA, sem I/O top-level — o que é testável
├── log-usage.js            ← hook do Claude Code (PostToolUse/Stop/UserPromptExpansion)
├── opencode-usage-logger.js← plugin do opencode (tool.execute.after) — mesmo log compartilhado
└── launch.js                ← abre o navegador, garante que o server está rodando
```

`server.js` **não é testável por unit test diretamente** — ele abre um `DatabaseSync`
(SQLite) e chama `server.listen()` incondicionalmente no top-level assim que é
`require()`-ado. Por isso a lógica pura (normalizar path de projeto, ler eventos do log,
ler o catálogo, montar o snapshot de "instalado") foi extraída pra `lib/snapshot.js` —
zero I/O no top-level, seguro pra importar em teste sem tocar no SQLite/porta reais.
`server.js` importa essas funções de `lib/snapshot.js` em vez de redefini-las.

### 6.2 Como um evento chega no dashboard

```
Você usa uma tool no Claude Code (Bash, Edit, Skill, MCP call, ...)
        │
        ▼
Hook PostToolUse dispara → node log-usage.js
        │  (lê stdin: {tool_name, tool_input, session_id, prompt_id, ...})
        ▼
resolvePlugin(tool_name, tool_input) decide QUAL plugin/CLI/skill isso representa:
  - tool_name === "Skill"     → olha tool_input.skill contra SKILL_MAP
  - tool_name = "mcp__X__Y"    → olha o segmento X contra PLUGIN_MAP
  - tool_name === "Bash"       → olha o TEXTO do comando contra CLI_MAP
        │
        ▼
Uma linha JSON é apendada em ~/.base_project/usage.jsonl (arquivo compartilhado,
multi-projeto — cada linha tem `project: process.cwd()`)
        │
        ▼
server.js (watchLog) detecta o arquivo cresceu, lê só as linhas novas,
filtra pra eventos do projeto que cada cliente conectado está olhando,
e envia via Server-Sent Events (/api/stream) — atualização real-time, não polling
```

`opencode-usage-logger.js` é o mesmo conceito, formato de plugin do opencode
(`tool.execute.after`) em vez de hook do Claude Code — escreve no MESMO
`usage.jsonl`, então o dashboard mostra os dois engines juntos.

### 6.3 A lógica de "instalado" (o bug que motivou o item 1 do ROADMAP)

`buildCatalogSnapshot(catalog, events, claudePlugins)` em `lib/snapshot.js` calcula, pra
cada entrada do catálogo:

```js
used              = usedIds.has(entry.id)                          // já apareceu em algum evento?
installedViaPlugin = entry.pluginName && claudePlugins?.has(entry.pluginName)  // `claude plugin list` confirma?
installed          = used || installedViaPlugin
```

`claudePlugins` vem de `installedClaudePlugins()` em `server.js`, que chama
`claude plugin list --json` via `execFileSync` (com `shell: true` no Windows, porque
`claude` resolve pra um `.cmd` shim que não spawna direto sem shell). Isso cobre plugins
de verdade instalados via `claude plugin install` (ex: `skill-ui`, `impeccable`) mesmo
que nunca tenham sido usados ainda. Skills soltas instaladas via `npx skills add` (ex:
`emil-design-eng`, `taste-skill`) não têm registro central — pra essas, `installed` só
vira `true` depois do primeiro uso real.

### 6.4 Endpoints HTTP

| Rota | Método | Faz |
|---|---|---|
| `/` | GET | Serve a página (`PAGE`, HTML+CSS+JS inline em uma template string) |
| `/api/snapshot` | GET | Catálogo + eventos do projeto (`?project=`) + estado salvo |
| `/api/ui-prefs` | POST | Salva preferência de UI (seção expandida, etc.) no SQLite local |
| `/api/update-check` | GET | Verifica se o repo do base_project tem commits novos no remoto |
| `/api/setup-check` | GET | Roda `runSetupCheck()` — Docker, token do GitHub MCP placeholder, plugins pendentes |
| `/api/graphify` | GET | Status do último `graphify update` rodado no projeto |
| `/graph-file` | GET | Serve o `graph.json` do graphify pra visualização |
| `/api/stream` | GET (SSE) | Server-Sent Events — push de eventos novos em tempo real |

### 6.5 Estado local (SQLite)

`~/.base_project/state.db`, tabela `project_state (project, last_opened_at,
last_graph_seen_at, ui_prefs)`. Guarda só preferências/timestamps por projeto — não
duplica o log de eventos (esse continua sendo só o `.jsonl`).

---

## 7. Os 3 hooks com comportamento real

Diferente de `log-usage.js` (que só observa/loga, nunca bloqueia), estes três têm efeito
de verdade. Nenhum **falha** o tool call/sessão que os disparou (tudo dentro de
`try/catch` que engole erro).

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

**Importante**: editar esses arquivos em `source/hooks/` não muda o comportamento da sua
sessão atual — o `settings.json` real só é atualizado rodando o installer de novo (ele
faz merge idempotente na lista de hooks, preservando qualquer hook seu que não seja do
base_project).

---

## 8. Scan de segurança pra skill de terceiro (`scripts/scan-skill.js`)

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

## 9. Testes (`tests/`, `node:test`)

`npm test` = `node --test tests/*.test.js`. Sem framework externo (Jest/Vitest) —
`node:test` nativo, zero dependência nova. 39 testes cobrindo:

- `snapshot.test.js` — `lib/snapshot.js` (normalização de path, filtro de eventos por
  projeto, lógica de `installed`, resolução de perfil)
- `log-usage.test.js` — `resolvePlugin`/`resolveCommand` (os 3 caminhos de detecção:
  Skill/MCP/Bash)
- `loop-detect.test.js` / `post-edit-format.test.js` / `session-start-git-context.test.js`
  — os 3 hooks
- `scan-skill.test.js` — as 6 regras do scanner + falsos-positivos (binário,
  `node_modules`)
- `validate-plugins.test.js` — o validador de schema, incluindo casos malformados de
  propósito

Escopo deliberado: testa lógica de instalador/hook/script, não "qualidade" de skill —
mesmo princípio que a pesquisa achou no próprio ECC (maior projeto do gênero, só testa 2
coisas de conteúdo de skill em ~130 arquivos de teste).

---

## 10. CI (`.github/workflows/ci.yml`)

Dois jobs:

1. **`validate`** (ubuntu-latest): `npm ci` → Biome lint → Biome format → `tsc` →
   `npm run validate:plugins` → `npm test`.
2. **`install-test`** (matriz `ubuntu-latest`/`windows-latest`): roda `install.sh`/
   `install.ps1` de verdade contra um `$HOME` descartável (via os overrides
   `CLAUDE_HOME`/`OPENCODE_HOME` que os scripts já suportam nativamente), confere que os
   artefatos-chave existem e que `settings.json` é JSON válido, e roda o installer uma
   2ª vez pra confirmar idempotência.

`biome.json`/`tsconfig.json` escopam a `source/dashboard/**/*.js`, `source/hooks/**/*.js`,
`scripts/*.js`, `tests/**/*.js` — sem isso o Biome varre `.opencode/`, `graphify-out/`,
e outro conteúdo gerado/de terceiros que não devia ser lintado.

---

## 11. Decisões de arquitetura que valem lembrar

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
