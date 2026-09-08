# REPERTOIRE.md — Pesquisas avulsas (standalone)

Este arquivo acumula pesquisas de tópico avulso conforme pedidas — cada uma independente,
sem ligação com um `GOALS.md` específico, seguindo a convenção do próprio `/repertoire` de
nunca sobrescrever, sempre mesclar. Duas pesquisas registradas até agora, de duas sessões
diferentes:

1. [Skills/ferramentas passivas de otimização (estilo graphify)](#pesquisa-1--skillsferramentas-passivas-de-otimização-estilo-graphify)
2. [Worktree, paralelismo de agentes e coisas parecidas](#pesquisa-2--worktree-paralelismo-de-agentes-e-coisas-parecidas)

---

<a id="pesquisa-1--skillsferramentas-passivas-de-otimização-estilo-graphify"></a>
# Pesquisa 1 — Skills/ferramentas passivas de otimização (estilo graphify)

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

## Síntese pra pergunta original

Sim — existe uma categoria real de "skills passivas tipo graphify", e ela se divide em 3
mecanismos concretos de ativação sem comando repetido: **nativo** (Auto Memory/Dream, já
ligado), **hook automático depois de 1 setup** (RTK), **MCP sempre conectado** (Serena).
Nenhum desses é "instale e pronto, resolve tudo" — cada um cobre uma fatia (compressão de
saída de shell, navegação semântica, memória entre sessões), não o pacote completo que a
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

---

<a id="pesquisa-2--worktree-paralelismo-de-agentes-e-coisas-parecidas"></a>
# Pesquisa 2 — Worktree, paralelismo de agentes e coisas parecidas

## Contexto e escopo

Pesquisa de tópico avulso (não é sobre o domínio real-world do base_project — é uma prática
de engenharia de agentes de IA que pode ou não virar feature futura no instalador). Pedido
original: "pesquisa sobre a implementação no base_project de worktree, paralelismo de
agentes e coisas parecidas."

Lentes pesquisadas: evidência técnica, discurso público/crítica, panorama competitivo.
Puladas (não se aplicam): regulatório/legal, cultural/social — nenhuma prática aqui envolve
dado sensível, jurisdição ou dinâmica social relevante.

Esta pesquisa **não implementa nada** — é insumo pra uma decisão futura via `/newgoal` ou
pedido explícito separado, não um plano de ação.

---

## 1. Evidência técnica

### Git worktree como mecanismo de isolamento

`git worktree` é comando nativo do Git desde 2015: permite múltiplos checkouts do mesmo
repositório em pastas físicas separadas, cada um em sua própria branch, compartilhando o
mesmo `.git` (histórico, objetos, refs) — commits feitos em um worktree ficam visíveis nos
outros imediatamente, sem duplicar o repositório inteiro. É o mecanismo padrão para permitir
que múltiplas sessões/agentes editem o mesmo repo "ao mesmo tempo" sem corrupção mútua
(dois processos escrevendo no mesmo diretório de trabalho corrompem uns aos outros —
mudanças sobrescritas, contexto confuso, build quebrado).

### Suporte nativo no Claude Code

Segundo múltiplos guias (não-oficiais, ver nota de credibilidade abaixo), o Claude Code
ganhou um comando/skill de worktree nativo — a versão exata citada (v2.1.49, fev/2026) vem
de blogs terceiros, não de changelog oficial da Anthropic consultado diretamente, então
trato esse número com confiança moderada, não como fato verificado. O padrão descrito é
consistente entre as fontes: um "Claude Code worktree" é um git worktree gerenciado pelo
harness — diretório de trabalho separado, apontando pro mesmo repositório, branch própria,
arquivos próprios em disco. Cada sessão roda isolada; ao terminar, o usuário revisa o diff
naquele worktree, faz merge da branch, remove o worktree.

**Fato de primeira mão, verificado diretamente nesta própria sessão** (não depende de busca
na web): a ferramenta `Agent` deste harness já expõe um parâmetro `isolation: "worktree"` —
"creates a temporary git worktree so the agent works on an isolated copy of the repo... the
worktree is automatically cleaned up if the agent makes no changes; otherwise the path and
branch are returned in the result." Ou seja, isolamento via worktree por-subagente já é uma
capacidade nativa e imediatamente disponível da ferramenta `Agent` que o base_project já usa
(é como `architect`/`coder`/`reviewer` são invocados) — não é algo que precisaria ser
construído do zero, apenas um parâmetro a mais a decidir usar ou não em invocações
específicas.

### Agent Teams — mecanismo diferente, não usa worktree

Pesquisa confirmou o que o próprio `GOALS.md` (H.6) já registrava: **Agent Teams continua
experimental em setembro/2026** — segue atrás da flag `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS`,
sem sinal de graduação pra estável nas fontes consultadas (changelogs de set/2026 mostram só
bugfixes, nenhum anúncio de graduação). Achado relevante que refina a decisão anterior do
projeto: Agent Teams **não usa git worktree** como mecanismo de isolamento — em vez disso,
usa arquivos de tarefa em `~/.claude/tasks/[team-name]/`, mensagens diretas entre agentes
(`SendMessage`) e file locking pra evitar dupla-reivindicação de tarefa. São dois mecanismos
de paralelismo genuinamente diferentes: worktree isola pelo sistema de arquivos (cada agente
em sua própria cópia), Agent Teams isola por coordenação lógica (mesma árvore, tarefas
distintas coordenadas via mensagens). Limitação documentada relevante: todos os membros do
time herdam as permissões do "lead" e rodam o mesmo modelo (Opus 5, exigido desde mar/2026).

### Orientação oficial da Anthropic sobre quando usar multi-agente

Fonte primária (`claude.com/blog`, post oficial "When to use multi-agent systems (and when
not to)"): a Anthropic recomenda multi-agente só em três cenários — **proteção de contexto**
(subtarefa gera volume alto de informação irrelevante pro resto), **paralelização**
(facetas de pesquisa genuinamente independentes) e **especialização** (toolset/prompt
focado quando domínios são distintos ou ferramentas passam de 15-20). Custo real declarado:
"implementações multi-agente tipicamente usam 3-10x mais tokens" que abordagem single-agent,
por contexto duplicado, mensagens de coordenação e sumarização de resultado. Princípio de
design central citado: **"divida por fronteira de contexto, não por tipo de problema"** —
splits problema-cêntricos (planejar→implementar→testar) geram handoffs constantes; splits
contexto-cêntricos (agrupar por contexto necessário) evitam o efeito "telefone sem fio".
Conselho-síntese da própria Anthropic: "comece pela abordagem mais simples que funciona, e
adicione complexidade só quando a evidência sustentar."

### Sources consulted
- [When to use multi-agent systems (and when not to) — Claude by Anthropic](https://claude.com/blog/building-multi-agent-systems-when-and-how-to-use-them) (fonte primária oficial)
- [Extend Claude with skills — Claude Code Docs](https://code.claude.com/docs/en/skills) (fonte primária oficial; não menciona worktree diretamente — skills e commands, não paralelismo)
- [From Tasks to Swarms: Agent Teams in Claude Code — alexop.dev](https://alexop.dev/posts/from-tasks-to-swarms-agent-teams-in-claude-code/) (escrita técnica independente, detalhada, cita mecanismo real)
- [Git Worktrees for AI Agents: 8 Parallel Claude Code Sessions — pasqualepillitteri.it](https://pasqualepillitteri.it/en/news/7951/git-worktrees-ai-agents-claude-code-parallel)
- [Claude Code Git Worktrees: Run 5 AI Agents in Parallel (2026 Guide) — DevToolLab](https://devtoollab.com/blog/claude-code-git-worktrees-parallel-agents-guide)
- [Claude Code Agent Teams: Setup, Examples, and Workflows in 2026 — promptessor.com](https://promptessor.com/blog/claude-code-agent-teams-examples-and-multi-agent-workflows-for-parallel-development-in-2026)
- Parâmetro `isolation: "worktree"` da própria ferramenta `Agent` deste harness (observação direta, não busca)

---

## 2. Discurso público e crítica

### O entusiasmo é real, mas a maioria das fontes é marketing de produto, não análise independente

A busca por "worktree + Claude Code paralelo" retorna majoritariamente conteúdo de blogs
SEO/produto (MindStudio, Nimbalyst, DevToolLab, Developers Digest, Augment Code) — guias
"como rodar N agentes em paralelo", quase todos com viés de venda (a maioria linka pro
próprio produto de orquestração no fim do artigo). Números específicos como "8 sessões
simultâneas" ou "times rodando 4-8 worktrees por desenvolvedor" vêm desse tipo de fonte —
tratados aqui como *relato de prática*, não como dado verificado independentemente.

### A crítica mais rigorosa vem de fora do círculo de marketing

- Um estudo da UIUC (citado por segunda mão numa fonte de blog técnico, não localizado o
  paper original diretamente) é reportado como achando que **sistemas multi-agente
  consomem de 4x a 220x mais tokens** que o equivalente single-agent — faixa muito larga,
  sinal de que o ganho depende muitíssimo da tarefa, não é uma constante.
- **Overhead de coordenação pode superar o processamento real**: um pipeline de 4 agentes
  reportado acumulando ~950ms de overhead de coordenação contra ~500ms de processamento
  de fato — mais tempo coordenando que computando, no caso citado.
- **Reversão real documentada**: o time de SRE do Azure (Microsoft) é citado como tendo
  investido em especialização multi-agente e revertido depois de achar que os handoffs
  prejudicavam confiabilidade — evidência de que a aposta às vezes não compensa nem para
  times grandes com recursos de sobra.
- **Conflitos lógicos de merge, não só textuais**: dois papers em arXiv (preprints, não
  peer-reviewed) — "AI Agent Pull Requests on GitHub" e "AgenticFlict" — relatam taxas de
  conflito de merge por agente: Copilot ~15%, Cursor ~20%, OpenAI Codex ~32% (dados
  observacionais de PRs reais no GitHub, não experimento controlado). O padrão de conflito
  citado como mais perigoso não é textual (Git resolve isso), é **lógico**: um agente muda
  assinatura de função, outro adiciona chamada pra assinatura antiga — cada mudança passa
  revisão individual, juntas quebram o build.
- **65% de líderes empresariais** citam complexidade de sistema agêntico como principal
  barreira pra escalar — estatística de survey citada por fonte de blog de produto
  (Augment Code), tratada aqui com confiança baixa (não localizada a metodologia do survey).

### Síntese honesta

O discurso público tem dois blocos desconectados: um volume grande de "como fazer"
otimista vindo de quem vende ferramenta de orquestração, e um volume bem menor de "quando
não vale a pena" vindo de análise técnica mais cuidadosa (papers, post-mortems reais). Os
dois concordam num ponto: paralelismo multiplica *superfície de conflito*, não throughput
de forma automática — o ganho real depende de decompor por fronteira de contexto genuína
(a mesma lição do post oficial da Anthropic), não de simplesmente rodar mais sessões.

**Nota de reforço ao vivo**: esta própria fusão de `REPERTOIRE.md` (duas pesquisas
diferentes escritas em paralelo por duas sessões, colidindo no mesmo arquivo/nome) e do
GOALS 12 (dois planos diferentes reivindicando o mesmo número, ver `dev/ROADMAP.md`) é, na
prática, o exato padrão de "conflito lógico de merge por paralelismo sem fronteira de
contexto combinada" que esta seção documenta — não um exemplo hipotético.

### Sources consulted
- [When Multi-Agent Is Overkill: A Decision Framework — Augment Code](https://www.augmentcode.com/guides/when-multi-agent-ai-is-overkill)
- [AI Coding Cost Analysis: Where Token Spend Really Goes — Augment Code](https://www.augmentcode.com/guides/ai-coding-cost-analysis-agent-token-spend)
- [AI Agent Pull Requests on GitHub: Frequency, Structure, and Merge Conflict Rates (arXiv preprint)](https://arxiv.org/pdf/2607.04697)
- [AgenticFlict: A Large-Scale Dataset of Merge Conflicts in AI Coding Agent PRs (arXiv preprint)](https://arxiv.org/pdf/2604.03551)
- [How to Debug Parallel AI Agents Without Going Insane — Augment Code](https://www.augmentcode.com/guides/debug-parallel-ai-agents)
- [5 Ways to Stop AI Agents Stepping on Each Other — Autonoma](https://getautonoma.com/blog/parallel-ai-agent-prs)
- [Token Price Is the Wrong Number — Insight](https://blog.insight-services-apac.dev/2026/07/06/cost-to-a-merged-feature)

---

## 3. Panorama competitivo

### Ferramentas dedicadas de orquestração via worktree

Existe um ecossistema real (não hipotético) de ferramentas cuja função inteira é envolver
`git worktree` numa UI de orquestração multi-agente:

- **Conductor** (macOS) — roda múltiplos agentes Claude Code/Codex em paralelo, cada um em
  worktree isolado.
- **Crystal / Nimbalyst** — workspace visual construído em torno de worktrees.
- **Vibe Kanban** — CLI + web UI cross-platform, board estilo Kanban, planeja tarefas, roda
  agentes em paralelo, revisão visual de código. Nota de risco de continuidade: a empresa por
  trás (Bloop) anunciou encerramento em 10/abr/2026; o projeto segue como open source mantido
  pela comunidade — sinal de fragilidade de manutenção de longo prazo nesse tipo de
  ferramenta de terceiro.
- **Superset** — open-source, cross-platform, agnóstico de agente (não amarrado só a Claude
  Code), orquestra múltiplas instâncias em worktrees isolados.

Todas compartilham o mesmo padrão estrutural: cada agente recebe seu próprio diretório em
sua própria branch, todos compartilhando o mesmo banco de objetos `.git` — é literalmente o
mesmo mecanismo primitivo (`git worktree`) com UI diferente por cima.

### Abordagem alternativa: isolamento por contêiner, não worktree

**Devin** e **OpenHands** isolam cada agente em seu próprio contêiner/VM, não em worktree —
uma escolha de arquitetura diferente (isolamento mais forte, custo de infraestrutura maior,
não depende do mesmo host de filesystem). Relevante como contraste: worktree é a opção
"leve, mesmo host"; contêiner é a opção "pesada, isolamento mais forte". **Cursor 3**
(abr/2026) soma as duas ideias — `/worktree` para branch isolada localmente, e agentes em
nuvem em VMs isoladas para o caso que exige mais força.

### Relevância direta pro base_project

Nenhuma das fontes discute o caso específico do base_project (instalador de configuração,
mantenedor único, sem produto rodando em produção) — todo o discurso de mercado assume
times/produtos com várias pessoas rodando várias sessões simultâneas em paralelo em código
de aplicação real. Isso é uma lacuna real da pesquisa, não uma omissão: o caso de uso mais
próximo do que já existe hoje no projeto é o parâmetro `isolation: "worktree"` da própria
ferramenta `Agent` (seção 1) — que já está disponível sem precisar adotar nenhuma ferramenta
terceira do panorama competitivo listado acima.

### Sources consulted
- [Parallel coding-agent orchestrators — Conductor and the 2026 ecosystem — rustman](https://rustman.org/wiki/conductor-parallel-agents/)
- [9 Open-Source Agent Orchestrators for AI Coding (2026) — Augment Code](https://www.augmentcode.com/tools/open-source-agent-orchestrators)
- [Vibe Kanban — Orchestrate AI Coding Agents](https://vibekanban.com/)
- [Superset — Orchestrate any coding agent](https://superset.sh/)
- [Best Git Worktree Tools for AI Coding in 2026 (Compared) — Nimbalyst](https://nimbalyst.com/blog/best-git-worktree-tools-ai-coding-2026/)
- [AI Coding Agents in 2026: Coherence Through Orchestration, Not Autonomy — Mike Mason](https://mikemason.ca/writing/ai-coding-agents-jan-2026/)
- [Claude Code vs Codex CLI vs Aider vs OpenCode vs Pi vs Cursor — thoughts.jock.pl](https://thoughts.jock.pl/p/ai-coding-harness-agents-2026)

---

## Nota de credibilidade das fontes

A maior parte do volume de busca sobre "worktree + agentes de IA" vem de blogs de produto
otimizados pra SEO (muitos citando o mesmo punhado de números sem atribuição primária clara
— "8 sessões", "v2.1.49", "4-8 worktrees por dev"). Tratados aqui como *relato de prática de
mercado*, não como fato verificado com a mesma confiança que a documentação oficial da
Anthropic (`claude.com/blog`, `code.claude.com/docs`) ou os preprints em arXiv (que, mesmo
não peer-reviewed, são dados observacionais reais de PRs no GitHub, com metodologia
declarada). Nenhuma fonte paga/fechada (Web of Science, Scopus) foi ou pôde ser consultada —
fora do alcance desta pesquisa.

## Lentes fora do escopo

- **Regulatório/legal**: não se aplica — prática de engenharia interna, sem dado
  regulado envolvido.
- **Cultural/social**: não se aplica — não há dinâmica social ou de audiência relevante
  numa prática de tooling de desenvolvimento.
