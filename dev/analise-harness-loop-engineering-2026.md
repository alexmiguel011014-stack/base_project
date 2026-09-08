# Harness Engineering, Loop Engineering e outras tendências para o base_project

Nota sobre como isso foi pedido: veio via `/repertoire`, mas na época não era uma pesquisa
de domínio real-mundo de projeto (regulação, ciência, cultura *sobre um produto sendo
construído*) — tratei como pesquisa técnica solta, equivalente ao tipo "research" do
`/newgoal`. **Atualização (ROADMAP item 41)**: depois desta análise, o dono do projeto
apontou que esse era exatamente o escopo que `/repertoire` deveria cobrir desde o início —
o comando foi reestruturado pra incluir "pesquisa de tópico avulso" como modo próprio, sem
precisar de um comando novo. Uma pesquisa como esta hoje rodaria pelo `/repertoire` de
verdade.

## 1. Conceitos-chave

### 1.1 Harness Engineering

**Definição.** O termo (atribuído a Mitchell Hashimoto, fev/2026, formalizado por Ryan
Lopopolo na OpenAI com o tagline "Humans steer. Agents execute.") resume-se a: `Agent =
Model + Harness`. A ideia central é que confiar em "seguir o padrão porque está escrito no
prompt" é compliance probabilística — o harness troca isso por restrição determinística
(um linter recusa código malformado sempre, não "na maioria das vezes").

Um harness de produção tem 5 camadas (framework da Faros.ai):
1. **Tool orchestration** — como o agente escolhe/encadeia tools e recupera de erro.
2. **Verification loops** — testes/auto-crítica *durante* a execução, não só no fim.
3. **Context & memory** — indexação do código, histórico de sessão, sem re-explicar tudo
   toda vez.
4. **Guardrails** — limites codificados (sandbox, orçamento, gates human-in-the-loop).
5. **Observability** — telemetria, tracing, logs de auditoria.

**Por que importa aqui.** O time da LangChain subiu o próprio agente de coding do 30º pro
5º lugar no Terminal Bench 2.0 **sem trocar o modelo** — só otimizando o harness. Isso é o
argumento mais forte contra "vamos escrever um prompt melhor": harness bate prompt.

**Gap concreto no base_project hoje.** `npm test` (92 testes), Biome e `tsc` testam os
*scripts* (`install.sh`, `snapshot.js`, `validate-plugins.js`...) muito bem. **Não existe
nenhum teste automatizado que verifique se os 21 comandos/agentes (os arquivos `.md` em
`source/claude/commands/` e `source/opencode/command*/`) realmente produzem o
comportamento certo quando um modelo os executa.** Hoje essa verificação é 100% manual —
literalmente o que aconteceu nesta sessão ao rodar `/bootstrap`, `/scanproject`,
`/fixproject`, `/ship` de verdade pra confirmar que funcionavam. Isso é precisamente o que
um eval harness substitui.

### 1.2 Loop Engineering

**Definição.** Sucessor de 2026 do "prompt engineering": em vez de escrever cada prompt à
mão, desenha-se o loop que o agente roda entre chamadas de tool — quando ele confere o
próprio trabalho, como decide que terminou. Framework de 4 camadas aninhadas (LangChain):

1. **Agent loop** — modelo chamando tools em loop até completar a tarefa.
2. **Verification loop** — grader (determinístico ou LLM-as-judge) confere contra uma
   rubrica e devolve falha com feedback corretivo.
3. **Event-driven loop** — o agente é acionado por trigger externo (webhook, cron, canal
   de chat) em vez de invocação manual — operação contínua em background.
4. **Hill-climbing loop** — a camada de meta-melhoria: traces de produção alimentam um
   agente de análise que atualiza prompts/config automaticamente. "Cada volta da loop
   externa torna as loops internas mais eficazes."

**O verificador é o gargalo, não o modelo** — a mudança real em 2026 foi o esforço sair de
"escrever código" pra "provar que funciona".

**Onde o base_project já está, sem ter nomeado assim.** Loop 1+2 já existem de forma
informal: cada comando roda multi-step com gates de confirmação (`AskUserQuestion`,
confirmações em `/ship`/`/council`/`/uninstall`) — isso é human-in-the-loop de verdade, não
decorativo. Loop 3 não existe — nenhum comando roda disparado por evento externo. Loop 4
tem uma semente real: `/usagebp` lê o ledger de uso e reporta o que funciona/falha —
é literalmente "traces de produção alimentando análise", só que o passo de "atualizar a
config automaticamente" ainda é 100% manual (um humano lê o relatório e decide).

## 2. Quatro tendências adicionais relevantes

Escolhidas por conexão direta com o que o repo já tem — nada de forçar um checklist
genérico (o mesmo cuidado que `/newgoal` já toma pra não empurrar `build.md` num projeto
que não é build).

**Progressive Delivery.** Entregar mudança arriscada atrás de uma flag opt-in, começando
desligada por padrão, promovendo pra default só depois de validada. **Isso já foi feito
neste repo nesta mesma semana**: o perfil `command-lite` do opencode (flag
`--opencode-commands lite`, default continua `dense`, estado persistido). Hoje é um caso
isolado — a oportunidade é documentá-lo como *padrão repetível* pra próximas mudanças
arriscadas em comandos/agentes, não reinventar a cada vez.

**GitOps / Configuration as Code.** Fonte de verdade declarativa versionada em git, com
detecção de drift entre o declarado e o real. **O base_project já É isto** — `source/` é a
fonte declarativa, o installer é o `apply`, e `dev/scripts/drift.js` já existe pra detectar
divergência. O gap é só de automação: hoje drift-check é manual (dentro de `/scanproject`),
não roda proativamente (ex: no `/bootstrap`, que já sincroniza o canônico via `sync.js
pull` — daria pra encadear um `drift.js --project .` ali de graça).

**Eval Harness específico pra plugins/skills (não pra código).** Existe uma frente ativa
em 2026 disso especificamente pra Claude Code — frameworks como PluginEval (análise
estática determinística + julgamento semântico via LLM + simulação, nota calibrada com
intervalo de confiança, 10 dimensões de qualidade) e a capacidade nativa `claude plugin
eval` da própria CLI (suítes de eval, relatório JSON, sandbox, CI). Isso é a materialização
direta do gap identificado em 1.1: dá pra escrever cenários "golden path" por comando (ex:
"`/ship` com um secret no diff deve recusar stage, nunca commitar") e rodar isso como gate
de CI, do jeito que hoje só `npm test` roda pros scripts.

**Multi-Agent Orchestration (evolução do trio architect/coder/reviewer).** Claude Code
lançou "Agent Teams" em fev/2026 (junto do Opus 4.6): um agente "team lead" que spawna
teammates independentes, cada um com seu próprio contexto, comunicando via mailbox
peer-to-peer e uma task list compartilhada — ainda experimental (flag
`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS`). O paralelo natural aqui é `/execgoals`: hoje ele
executa `GOALS.md` item por item, numa thread só; um `GOALS.md` com áreas independentes
(backend/frontend/deploy) poderia em tese despachar teammates paralelos por área. Vale
prototipar, não vale apostar produção nisso enquanto for experimental.

## 3. Matriz de Impacto

| Prática | Ganho de desempenho | Esforço de implementação | Por quê |
|---|---|---|---|
| Eval harness pra comandos/agentes | **Alto** | Médio | Único item que fecha um gap real e específico (zero cobertura hoje); usa `claude plugin eval`, já nativo |
| Formalizar Loop 4 (hill-climbing a partir do `/usagebp`) | Médio-Alto | Baixo | A leitura de dados já existe; falta só o passo de ação sistemática sobre o achado |
| Generalizar Progressive Delivery como padrão documentado | Médio | **Baixo** | O mecanismo já existe (lite/dense) — é documentar o padrão, não construir algo novo |
| Automatizar drift-check (GitOps) | Médio | **Baixo** | `drift.js` já existe — é só encadear a chamada em `/bootstrap` |
| Prototipar Agent Teams em `/execgoals` | Baixo-Médio (hoje) | Alto | Feature experimental — risco de retrabalho se a API mudar antes de estabilizar |

## 4. Plano de ação (roadmap priorizado)

**Fase 1 — fechar o gap real (maior ROI, curto prazo)**
1. Escrever eval suite golden-path pra 3-5 comandos de maior risco primeiro (`/ship`,
   `/fixproject`, `/uninstall` — os que já têm lógica de segurança explícita nas próprias
   instruções) usando `claude plugin eval`. Rodar como novo job no CI, ao lado de
   `npm test`.
2. Formalizar o Loop 4: `/usagebp` já produz o achado ("catálogo X instalado, nunca
   usado") — decidir uma ação padrão de acompanhamento (ex: sinalizar automaticamente pro
   usuário depois de N dias sem uso, não só quando `/usagebp` é chamado manualmente).

**Fase 2 — consolidar o que já existe (baixo esforço, ganho direto)**
3. Documentar o padrão lite/dense como convenção reutilizável (um parágrafo em
   `CONTRIBUTING.md` ou `ARCHITECTURE.md`: "mudança arriscada em comando/agente = flag
   opt-in + default no comportamento atual + state file, mesmo padrão do
   `command-lite`").
4. Encadear `drift.js --project .` dentro do `/bootstrap` (que já roda `sync.js pull` no
   mesmo passo) — fecha o loop de GitOps sem trabalho novo de infraestrutura.

**Fase 3 — experimentar sem apostar (longo prazo, observar antes de adotar)**
5. Prototipar (não produtizar) `/execgoals` despachando teammates paralelos via Agent
   Teams, atrás de uma flag — mesma disciplina de Progressive Delivery da Fase 2, aplicada
   a essa feature especificamente por ela ainda ser experimental do lado da Anthropic.

---

## Decisão de implementação — harness sem dependência externa (2026-09-08)

Para remover a dependência de uma chave Anthropic faturável e ainda fechar o ciclo local de
verificação, o projeto adotou um harness determinístico em `dev/scripts/eval-harness.js`, com
cenários em `dev/harness/scenarios.json`. Ele valida os contratos textuais das 12 variantes
de `/ship`, `/fixproject` e `/uninstall` e classifica 16 traces seguros, bloqueados ou
inseguros. O CI executa `npm run test:harness` sem rede, modelo, CLI externo ou credencial.

Essa escolha aplica a recomendação central da pesquisa: fatos verificáveis devem ser testados
deterministicamente antes de qualquer avaliação probabilística. O limite permanece explícito:
o harness não prova que um LLM obedecerá às instruções em uma conversa real; uma avaliação
live-model pode ser adicionada depois, como decisão separada de custo, segurança e fidelidade.

## Fontes consultadas

- [Harness Engineering for AI Coding Agents: Constraints That Ship Reliable Code — Augment Code](https://www.augmentcode.com/guides/harness-engineering-ai-coding-agents)
- [Harness Engineering: Making AI Coding Agents Work in 2026 — Faros.ai](https://www.faros.ai/blog/harness-engineering)
- [Agentic Harness Engineering: Observability-Driven Automatic Evolution — arXiv](https://arxiv.org/pdf/2604.25850)
- [The Art of Loop Engineering — LangChain](https://www.langchain.com/blog/the-art-of-loop-engineering)
- [What is Loop Engineering: Four Levels of Agentic Loops — Medium](https://medium.com/@tahirbalarabe2/what-is-loop-engineering-four-levels-of-agentic-loops-ccc48b850002)
- [Loop Engineering Emerges as Developers Put AI Coding Agents on Repeat — ADTmag](https://adtmag.com/articles/2026/07/01/loop-engineering-emerges-as-developers-put-ai-coding-agents-on-repeat.aspx)
- [How to build a Claude plugin marketplace with evals — AI Builders](https://www.aibuilders.blog/p/how-to-build-a-claude-plugin-marketplace-evals)
- [PluginEval framework docs — kiri2sama/agents_claude_plugin](https://github.com/kiri2sama/agents_claude_plugin/blob/main/docs/plugin-eval.md)
- [Claude Code Agent Teams: How TeammateTool and Swarm Mode Are Redefining AI Coding — Sean Kim](https://blog.imseankim.com/claude-code-team-mode-multi-agent-orchestration-march-2026/)
- [Claude Code Multi-Agent Orchestration: 2026 Guide — Tembo.io](https://www.tembo.io/blog/claude-code-multi-agent-orchestration)
