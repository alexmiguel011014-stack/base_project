# REPERTOIRE.md — Skills/ferramentas passivas de otimização (estilo graphify)

Pesquisa avulsa (standalone), não ligada a nenhum `GOALS.md` — feita a pedido direto do
usuário depois de perceber que uma resposta anterior sobre "como ser mais acertivo" tinha
respondido a pergunta errada (raciocínio interno em geral, não "existe uma skill passiva
tipo graphify que otimiza o fluxo sem eu precisar chamar toda vez?"). Pesquisa em tempo real
na web, sem acesso a base paga/fechada.

**Pergunta central**: existem skills/plugins/MCPs/hooks para Claude Code (ou agentes de
código equivalentes) que rodam **passivamente** — acionados por hook ou nativos, sem o
usuário precisar digitar um comando toda vez — com o objetivo de otimizar fluxo de trabalho,
reduzir tokens, ou melhorar acurácia?

## Lentes pesquisadas: Competitivo/landscape (principal) + Mídia/discurso (secundário)
Científico, regulatório e cultural julgados não aplicáveis — é pergunta de ferramenta técnica.

---

## O que existe de real (por mecanismo de ativação)

### 1. Nativo do próprio Claude Code — já passivo, sem instalar nada

**Auto Memory** (desde v2.1.59, fev/2026, ligado por padrão): Claude escreve seu próprio
`MEMORY.md` (arquivo índice, ≤200 linhas/25KB) enquanto trabalha, dando continuidade
básica entre sessões do mesmo projeto sem qualquer comando do usuário. Atualização de
abril/2026 chegou a 91,6% de acurácia no benchmark LoCoMo usando ~3-4x menos tokens que
enviar o contexto inteiro.

**Auto Dream**: subagente em segundo plano que consolida os arquivos de auto-memory —
relê transcripts de sessões recentes, reescreve o diretório de memória mantendo fatos que
ainda valem, apagando os contraditados, mesclando duplicatas. Roda sozinho, sem comando.

**Correção depois de checar**: minha primeira leitura chamou isso de "sistema de memória
manual do base_project" — errado. Grep em `source/CLAUDE.md`, `opencode-instructions.md` e
`codex/AGENTS.md` confirma **zero menção** a memória/`MEMORY.md`. O base_project não tem
sistema de memória próprio; os arquivos `~/.claude/projects/<hash>/memory/*.md` +
`MEMORY.md` que já uso nesta própria conversa **são o Auto Memory nativo em si**, não algo
que o base_project construiu. O que o base_project tem de fato é o ledger de uso
(`usage-log.js` → `/reviewusage`/`/diario`) — um log cru de chamadas de ferramenta, coisa
completamente diferente de memória de fatos/preferências. Não há redundância pra resolver
aqui; era um achado impreciso, não uma decisão pendente. Ver detalhamento no início desta
seção para o que o Auto Memory faz de verdade.

### 2. PreToolUse hook que reescreve saída de comando — passivo depois de 1 setup

**RTK — Rust Token Killer** (`rtk-ai/rtk`, binário Rust único, zero dependências).
`rtk init -g` instala 1 vez um hook `PreToolUse` que intercepta chamadas `Bash` e reescreve
pra equivalentes comprimidas antes de chegar no modelo — sem o usuário fazer nada depois
disso. Entende semântica de 100+ comandos de dev (ex: `npm install` vira 1 linha, `cargo
test` colapsa centenas de "ok" em 1 contagem). Reduz 60-90% dos tokens em comandos de shell
comuns. **Limitação real**: só cobre chamadas `Bash` — `Read`/`Grep`/`Glob` (as ferramentas
que o `/bootstrap` deste projeto mais usa) não passam pelo hook.

Documentado de forma consistente por múltiplas fontes independentes (blog oficial da
JetBrains, DEV Community, site dedicado, Codex Knowledge Base) — credibilidade alta, produto
maduro, não é vaporware.

### 3. MCP server — passivo enquanto conectado, sem comando por chamada

**Serena** (`oraios/serena`). Toolkit MCP em Python: retrieval e edição semântica de código
símbolo por símbolo (`find_symbol`, `find_referencing_symbols`) via Language Server Protocol,
30+ linguagens. Uma vez conectado como MCP, qualquer agente (Claude Code, Codex, outros)
ganha navegação por símbolo automaticamente — não precisa "chamar" nada, é ferramenta
disponível o tempo todo. **É o análogo mais próximo do espírito do graphify** encontrado
nesta pesquisa: "buscar símbolo antes de abrir arquivo inteiro" é exatamente a ideia do
item da sua lista original de otimizações. Diferença: Serena é genérico/multi-agente e
baseado em LSP (análise estrutural), graphify é um grafo semântico com clustering e god
nodes — abordagens complementares, não concorrentes diretas.

Fonte primária (docs oficiais + repo) mais múltiplas coberturas de terceiros (Medium,
LobeHub, review 2026) — credibilidade alta.

### 4. Read-only, mede mas não modifica comportamento

**ccusage** (npm). Lê os JSONL que o próprio Claude Code já grava em
`~/.claude/projects/`, sem chamada de API própria, sem chave separada — mesma filosofia do
`usage-log.js`/`reviewusage` deste projeto ("escreve burro, lê esperto" já é o padrão que
o base_project também adotou). Tem integração de status-line (mostra uso compacto direto na
barra do editor). Não otimiza nada sozinho, só reporta — mais próximo de um `/reviewusage`
de terceiros do que de um graphify.

Bem documentado (npm, análise de segurança via Socket.dev, múltiplos guias independentes)
— credibilidade alta.

### 5. Roteador de modelo automático — categoria confirmada, maturidade incerta

Existe uma categoria real e ativa de "model router" pra Claude Code — a topic tag
`claude-code-router` no GitHub tem múltiplos projetos independentes: `bmersereau/claude-router`,
`soumabali/token-router`, `tzachbon/claude-model-router-hook`, `bijumailbox/claude-auto-router`,
`hermes-labs-ai/claude-router`, entre outros. Todos fazem essencialmente a mesma coisa que a
"Model Router" da sua lista original: analisar complexidade da tarefa e escolher
Haiku/Sonnet/Opus automaticamente, alguns via hook de sessão, outros como proxy local.

**Honestidade sobre confiabilidade**: a busca confirma que a categoria existe e é ativa (o
próprio GitHub tem uma topic tag dedicada), mas não consegui verificar contagem de estrelas,
manutenção recente, ou maturidade de nenhum repositório específico a partir da pesquisa —
são muitos projetos individuais pequenos, não um padrão único consolidado. Diferente de RTK
e Serena (fontes múltiplas e independentes confirmando maturidade), aqui a confiança é
"a categoria é real", não "este repo específico é confiável" — antes de adotar qualquer um,
vale abrir o repo e olhar estrelas/commits recentes/issues você mesmo.

---

## Síntese pra sua pergunta original

Sim — existe uma categoria real de "skills passivas tipo graphify", e ela se divide em 3
mecanismos concretos de ativação sem comando repetido: **nativo** (Auto Memory/Dream, já
ligado), **hook automático depois de 1 setup** (RTK), **MCP sempre conectado** (Serena).
Nenhum desses é "instale e pronto, resolve tudo" — cada um cobre uma fatia (compressão de
saída de shell, navegação semântica, memória entre sessões), não o pacote completo que a sua
lista original de otimizações descrevia (isso continua sendo trabalho de integração, não
algo pra baixar pronto).

**Achado mais informativo do que os outros**: Auto Memory ser nativo desde fevereiro
significa que "memória de fatos/preferências entre sessões" já vem resolvido pelo próprio
Claude Code, de graça, sem o base_project precisar construir nada — **correção**: checado
via grep, não existe sistema de memória do base_project pra ficar redundante com isso (ver
acima). O que sobra de relevante pra ideia de "aprendizado histórico" da lista original de
otimizações é diferente: aquilo mirava em *dados de execução de goals* (modelo usado,
esforço, tokens, tentativas, resultado) — isso é o ledger de uso (`usage-log.js`), não
memória de fatos, e continua sem equivalente nativo.

## Sources consulted

- [RTK: Cut Your AI Coding Bill by 80% With One CLI Tool — DEV Community](https://dev.to/arshtechpro/how-rtk-reduces-llm-token-usage-for-ai-coding-agents-2kfd)
- [rtk Claude Code Token Savings: A Skill Trial Benchmark — JetBrains Blog](https://blog.jetbrains.com/ai/2026/07/rtk-claude-code-token-savings/)
- [GitHub - rtk-ai/rtk](https://github.com/rtk-ai/rtk)
- [RTK — Rust Token Killer (site oficial)](https://www.rtk-ai.app/)
- [RTK and Codex CLI: Killing Token Waste at the Shell Boundary](https://codex.danielvaughan.com/2026/05/19/rtk-codex-cli-token-optimisation-shell-output-compression/)
- [GitHub - oraios/serena](https://github.com/oraios/serena)
- [About Serena — Serena Documentation (oficial)](https://oraios.github.io/serena/01-about/000_intro.html)
- [Deconstructing Serena's MCP-Powered Semantic Code Understanding Architecture — Medium](https://medium.com/@souradip1000/deconstructing-serenas-mcp-powered-semantic-code-understanding-architecture-75802515d116)
- [Serena Review 2026 — Vibe Coding Hub](https://vibecodinghub.org/tools/serena)
- [ccusage — npm](https://www.npmjs.com/package/ccusage)
- [ccusage - npm Package Security Analysis — Socket](https://socket.dev/npm/package/ccusage)
- [How to Track Claude Code Usage in 2026 — DEV Community](https://dev.to/pederaa/how-to-track-claude-code-usage-in-2026-built-in-commands-ccusage-and-desktop-dashboards-compared-1kk1)
- [Anthropic Just Added Auto-Memory to Claude Code — MEMORY.md (I Tested It) — Medium](https://medium.com/@joe.njenga/anthropic-just-added-auto-memory-to-claude-code-memory-md-i-tested-it-0ab8422754d2)
- [Claude Code Dreams: Anthropic's New Memory Feature — claudefa.st](https://claudefa.st/blog/guide/mechanics/auto-dream)
- [Auto Memory and Auto Dream: how Claude Code learns and consolidates its memory](https://antoniocortes.com/en/2026/03/30/auto-memory-and-auto-dream-how-claude-code-learns-and-consolidates-its-memory/)
- [claude-code-router · GitHub Topics](https://github.com/topics/claude-code-router)
- [GitHub - bmersereau/claude-router](https://github.com/bmersereau/claude-router)
- [GitHub - hermes-labs-ai/claude-router](https://github.com/hermes-labs-ai/claude-router)
- [GitHub - soumabali/token-router](https://github.com/soumabali/token-router)
- [GitHub - tzachbon/claude-model-router-hook](https://github.com/tzachbon/claude-model-router-hook)
- [GitHub - bijumailbox/claude-auto-router](https://github.com/bijumailbox/claude-auto-router)
