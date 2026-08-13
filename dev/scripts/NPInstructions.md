# Como cadastrar um novo plugin no base_project

Guia de referência para adicionar um plugin/CLI/comando ao catálogo sem quebrar a
sintaxe do `plugins.json` nem a lógica de detecção do dashboard. Segue o padrão do
**Headroom**, um bom exemplo de `kind: cli`: aparece na sidebar com checklist
(✓ instalado), aparece com nome próprio em "Atividade recente", e é detectado via
`CLI_MAP` a partir do texto real do comando (`tool_input.command`), já que CLIs nunca
aparecem no `tool_name` do hook.

> Nota histórica: o catálogo já teve uma entrada **CodeBurn** (`kind: cli`, dashboard
> de custo de tokens). Foi removida — CodeBurn só *observa/computa* uso, não reduz
> custo nenhum, e sua integração (rodar `npx codeburn export` via `execFile` a cada
> refresh do dashboard) causou problemas recorrentes. Os erros #1 e #2 abaixo ainda
> citam CodeBurn como o CLI original que motivou aquelas correções — mantidos como
> estão porque a lição continua válida, mesmo com a ferramenta removida.

Este arquivo não é lido por nenhum script — é documentação para humano/agente, viva.
**Toda vez que descobrirmos um erro de implementação de plugin, ele entra na seção
"Erros conhecidos" no final, com sintoma → causa → correção.**

---

## As 3 peças que todo plugin precisa (ou pode precisar)

Um plugin "aparecer direito" no dashboard depende de até três arquivos, dependendo do
`kind` dele. Nem todo plugin precisa das três.

| Peça | Arquivo | Sempre necessário? |
|---|---|---|
| 1. Entrada no catálogo | `source/plugins.json` | Sim, sempre |
| 2. Detecção de uso | `source/dashboard/log-usage.js` | Sim, senão nunca aparece em "Atividade recente" nem vira ✓ na sidebar |
| 3. Descrição no dashboard | Nenhum — vem do `summary` do próprio catálogo | — |

A peça que mais gente esquece é a **2** — foi exatamente o que faltou para Ponytail e
Headroom (ver "Erros conhecidos" #1).

> Nota: `CORE_PLUGIN_IDS` em `server.js` existe e é enviado ao frontend
> (`corePluginIds` no `/api/snapshot`), mas hoje **não é consumido em lugar nenhum**
> — nem na lógica de `installed`, nem no client. Não confie nele para nada; se for
> mexer nisso, primeiro confirme se ele deveria fazer algo ou se é código morto pra
> remover.

---

## Passo a passo

### 1. Adicionar a entrada em `source/plugins.json`

Abra `source/plugins.json` e adicione um objeto ao array `catalog`. Copie a estrutura
mais próxima do seu caso:

**Se for um MCP server** (roda como um servidor, o agente chama via `mcp__<nome>__<tool>`):
```json
{
  "id": "meu-plugin",
  "name": "Meu Plugin MCP",
  "kind": "mcp",
  "summary": "Uma frase clara do que faz e quando ajuda.",
  "recommend_if": "Condição objetiva e verificável no projeto (ex: 'package.json depende de X').",
  "source": "https://link-do-projeto",
  "claude": { "scope": "local", "command": "npx", "args": ["-y", "@pacote/mcp-server"] },
  "opencode": { "command": "npx", "args": ["-y", "@pacote/mcp-server"] }
}
```

**Se for um CLI** (roda como comando de terminal, tipo `headroom`/`strix`):
```json
{
  "id": "meu-cli",
  "name": "Meu CLI",
  "kind": "cli",
  "summary": "Uma frase clara do que faz.",
  "recommend_if": "Universal — ajuda em qualquer projeto." ,
  "source": "https://link-do-projeto",
  "install": { "command": "pip", "args": ["install", "meu-cli"] }
}
```

**Se for uma skill** (Claude Code `/plugin install` ou `npx skills add`):
```json
{
  "id": "minha-skill",
  "name": "Minha Skill",
  "kind": "skill",
  "summary": "Uma frase clara do que faz.",
  "recommend_if": "Quando essa disciplina/comportamento ajuda.",
  "source": "https://link-do-projeto",
  "claude": { "command": "npx", "args": ["-y", "skills", "add", "autor/repo", "-g", "-a", "claude-code", "-y"] },
  "opencode": { "command": "npx", "args": ["-y", "skills", "add", "autor/repo", "-g", "-a", "opencode", "-y"] }
}
```

Regras de sintaxe do JSON (o erro mais comum que quebra o arquivo inteiro):
- **Vírgula entre objetos, nunca depois do último** do array.
- `id` é o identificador estável — minúsculo, sem espaço, é o que aparece em `PLUGIN_MAP`/`CLI_MAP` depois. Não muda depois de publicado (quebra o histórico de eventos já logados com o id antigo).
- Depois de editar, valide com `node -e "JSON.parse(require('fs').readFileSync('source/plugins.json', 'utf8'))"` antes de qualquer coisa — um JSON inválido derruba `/plugins`, `/api/snapshot` e a sidebar inteira silenciosamente.

### 2. Ensinar o dashboard a reconhecer o uso, em `source/dashboard/log-usage.js`

O hook (`PostToolUse`, `Stop`, `UserPromptExpansion`) só vê o nome técnico da
ferramenta chamada — nunca o nome do plugin por si só. `log-usage.js` precisa de uma
regra explícita ligando "o que aparece na chamada" ao `id` do catálogo. Existem
**quatro mecanismos diferentes**, dependendo de como o plugin é invocado — escolha o
que bate com o `kind` que você usou no passo 1. **Não presuma qual é o certo — capture
um payload real antes de escrever a regra** (veja o passo 3 para o método de captura).

#### a) MCP server → `PLUGIN_MAP`
Se o agente chama via `mcp__<nome-do-servidor>__<tool>`, adicione uma entrada em
`PLUGIN_MAP` (chave = nome do servidor MCP como aparece no `mcp__X__` real, valor =
`id` do catálogo):
```js
const PLUGIN_MAP = {
  // ...
  "meu-plugin": "meu-plugin",
};
```
Confirme o nome exato do servidor MCP olhando um evento real no log
(`~/.base_project/usage.jsonl`, campo `tool`) ou no `mcp.json` de registro.

#### b) CLI chamado via Bash → `CLI_MAP`
Se o plugin é um comando de terminal (`headroom --version`, `pip install
strix-agent`), ele **nunca aparece no nome da ferramenta** — só dentro do
texto do comando (`tool_input.command`). Adicione a substring que identifica o
comando:
```js
const CLI_MAP = {
  // ...
  "meu-cli": "meu-cli",
};
```
Use a substring mais específica possível (evite algo tão genérico que combine com
comandos de outros projetos por acaso).

#### c) Skill (`kind: skill`) → `SKILL_MAP` — **NUNCA `PLUGIN_MAP`**
Toda Skill, sem exceção, reporta `tool_name: "Skill"` — nunca o nome dela. O nome
real só existe em `tool_input.skill` (confirmado capturando um payload real: veja
"Erros conhecidos" #4). Um match por substring contra `tool_name` (como `PLUGIN_MAP`
faz) **nunca vai funcionar** para skill nenhuma — é um erro fácil de cometer porque
parece que devia funcionar. Adicione em `SKILL_MAP` (chave = valor exato de
`tool_input.skill`, valor = `id` do catálogo):
```js
const SKILL_MAP = {
  // ...
  "minha-skill": "minha-skill",
};
```
Se o pacote empacota várias skills sob um `id` só do catálogo (ex: `skill-ui` cobre
`frontend-design` + `baseline-ui` + `fixing-accessibility`), mapeie cada nome real
para o mesmo `id`.

#### d) Slash command nativo do base_project → `COMMAND_IDS`
Só se aplica aos comandos que o próprio base_project ship (`/council`, `/bootstrap`,
etc. — não plugins de terceiros). Se você está adicionando um comando novo em
`source/claude/commands/*.md`, adicione o `id` (sem a barra) em:
```js
const COMMAND_IDS = new Set([..., "meu-comando"]);
```
E também registre o mesmo `id` em `BUILTIN_COMMANDS` dentro de `source/dashboard/server.js`
(é o que faz ele aparecer marcado ✓ sempre na sidebar, já que comandos nativos não
são "opcionais").

### 3. Sincronizar e testar

`log-usage.js` e `server.js` existem em duas cópias: a fonte (`source/dashboard/`) e
a instalada (`~/.claude/base_project/dashboard/`, `~/.config/opencode/base_project/dashboard/`).
Editar só a fonte não é suficiente para efeito imediato nesta máquina — ou rode o
instalador (`dev/scripts/install.ps1`/`dev/scripts/install.sh`) de novo, ou copie manualmente
para testar rápido:

```powershell
Copy-Item source\dashboard\log-usage.js "$env:USERPROFILE\.claude\base_project\dashboard\log-usage.js" -Force
```

Depois teste a detecção isolada, sem precisar disparar um hook de verdade:
```powershell
node -c source\dashboard\log-usage.js   # sintaxe
echo '{"tool_name":"Bash","tool_input":{"command":"npx meu-cli --help"}}' | node source\dashboard\log-usage.js
type "$env:USERPROFILE\.base_project\usage.jsonl" | Select-Object -Last 1
# a última linha deve ter "plugin":"meu-cli"
```

Se for MCP, simule com `tool_name` no formato real: `mcp__meu-plugin__algumTool`.
Se for slash command, teste com `--prompt-expansion`:
```powershell
echo '{"command_name":"meu-comando"}' | node source\dashboard\log-usage.js --prompt-expansion
```

**Nunca** valide só lendo o código — sempre rode e confira a linha real gravada no
`usage.jsonl`. A causa mais comum de "não aparece no dashboard" é confiar que a regra
está certa sem testar o caminho real do dado.

#### Quando você não sabe o formato exato do payload (ex: um `kind` novo, ou uma dúvida tipo "onde fica o nome da skill?")

Não adivinhe — capture um payload real. Registre um hook `PostToolUse` temporário
extra que só grava o JSON bruto num arquivo, dispare a ação real (ex: rode a skill),
leia o arquivo, e **remova o hook temporário depois**:

```powershell
# 1. Adiciona um hook extra que só grava tudo que recebe
$s = Get-Content "$env:USERPROFILE\.claude\settings.json" -Raw | ConvertFrom-Json
$s.hooks.PostToolUse += @{ hooks = @(@{ type = "command"; command = 'node -e "process.stdin.pipe(require(\"fs\").createWriteStream(\"C:\\temp\\capture.jsonl\", {flags:\"a\"}))"'; async = $true }) }
$s | ConvertTo-Json -Depth 10 | Set-Content "$env:USERPROFILE\.claude\settings.json"

# 2. Dispare a ação de verdade (rode a skill/comando/mcp que você quer inspecionar)

# 3. Leia o payload capturado
Get-Content C:\temp\capture.jsonl -Tail 1

# 4. IMPORTANTE: remova o hook temporário depois (repita o passo 1 filtrando
#    a entrada que contém "capture.jsonl" antes de salvar) — nunca deixe
#    esse hook de debug registrado permanentemente.
```
Foi assim que descobrimos que skills usam `tool_input.skill` (erro #4 abaixo) — a
documentação pública do Claude Code não descreve esse campo.

---

## Erros conhecidos (adicionar aqui sempre que descobrirmos um novo)

Formato: **sintoma** → **causa** → **correção**. Mais recente no topo.

### #7 — Plugin genuinamente instalado (via `claude plugin install`) aparece como "não instalado" na sidebar, mesmo já corrigido o `/api/setup-check`
- **Sintoma**: instalei `impeccable` e `frontend-design` de verdade (`claude plugin list --json` confirma), mas a sidebar do dashboard (checklist do catálogo) continuava mostrando o checkbox vazio pra eles — só sumiam do card de "Configuração pendente", não ganhavam ✓ na sidebar.
- **Causa**: `/api/snapshot` (a rota que alimenta a sidebar) e `/api/setup-check` (o card de pendências) usavam **fontes de verdade diferentes e desconectadas** pra responder a mesma pergunta ("esse plugin está instalado?"). `/api/setup-check` já tinha `installedClaudePlugins()` (via `claude plugin list --json`, ver erro #6) desde a correção anterior — mas `/api/snapshot` calculava `installed` só como `usedIds.has(p.id)`, isto é, só olhava se o plugin **já apareceu em algum evento do `usage.jsonl`**, nunca se está instalado-mas-nunca-usado.
- **Correção**: adicionar um campo opcional `pluginName` às entradas do catálogo (`plugins.json`) cujo id não bate com o nome real do plugin instalado (ex: catálogo `skill-ui` → plugin real `frontend-design`). Em `/api/snapshot`, calcular `installed` como `used || (pluginName && installedClaudePlugins().has(pluginName))` — a mesma função que o `/api/setup-check` já usava, só que agora chamada nos dois lugares. O frontend passou a distinguir três estados (não instalado / instalado mas não usado / instalado e usado) em vez de só dois.
- **Lição**: quando duas rotas de uma mesma API respondem perguntas relacionadas ("está pendente?" vs "está instalado?"), desconfie se cada uma tem sua própria lógica de detecção — é fácil corrigir uma e esquecer que a outra faz a mesma pergunta de um jeito mais fraco. Plugins/skills sem registro central (instalados via `npx skills add`, sem passar por `claude plugin list`) não têm como ser verificados dessa forma — para esses, "instalado" continua sendo só "já foi usado pelo menos uma vez", uma limitação real, não escondida.

### #6 — `execFileSync("claude", ...)` falha com `ENOENT` no Windows mesmo com `claude` funcionando normalmente no terminal
- **Sintoma**: uma função nova que chama `claude plugin list --json` via `execFileSync` pra detectar plugins instalados sempre cai no `catch` e retorna "status desconhecido", mesmo rodando `claude plugin list --json` manualmente no mesmo terminal sem erro nenhum.
- **Causa**: no Windows, `claude` é um shim `.cmd`/`.ps1`, não um `.exe` direto. `execFileSync`/`execFile` sem `shell: true` não conseguem resolver isso — dá `ENOENT` mesmo com o binário certinho no PATH. É o mesmo problema de fundo que já causava o bug de remoção de MCP no `install.ps1` (ver notas desse script).
- **Correção**: adicionar `shell: process.platform === "win32"` nas opções do `execFileSync`/`execFile` sempre que o comando invocado for `claude` (ou qualquer outro `.cmd` shim do Node/npm). Os args continuam como array separado — como são strings literais fixas no código, não input do usuário, não há risco de injeção pelo shell.
- **Lição**: teste esse tipo de chamada no ambiente real de execução (PowerShell/terminal do Windows), não só assumindo que "funciona no terminal" implica "funciona via `execFileSync`" — são runtimes de resolução de comando diferentes.

### #5 — Ids de plugin no catálogo (`plugins.json`) não batem com o nome real do plugin instalável, e a marketplace sugerida nem existe com esse nome
- **Sintoma**: seguir a instrução `claude` do catálogo (`/plugin install X@claude-plugins-official`, `/plugin marketplace add anthropics/skills`) falha: `Invalid marketplace source format` ou `Plugin not found in marketplace`.
- **Causa**: duas confusões empilhadas. (1) `claude plugin marketplace add` espera `owner/repo` (ou URL/path), não um nome de marketplace — o nome de exibição é *derivado* pelo Claude Code a partir do repo (`anthropics/claude-code` → `claude-code-plugins`; `anthropics/skills` → `anthropic-agent-skills`), então "claude-plugins-official" nunca foi um source válido, só um nome de repositório-diretório sem relação direta com o comando de registro. (2) `mcp-builder` e `webapp-testing` não são plugins próprios — são duas *skills* dentro de um único plugin chamado `example-skills`, então não dá pra instalar um sem o outro, e o catálogo tinha as duas como entradas separadas incorretamente.
- **Correção**: sempre confirme o `owner/repo` real rodando `claude plugin marketplace add <owner/repo>` uma vez e lendo o nome que ele retorna (ou inspecionando `~/.claude/plugins/marketplaces/<nome>/.claude-plugin/marketplace.json`, que lista os `plugins[].name` reais e as `skills[]` de cada um) antes de escrever a instrução no catálogo. Corrigido `skill-ui` (aponta pro plugin real `frontend-design@claude-code-plugins`) e fundido `mcp-builder`+`webapp-testing` numa única entrada `example-skills` (instala `example-skills@anthropic-agent-skills`).
- **Lição**: nunca documente um comando de instalação sem executá-lo de verdade uma vez — o nome "óbvio" de uma marketplace ou plugin quase nunca é o identificador real que o Claude Code usa internamente.

### #4 — Skills (Ponytail e qualquer outra) nunca marcam ✓ nem aparecem em Atividade recente, mesmo com a entrada certa no mapa
- **Sintoma**: `ponytail: "ponytail"` já estava em `PLUGIN_MAP` desde o erro #1, parecia corrigido, mas continuou nunca aparecendo — inclusive rodando a skill de verdade repetidas vezes.
- **Causa**: `PLUGIN_MAP` casa por substring contra `tool_name`. Mas **toda** Skill, sem exceção, reporta `tool_name: "Skill"` — nunca o nome próprio dela. `lower.includes(key)` testando `"skill".includes("ponytail")` nunca é `true`. Confirmado capturando um payload real (ver técnica de captura acima): `{"tool_name":"Skill","tool_input":{"skill":"ponytail-help"}}` — o nome de verdade mora em `tool_input.skill`, um campo que a documentação pública do Claude Code não descreve.
- **Correção**: criado `SKILL_MAP`, um mapa separado de `PLUGIN_MAP`, consultado quando `toolName === "Skill"` lendo `tool_input.skill` em vez de `tool_name`. Ver passo 2c acima.
- **Lição**: "está no mapa" não é o mesmo que "está sendo consultado no lugar certo". Sempre capture um payload real antes de confiar que uma regra de detecção vai funcionar — não escreva a regra e assuma que vai bater.

### #3 — `desktop.ini` de um passo de instalação anterior bloqueia reinstalação
- **Sintoma**: `install.ps1` falha com `UnauthorizedAccessException` ao tentar escrever um arquivo que ele mesmo criou numa execução anterior.
- **Causa**: o arquivo ficou marcado `hidden`/`system` pela execução anterior, e `WriteAllText` não sobrescreve arquivos com esses atributos.
- **Correção**: sempre que um passo do instalador marca um arquivo como hidden/system, o próprio passo precisa limpar esses atributos (`attrib -h -s`) **antes** de tentar reescrever, não só na primeira vez.

### #2 — Comando que roda um CLI (`npx codeburn`, `pip install headroom`) nunca aparece na Atividade recente, mesmo funcionando
- **Sintoma**: você usa `/council` ou roda `npx codeburn export` e nada aparece com o nome do plugin — some como "Ferramentas nativas" genérico.
- **Causa**: o hook `PostToolUse` só recebe `tool_name` (ex: `"Bash"`), nunca o texto do comando nem o nome do slash command por trás. `resolvePlugin` antigo só olhava `tool_name`.
- **Correção**: dois mecanismos novos, cobrindo os dois casos:
  1. CLIs → ler `tool_input.command` (o texto real do shell) e casar substring contra `CLI_MAP`.
  2. Slash commands → não tem como detectar via `PostToolUse` de jeito nenhum; foi preciso adicionar um hook novo, `UserPromptExpansion` (o único evento do Claude Code que carrega `command_name`), registrado em `settings.json`/`install.ps1`/`install.sh` além do `PostToolUse` que já existia.
- **Lição**: antes de assumir "é só adicionar no PLUGIN_MAP", confirme qual hook realmente vê o dado que você precisa — nem tudo passa por `PostToolUse`.

### #1 — Plugin instalado e funcionando, mas nunca aparece como usado no dashboard
- **Sintoma**: instalei o Ponytail e o Headroom, usei os dois, mas a sidebar nunca marca ✓ e "Atividade recente" não mostra o nome.
- **Causa**: `log-usage.js` tinha um `PLUGIN_MAP` fixo que nunca foi atualizado quando os plugins foram adicionados ao catálogo — o passo 2 deste guia (a peça mais esquecida) simplesmente não tinha sido feito.
- **Correção**: adicionar as entradas faltantes no mapa certo (Ponytail é uma skill que aparece como MCP-like → `PLUGIN_MAP`; CodeBurn/Headroom são CLIs → acabaram criando o `CLI_MAP`, que não existia até este erro).
- **Lição**: toda vez que uma entrada nova entra em `plugins.json`, o passo 2 (`log-usage.js`) é obrigatório no mesmo commit — nunca "depois eu adiciono a detecção".

<!-- Próximo erro descoberto: adicionar acima desta linha, mais recente no topo. -->