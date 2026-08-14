# base_project — roadmap vivo

Este arquivo não é um plano fechado. É um lugar para acumular ideias de melhoria conforme
formos vendo o que outros projetos (ECC, Superpowers, e o que mais aparecer) fazem bem —
comparar, decidir o que faz sentido *para este projeto especificamente* (não copiar por
copiar), e registrar decisões em aberto até serem resolvidas.

Formato de cada item: **o que é** → **por que pode importar** → **status**.
Status possíveis: `ideia` (ainda não decidido) · `decidido: fazer` · `decidido: não fazer` ·
`fazendo` · `feito`.

---

## Como conversar melhor comigo (Claude) neste projeto

Antes das ideias técnicas — isto também é uma "melhoria de sistema", só que do lado da
colaboração, não do código.

- **Prefiro perguntas curtas e frequentes a relatórios densos de uma vez.** Quando eu
  despejar uma análise grande sem checar alinhamento antes, é um sinal de que preciso
  parar e perguntar, não assumir que mais detalhe é sempre melhor.
- Se uma resposta minha não fizer sentido, é sempre válido dizer "não entendi" — isso é
  mais rápido pra nós dois do que eu adivinhar e você decifrar depois.
- Este arquivo existe justamente para eu não precisar recomeçar do zero a cada sessão —
  se uma decisão já foi tomada aqui, não vou reabrir sem motivo novo.

---

## Referências externas (o que estamos usando como inspiração)

| Projeto                                                     | O que é, em uma frase                                                                                                                                                                                                                                                                                           | Por que olhamos ele                                                                                                                                                                                                                                                 |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [ECC](https://github.com/affaan-m/ECC)                       | Suíte completa de disciplina de engenharia (68 agentes, 287 skills, hooks, aprendizado entre sessões, segurança dedicada). 239k estrelas, comunidade ativa.                                                                                                                                                   | Mesma "família" conceitual do base_project (harness de automação pra Claude Code), mas em escala de plataforma madura — bom espelho para ver o que falta aqui.                                                                                                  |
| [Superpowers](https://github.com/obra/superpowers)           | Framework de skills que se auto-ativa: brainstorming → plano → implementação com TDD → revisão por agente "fresco" → fechamento. ~124k estrelas.                                                                                                                                                          | É o "passa o comando e ele te guia" que você lembrava de ter visto — mais focado em*disciplina de processo* que em cobertura de integrações. Vale estudar o padrão de skills auto-ativadas (sem precisar digitar `/nome-do-comando`).                     |
| [caveman](https://github.com/JuliusBrussee/caveman)          | Skill que comprime prompt/resposta mantendo fatos técnicos intactos: ~65% menos token na resposta, ~46% menos no contexto. 6 níveis de intensidade (lite → ultra). 97k+ estrelas.                                                                                                                             | Confirma o mecanismo que você lembrava — existe de verdade, não foi imaginação.                                                                                                                                                                                |
| [skill-router](https://github.com/hussi9/skill-router)       | Skill que roda sozinha no início de toda sessão, decide (triagem de 3 perguntas) se a tarefa é trivial ou não, e se não for, escaneia as pastas de skills instaladas e casa nome/descrição delas com o prompt — sem precisar você chamar nada manualmente.                                              | É o "roteador" que você estava desenhando de cabeça. Responde a pergunta técnica de como ele acharia as skills certas:**não é via graphify** (isso mapeia código, não catálogo de skills) — é escaneando `~/.claude/skills/` e comparando texto. |
| [loop-verifier](https://github.com/tech1ee/claude-loop-plan) | Agente separado, roda depois da implementação, sem ver a narrativa de quem implementou — só confere se o que foi entregue bate com o que foi pedido originalmente (existe, é substancial, está conectado, e de fato funciona quando executado). Retorna só`passed` / `gaps_found` / `human_needed`. | É a "auditoria de fechamento" que você perguntou: "o prompt que te mandei confere com o que foi feito?". Nome técnico: verificação adversarial/independente.                                                                                                   |
| _(espaço para o próximo que você trouxer)_             |                                                                                                                                                                                                                                                                                                                  |                                                                                                                                                                                                                                                                     |

---

## Arquitetura em discussão: pipeline de orquestração de prompt

Isto é maior que um item de "ideia levantada" — é uma pergunta de arquitetura que você
trouxe sobre como o base_project deveria processar cada prompt seu, do início ao fim.
Documentado aqui em detalhe porque tem várias peças interligadas; nenhuma parte está
decidida ainda.

**A pergunta original**: quando você manda um prompt, ele deveria passar por um fluxo
que (1) comprime o prompt sem perder intenção, (2) decide se a tarefa é pequena ou
grande, (3) se for grande, ativa só as skills da área certa (ex: prompt de design →
só skills de design, não todo o catálogo), e (4) no final, confere se a entrega bateu
com o pedido original.

**Os 4 estágios, e o mecanismo real que cada um usaria** (todos confirmados existindo
de verdade, nenhum inventado):

1. **Simplificar o prompt** → mecanismo real: [caveman](https://github.com/JuliusBrussee/caveman).
   Comprime mantendo fatos técnicos intactos.
2. **Classificar tamanho da tarefa** (trivial vs. grande) → não achamos ainda um
   projeto específico só pra isso citado nesta conversa, mas é uma peça padrão em
   frameworks de roteamento (ex: roteadores de modelo que mandam tarefa trivial pro
   modelo mais barato, tarefa complexa pro mais caro). Precisa de pesquisa própria
   se formos atrás de um mecanismo pronto, em vez de decidir esse critério nós mesmos.
3. **Rotear pras skills certas, só se a tarefa for grande** → mecanismo real:
   [skill-router](https://github.com/hussi9/skill-router). Confirma a sua pergunta
   técnica: ele **não usa graphify** — graphify mapeia estrutura de código de um
   projeto, não catálogo de skills disponíveis. O skill-router escaneia
   `~/.claude/skills/` (e pastas equivalentes) e casa nome/descrição da skill contra
   o texto do prompt.
4. **Auditar se a entrega bateu com o pedido** → mecanismo real:
   [loop-verifier](https://github.com/tech1ee/claude-loop-plan). Agente separado,
   sem ver a narrativa do implementador, que confere contra os requisitos originais.

**O risco que você apontou é real**: se o casamento skill↔prompt for só por
palavra-chave simples, um prompt de design mal interpretado pode ativar skill errada
("se eu pedisse design e ele me entregasse algo relacionado a outra área"). Isso é
uma preocupação legítima de qualquer sistema de roteamento por texto — não tem solução
mágica, só mitigação (descrições de skill bem escritas e específicas, e a etapa de
verificação do item 4 pegando o erro depois, se o roteamento errar antes).

**Sobre "sempre precisamos usar esses agentes?"**: não — essa é exatamente a função do
estágio 2 (classificar tamanho). Um pipeline bem desenhado teria um degrau de saída
rápida: se o prompt for trivial ("como se fala laranja em inglês"), a resposta sai
direto, sem passar pelos estágios 1/3/4. Só tarefas que justificam o custo do aparato
completo (tipo "construa um projeto do zero") passam por tudo.

### Decisão: reimplementar como instrução, não instalar nenhuma das 4 skills

Pesquisa dedicada (4 agentes em paralelo, cada um lendo os repositórios reais via GitHub
MCP — código-fonte, contagem de estrelas/forks real, histórico de commit, licença — não
estimativa) avaliou cada mecanismo dos 4 estágios contra o critério "vale instalar como
dependência, ou o efeito cabe num parágrafo de instrução dentro do próprio
base_project?". Veredito unânime nos 4 casos: **reimplementar, não instalar.**

| Estágio | Mecanismo pesquisado | O que a pesquisa achou | Veredito |
|---|---|---|---|
| 1. Comprimir prompt | caveman | Todo o efeito está num arquivo `.md` de ~5KB (é engenharia de prompt pura, sem algoritmo de compressão real). O repositório de verdade é um monorepo de 8MB+ (Go, proxy que chama APIs externas, extensão de navegador, servidor MCP, banco de stats) — instalar isso traria muito mais superfície que o efeito buscado. A v2 (o "rewriter" que faz a compressão de fato) é licenciada sob Business Source License (não é open-source completo) e quebra uso offline. 97.546★ em ~4 meses é uma curva de crescimento anômala para um projeto essencialmente mantido por uma pessoa só — tratar com ceticismo, não como sinal de qualidade validada. | Não instalar. Copiar só o texto da regra (evitar palavras de preenchimento, preservar negações/números/código ao pé da letra, níveis de intensidade). |
| 2. Classificar tamanho da tarefa | (nenhum projeto específico encontrado) | Não existe um padrão real e maduro pra isso no mundo de agent harness. Os dois maiores frameworks do nicho — Superpowers (270.801★) e ECC (239.504★) — **não têm** essa etapa como componente separado: deixam implícito no julgamento do próprio modelo. O Claude Code também não tem isso nativo (há uma issue aberta e sem resposta pedindo exatamente isso). | Não construir nada. Isso já é uma capacidade implícita do raciocínio do modelo — no máximo, vale uma frase de instrução pedindo pra eu mesmo avaliar o tamanho antes de acionar aparato pesado. |
| 3. Rotear pra skill certa | skill-router | A parte "IA decide" do skill-router é redundante com o que o Claude Code já faz nativamente (contexto + matching semântico via o próprio modelo, não regex). A parte que faz algo tecnicamente novo é um hook em regex puro (`router.py`) — com exatamente o mesmo risco de má-classificação que você apontou como preocupação, não resolvido, só maquiado de determinístico. Adoção real muito baixa (17★, 0 forks, histórico de commit reescrito — sinal de um crash/recuperação). | Não instalar — é estritamente pior que o roteamento semântico nativo do Claude Code (que já é como o `/plugins` e as outras skills do base_project funcionam hoje). |
| 4. Auditar entrega vs. pedido | loop-verifier | Não é software distinto — é um template de prompt (~150 linhas) dentro de um framework bem maior (`loop-skills`, ex-`claude-loop-plan`). O isolamento "sem ver a narrativa do implementador" vem inteiramente do mecanismo nativo de subagente do Claude Code (contexto novo, sem memória da conversa de implementação) — o mesmo mecanismo que o `Agent`/`reviewer` do base_project já usa. Projeto solo, 0★, ~2 meses de idade. | Não instalar, mas a régua de 4 níveis (existe / é substancial / está conectado / tem prova comportamental) é um padrão bom o bastante pra copiar como texto — candidato natural a entrar no prompt do subagente `reviewer` (`source/claude/agents/reviewer.md`). |

**Por que isso bate com a identidade do base_project**: os 4 vereditos convergem pro
mesmo padrão (valor real cabe em um parágrafo, o resto é peso morto ou redundante com o
que o Claude Code já faz sozinho) — exatamente a mesma lógica que já guiou remover
CodeBurn/Brave Search e preferir catálogo à la carte sobre bundle monolítico. Nenhuma
dependência nova, nenhuma superfície de instalação nova.

**Status geral**: `feito`. Implementação real, nos 4 arquivos distribuídos (par Claude
Code/opencode, como todo o resto do projeto):
- **Estágio 4** (auditar entrega vs. pedido) → seção "Verifying the delivery matches the
  original ask" em `source/claude/agents/reviewer.md` e `source/opencode/agent/reviewer.md`:
  os 4 gates do loop-verifier (exists/substantive/wired/behavioral-proof) portados como
  checklist, com a regra de "evidência coletada agora > resumo da conversa" explícita.
- **Estágios 1 e 2** (compressão + julgamento de tamanho) → seção "Task Sizing & Response
  Discipline" em `source/CLAUDE.md` e `source/opencode-instructions.md`: uma regra de
  degrau de saída rápida pra tarefa trivial (sem invocar subagentes/planos), e a regra de
  terseness por padrão preservando código/números/negações ao pé da letra — mesmo
  conteúdo do texto do caveman, sem o repositório.
- **Estágio 3** (rotear pra skill certa) → nada a implementar. A pesquisa confirmou que o
  matching semântico nativo do Claude Code (contexto + descrições de skill) já faz isso
  melhor que o skill-router pesquisado — reimplementar aqui seria regressão, não ganho.

Sincronizado via `install.ps1` real e confirmado nos arquivos instalados
(`~/.claude/CLAUDE.md`, `~/.claude/agents/reviewer.md`).

---

## Escopo do projeto (o que vamos trabalhar agora)

Pesquisa sistemática, não por impressão — 3 agentes em paralelo leram de verdade (via
GitHub MCP, não estimativa) cada área do repositório do ECC: (1) catálogo de skills,
comandos e plugins; (2) hooks, MCP, CI e automação; (3) docs, testes, segurança, memória
e suporte multi-harness. Dessa pesquisa, 5 lacunas se destacaram por serem baratas de
fechar e terem retorno real mesmo num projeto pessoal — **são elas que compõem o escopo
ativo do projeto agora**. Os detalhes completos de cada uma (com implementação sugerida)
estão nos itens 1, 2, 7, 8 e 10 da seção "Ideias levantadas" abaixo.

| # | Lacuna                                                   | O que o ECC faz, concretamente                                                                                                                                                                                                                                                                                                                                                                                           | Item detalhado                                                            |
| - | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| A | Testes automatizados mínimos                            | ~130 arquivos de teste, mas**só 2 testam conteúdo de skill** — o resto é tudo plumbing de instalador/hook/script. Nem o ECC testa a "qualidade" das 287 skills.                                                                                                                                                                                                                                                | [Item 1](#1-testes-automatizados-para-o-dashboard)                         |
| B | Hooks com bloqueio de verdade, não só observação     | `cost-tracker.js` (Stop: soma tokens→USD por sessão), `ecc-context-monitor.js` (PostToolUse: avisa sobre contexto/custo/**loop de repetição** — mesmo tool+params 5x seguidas), `post-edit-format.js` (PostToolUse: roda Biome/Prettier `--write` automaticamente), `pre-compact.js` (resume a sessão antes de compactar o contexto). Todos leves, sem pressupor equipe/empresa.                   | [Item 2](#2-hooks-com-bloqueio-de-verdade-não-só-observação)           |
| C | Perfis de instalação com dependência entre plugins    | `install-profiles.json`: 7 presets nomeados (`minimal`, `core`, `developer`, `security`, `full`...). `install-components.json`: apelidos amigáveis. `install-modules.json`: grafo de dependência + metadados de custo/estabilidade.                                                                                                                                                                    | [Item 7](#7-perfis-de-instalação-com-dependência-entre-plugins)         |
| D | Schema validando o formato do catálogo                  | 10 arquivos de JSON Schema (`provenance`, `install-modules`, etc.) validam a forma de cada manifest antes de aceitar.                                                                                                                                                                                                                                                                                                | [Item 8](#8-schema-validando-o-formato-do-pluginsjson)                     |
| E | Scanner de segurança leve (não o AgentShield completo) | Importante: o "AgentShield" com 1282 testes/102 regras**não mora no repo do ECC** — é outro repositório (`agentshield`), citado uma vez, não verificado por nós. O que o ECC *de fato* documenta em `the-security-guide.md` são receitas simples: lista de permissão negada, e um `rg` (ripgrep) procurando por Unicode de largura zero / padrões `curl\|bash` em skills antes de confiar nelas. | [Item 10](#10-scan-leve-de-segurança-antes-de-instalar-skill-de-terceiro) |

**Ordem de implementação decidida**: 8 → 7 → 1 → 2 → 10. Schema (8) e perfis/dependência
(7) mexem no mesmo `plugins.json`, então vêm juntos primeiro; testes (1) vêm em seguida
já cobrindo o que mudou nos dois primeiros; hooks (2) depois; scan de segurança (10) por
último.

**Progresso**: 8 ✅ feito · 7 ✅ feito · 1 ✅ feito · 2 ✅ feito · 10 ✅ feito — escopo ativo
concluído. Ver "Pós-conclusão" abaixo para a lista de revisão futura, e a nota sobre
`settings.json` no item 2 (hooks só entram em vigor rodando o instalador de novo).

**Critério de "pronto" por item** (execução real, não sensação — mesmo princípio do
loop-verifier discutido na seção de arquitetura acima):

- **Item 8**: existe um schema e um `plugins.json` malformado de propósito, ao validar
  contra o schema, é rejeitado com erro claro.
- **Item 7**: `plugins.json` tem `dependsOn` funcional e pelo menos 2 presets nomeados
  (`minimal`/`full`) resolvendo pra um subconjunto correto de plugins.
- **Item 1**: existe `tests/` com um comando único que roda tudo e sai com código 0 se
  passar, não-zero se falhar — cobrindo a lógica do dashboard/`log-usage.js` alterada
  pelos itens 7 e 8.
- **Item 2**: os hooks descritos (loop-detection, auto-format, etc.) de fato disparam em
  um cenário de teste manual reproduzível.
- **Item 10**: rodar o scanner contra uma skill de teste com um padrão suspeito
  propositalmente embutido, e ele detectar.

---

## Descartado: `decidido: não fazer` (áreas do ECC investigadas e rejeitadas)

Estas áreas do ECC foram investigadas a fundo e **decididas contra** — motivo real
listado, não "sem tempo". Não reabrir sem fato novo (ex: base_project ganhar
contribuidores externos, ou passar a orientar múltiplas linguagens).

- **287 skills de conteúdo** — redundante com o que o modelo já sabe; só a parte
  *meta* (ex: skill-scout) teria valor, não o volume.
- **94 comandos por linguagem/workflow de equipe** — fora do escopo de instalador de
  propósito único.
- **30 MCP servers catalogados** — maioria comercial/de equipe; nosso catálogo enxuto
  (4 sempre ativos) já segue o próprio conselho do ECC de "menos de 10 ativos".
- **`integrations/` (protocolo AURA)** — nicho de terceiro, sem relação com o escopo.
- **CI de 11 workflows, matriz completa, SLSA3** — proporcional a 239k estrelas, não a
  um instalador pessoal sem contribuidores externos.
- **`orch-review.workflow.js`** (revisor multi-agente + cético adversarial) — bom
  padrão, mas pensado pra múltiplos contribuidores; revisão manual resolve pra um
  mantenedor só (era também o item 11 de "Ideias levantadas" — mesma decisão).
- **~55 scripts de manutenção** (dashboards de operador, vídeo de release, Discord) —
  ferramentas de escala de comunidade.
- **`rules/` por linguagem/framework** (10 sempre-instalados + 21 pastas) — vai contra
  a premissa de zero arquivo escrito no repositório do usuário.
- **`docs/` multi-idioma (~40 arquivos, 12 idiomas)** — só se justifica com
  contribuidores/tradutores externos.
- **`continuous-learning-v2`** (modelo Haiku em background extraindo "instintos") —
  engenharia real, mas prioridade de time/power-user, não de mantenedor único.
- **Adaptadores multi-harness** (`.cursor/`, `.codex/`, `.gemini/`) — nenhum é cópia
  mecânica (confirmado lendo os 3), mas não vale construir preventivamente — hoje só
  Claude Code + opencode existem de verdade aqui.
- **Modelo de plugin monolítico do ECC** (tudo em 1 plugin só) — não é uma lacuna, é
  uma diferença de arquitetura deliberada: o `plugins.json` à la carte do base_project
  já é mais alinhado com "instale só o que você quer". Não copiar.

---

## Ideias levantadas

### 1. Testes automatizados para o dashboard

**O que é**: hoje toda validação é manual (`node --check`, chamadas reais à API testadas
à mão). Confirmado por pesquisa (ver Gap analysis, item A): mesmo o ECC, com ~130
arquivos de teste, só testa 2 coisas de conteúdo de skill — o resto é tudo plumbing de
instalador/hook/script, não "qualidade" do que a skill faz. Isso importa porque define
o escopo certo aqui: testar a lógica do dashboard/`log-usage.js`, não tentar testar
"qualidade" de plugin — nem o ECC faz isso.
**Por que pode importar**: nesta sessão, um bug real (`installed` não refletindo `claude plugin list`) só foi achado porque testei manualmente — um teste automatizado teria
pego isso muito antes, e teria evitado o acidente do `git checkout --` que apagou
trabalho não commitado (um teste rodando localmente teria dado segurança pra reverter
com mais confiança).
**Status**: `ideia` · **escopo: ativo** (item A do escopo do projeto).

### 2. Hooks com bloqueio de verdade, não só observação

**O que é**: hoje o base_project só tem hooks observacionais (`PostToolUse`/`Stop`/
`UserPromptExpansion`, todos só logam pro dashboard, nenhum bloqueia nada). Confirmado
por pesquisa (Gap analysis, item B) que o ECC tem hooks pequenos e concretos com
comportamento real:

- `cost-tracker.js` (Stop): soma tokens→USD por sessão.
- `ecc-context-monitor.js` (PostToolUse): avisa sobre contexto/custo alto, **e detecta
  loop de repetição** (mesma ferramenta+parâmetros 5x seguidas).
- `post-edit-format.js` (PostToolUse): roda Biome/Prettier `--write` automaticamente
  depois de editar.
- `pre-compact.js`: resume a sessão antes dela ser compactada, pra não perder contexto.
  Nenhum desses pressupõe equipe/empresa — são leves e generalizáveis.
  **Por que pode importar**: um hook de detecção de loop, por exemplo, teria sinalizado o
  padrão repetitivo que levou ao acidente do `git checkout --` nesta sessão. Auto-format
  ao editar também é ganho direto e barato.
  **Implementação real**: escopo reduzido a 2 dos 4 hooks do ECC (decisão explícita —
  `cost-tracker` exigiria uma tabela de preços por modelo/token de manutenção instável;
  `pre-compact` precisaria confirmar se esse hook event existe de verdade no Claude Code
  atual, não confirmado nesta rodada). `source/hooks/loop-detect.js` (PostToolUse,
  síncrono): mesma tool+input 5x seguidas emite aviso em stderr, sem nunca bloquear —
  estado por `session_id` em `os.tmpdir()`, não em `~/.base_project/`.
  `source/hooks/post-edit-format.js` (PostToolUse, síncrono): após `Edit`/`Write`/
  `MultiEdit` num arquivo `.js`/`.jsx`/`.ts`/`.tsx`/`.json`/`.css`, roda
  `biome format --write` **só nesse arquivo** (nunca o projeto inteiro — a decisão de
  escopo restrito foi deliberada, pra não repetir o incidente de reformatação ampla desta
  mesma sessão). Testado de verdade: o detector avisa exatamente na 5ª chamada idêntica e
  fica em silêncio antes disso; o auto-format formata de verdade um arquivo desformatado
  quando rodado dentro do escopo do `biome.json` do projeto (e corretamente não faz nada
  fora dele, por não haver config de Biome pra seguir). `install.ps1`/`install.sh`
  atualizados para sincronizar `source/hooks/*.js` para `~/.claude/base_project/hooks/` e
  registrar os dois no `PostToolUse` do `settings.json` (idempotente, mesmo padrão de
  merge do `log-usage.js`) — **isso só entra em vigor rodando o instalador de novo**, não
  foi aplicado automaticamente no `settings.json` real desta máquina durante a
  implementação (mudar hooks ativos é uma ação que afeta como toda sessão futura se
  comporta, não algo pra fazer silenciosamente).
  **Status**: `feito` · escopo: ativo (item B do escopo do projeto).

### 3. Memória entre sessões

**O que é**: ECC extrai padrões de sessões passadas em "instincts" reutilizáveis. Temos
Memory (o sistema de memória do Claude, já ativo) mas nada *específico do projeto* — o
dashboard não aprende nada sobre como você usa o base_project ao longo do tempo, só
contabiliza eventos.
**Por que pode importar**: pode ser redundante com a memória geral do Claude — vale
decidir se faz sentido algo project-specific ou se a memória geral já resolve.
**Decisão**: não construir. O Memory nativo do Claude já cobre esse caso (memórias tipo
`project` sobre o próprio base_project) — uma 2ª camada de aprendizado dentro do
dashboard duplicaria isso, mesma lógica que já rejeitou o `continuous-learning-v2` do
ECC (ver "Descartado" acima).
**Status**: `decidido: não fazer`.

### 4. Skills auto-ativadas em vez de comandos digitados

**O que é**: no Superpowers, skills disparam sozinhas quando o contexto bate, sem
precisar digitar `/nome`. O base_project hoje é 100% opt-in via comando explícito
(`/plugins`, `/dashboard`, etc.) ou skill chamada por nome.
**Por que pode importar**: mais fricção pra você lembrar de invocar manualmente vs.
mais "mágica"/imprevisibilidade se ativar sozinho. Trade-off real, não óbvio qual lado
é melhor pra um projeto pessoal pequeno.
**Decisão**: adicionar auto-ativação, mas com escopo restrito a **sugestão, nunca
instalação**. Implementado em `source/CLAUDE.md` e `source/opencode-instructions.md`
("Plugin auto-suggestion"): ao começar trabalho substancial num projeto (mesmo gatilho
do check de `graphify-out/` já existente), eu confiro o catálogo de plugins uma vez
contra o projeto e, se um `recommend_if` bater claramente e não estiver instalado,
menciono uma vez, sem interromper a tarefa principal — nunca rodo `/plugins` ou instalo
nada por conta própria. Generaliza um padrão que já existia parcialmente (o check de
`/bootstrap` e a menção a `/plugins` em `audit.md`), sem violar a regra de zero efeito
colateral surpresa.
**Status**: `feito`.

### 5. Dashboard web (atual) vs. app Electron

**O que é**: hoje o dashboard é um servidor Node local + página no navegador
(`http://127.0.0.1:4317`). Uma alternativa seria empacotar como app desktop via
Electron (ícone na bandeja, notificações nativas, não depende de abrir navegador).
**Prós do dashboard web atual**: zero dependência nova, já funciona em qualquer SO sem
build separado, mais fácil de auditar (é um `.js`, não um bundle).
**Contras do Electron**: runtime pesado (~100-200MB de Chromium) pra um dashboard
simples de leitura, mais superfície pra manter (build multiplataforma, updates
próprios), vai contra a filosofia de "instalador leve, zero dependência pesada".
**Decisão**: manter o dashboard web atual. Fechado, não reabrir sem motivo novo (ex:
uma necessidade real de notificação nativa de SO que o navegador não resolve).
**Status**: `decidido: não fazer` (a migração pra Electron).

### 6. CI mais completo

**O que é**: agora que o CI finalmente roda (`biome check`, `tsc`), falta rodar testes
de verdade (item 1) e talvez validar os instaladores (`install.ps1`/`install.sh`) em
CI, não só localmente.
**Por que pode importar**: os bugs do instalador nesta sessão (remoção de MCP quebrando
com stderr, `desktop.ini` bloqueando reinstalação) só foram achados testando à mão —
um CI que roda o instalador numa VM limpa pegaria isso antes de virar problema real.
**Implementação real**: novo job `install-test` em `.github/workflows/ci.yml`, matriz
`ubuntu-latest`/`windows-latest`, rodando `install.sh`/`install.ps1` de verdade contra
um `$HOME` descartável (via os overrides `CLAUDE_HOME`/`OPENCODE_HOME` que os scripts já
suportavam desde antes, feitos originalmente pra teste). Confere que os artefatos-chave
existem (`CLAUDE.md`, `settings.json` válido como JSON, `plugins.json`, `dashboard/`,
`dashboard/lib/snapshot.js`, `hooks/`, `scripts/scan-skill.js`, `agents/reviewer.md`,
`opencode.jsonc`), e roda o instalador uma 2ª vez pra confirmar idempotência (não
falhar/duplicar ao re-rodar). Validado localmente rodando `install.sh` contra um HOME de
teste antes de confiar no job de CI.
**Status**: `feito` · escopo: ativo (item A/1 já estava pronto, isso era a extensão
natural pendente).

### 7. Perfis de instalação com dependência entre plugins

**O que é**: confirmado por pesquisa (Gap analysis, item C) — o ECC tem
`install-profiles.json` (7 presets nomeados: minimal, core, developer, security, full,
opencode, research), `install-components.json` (apelidos amigáveis pra cada módulo), e
`install-modules.json` (grafo de dependência entre eles + metadados de custo/
estabilidade). Nosso `plugins.json` hoje é uma lista plana de 13 entradas sem nenhuma
dessas três coisas.
**Por que pode importar**: mesmo numa escala pequena, um campo `dependsOn` simples (ex:
"strix precisa de Docker") e 2-3 presets prontos (`minimal`/`full`) já cobririam boa
parte do valor, sem precisar da indireção de 3 camadas do ECC (que só se justifica com
30+ módulos).
**Implementação real**: `source/plugins.json` ganhou `profiles`: `minimal` (headroom,
ponytail — universal, sem input/credencial), `design` (skill-ui, emil-design-eng,
impeccable, taste-skill — os 4 itens de design do catálogo), `full` (as 13 entradas).
`dependsOn` ficou **de fora** de propósito — revisão real das 13 entradas não achou
nenhuma dependência técnica genuína entre elas (são MCPs/CLIs/skills independentes); o
schema já suporta o campo (`schemas/plugins.schema.json`) para quando surgir um caso
real, mas popular sem necessidade seria dado falso. `/plugins <profile>` (Claude Code e
opencode) agora reconhece um nome de preset em `$ARGUMENTS` e pula direto pra instalação
sem passar pelo fluxo de recomendação interativo.
**Status**: `feito` · escopo: ativo (item C do escopo do projeto).

### 8. Schema validando o formato do `plugins.json`

**O que é**: confirmado por pesquisa (Gap analysis, item D) — o ECC tem 10 arquivos de
JSON Schema validando a forma de cada manifest antes de aceitar. Nosso `plugins.json`
não tem nenhuma validação de formato — só descobrimos erros de estrutura testando na
mão (é literalmente o que motivou a ledger de "erros conhecidos" do
`scripts/NPInstructions.md`).
**Por que pode importar**: um schema pequeno (json-schema ou até uma função de validação
simples em JS) pegaria erros de digitação/estrutura antes de virar bug em produção —
barato de fazer, alto retorno relativo ao esforço.
**Implementação real**: `schemas/plugins.schema.json` (JSON Schema draft-07) +
`scripts/validate-plugins.js` (usa `ajv`+`ajv-formats`, expõe `validate(path)` reutilizável
e um CLI). Isso trouxe uma dependência real ao projeto — decisão explícita: criamos
`package.json`+`package-lock.json` na raiz e voltamos o CI para `npm ci` (antes rodava
`npm install --no-save` por não ter nenhuma dependência real, só ferramentas de lint/
typecheck). O CI ganhou um step `Validate plugins.json` (`npm run validate:plugins`).
Testado de verdade: catálogo real valida limpo, e um catálogo malformado de propósito
(profile referenciando um id inexistente) é rejeitado com mensagem de erro clara — bate
o critério de "pronto" definido acima. Efeito colateral bom: ao migrar pro `npm ci`,
descobrimos que o CI vinha rodando um pacote `biome@0.3.3` fantasma (não o Biome real) há
commits inteiros, por causa de `npx biome` resolvendo pro pacote errado do registro sem
`node_modules/.bin/biome` local — corrigido, com 3 erros de formatação reais expostos e
corrigidos em `server.js`/`log-usage.js`/`launch.js` (só formatação, sem mudança de
lógica). Detalhes desse achado em `CLAUDE.md`.
**Status**: `feito` · escopo: ativo (item D do escopo do projeto).

### 9. Roteamento por linguagem/stack, não só por domínio

**O que é**: os `agents/` do ECC são, na maioria, específicos de linguagem —
`java-reviewer`, `go-reviewer`, `rust-reviewer`, `swift-reviewer`,
`kotlin-build-resolver`, `django-reviewer`, `react-reviewer`, e por aí vai (contei mais
de 30 só de revisores/resolvers de linguagem, sem contar os genéricos). `rules/` segue
o mesmo padrão: pastas por linguagem/framework (rust, go, react, vue, angular, swift...)
com convenções específicas carregadas só quando aquele tipo de arquivo está em jogo.
**Por que pode importar**: isso é uma camada a mais que faltava no pipeline de
orquestração que discutimos — o skill-router decide *domínio* (design vs. código), mas
o ECC também decide *qual linguagem/stack dentro do código* antes de escolher o agente
certo. Pra este projeto (JS/Node puro por enquanto), não é urgente, mas se o
base_project algum dia orientar trabalho em múltiplas linguagens, é o padrão a copiar.
**Status**: `ideia` · **escopo: fora por enquanto** (é a mesma área da tabela
"Pós-conclusão" — só entra em jogo se o base_project passar a orientar múltiplas
linguagens).

### 10. Scan leve de segurança antes de instalar skill de terceiro

**O que é**: já investigado a fundo (Gap analysis, item E) — o "AgentShield" do ECC
(1282 testes, 102 regras, citado no README) **não mora no repositório do ECC**, é outro
projeto separado (`agentshield`), e não foi verificado por nós. O que o ECC de fato
documenta em `the-security-guide.md` é bem mais simples: uma lista de permissões
negadas, e uma busca com `rg` (ripgrep) por Unicode de largura zero ou padrões tipo
`curl | bash` escondidos em skills antes de confiar nelas.
**Por que pode importar**: o base_project já instala skills/plugins de terceiros
(impeccable, emil-design-eng, taste-skill) sem nenhuma checagem própria — hoje a
confiança é 100% na revisão humana no momento da instalação. Uma versão realista aqui
não é "construir um scanner completo", é um `rg` de poucas linhas — barato o bastante
pra valer a pena mesmo sem o catálogo crescer muito.
**Implementação real**: `scripts/scan-skill.js`, em Node puro (decisão deliberada: não
depender de `rg`/ripgrep estar instalado no sistema do usuário — o resto do base_project
não exige nenhuma CLI externa além de Node/git, e isso mantém essa garantia). 6 regras
de alto sinal: Unicode de largura zero, `curl`/`wget | sh`, PowerShell
`-EncodedCommand` com blob base64, `eval(atob(...))`/`eval(Buffer.from(...))`, e
`child_process.exec` com interpolação de string. Varre texto (pula binários via
detecção de byte NUL, e `.git`/`node_modules`/`.venv`/`__pycache__`), reporta
arquivo+linha, nunca lança exceção nem apaga nada — é puramente consultivo. Sincronizado
pelo installer para `~/.claude/base_project/scripts/scan-skill.js` (novo, igual
`hooks/`), e **integrado ao fluxo real do `/plugins`**: para entradas `kind: skill` que
baixam arquivos localmente (`npx skills add` etc.), roda o scanner na pasta resultante
logo após instalar e mostra achados antes de dizer que está pronto pra uso — fecha o
loop que o item descreve (proteção no momento exato que importa, não só documentação).
Testado de verdade: detecta cada um dos 6 padrões em casos isolados, não gera falso
positivo em diretório limpo, ignora corretamente `node_modules`/`.git`/arquivos
binários, e reporta o número de linha certo — bate o critério de "pronto" (scanner
detecta padrão suspeito propositalmente embutido).
**Status**: `feito` · escopo: ativo (item E do escopo do projeto).

### 11. Workflow de revisão orquestrada (`orch-review`)

**O que é**: já lido por completo (Gap analysis, tabela "não vale fechar agora"). O
`workflows/orch-review.workflow.js` do ECC (15KB) orquestra: um revisor de código
sempre roda, mais um revisor específico da linguagem detectada, mais um revisor de
segurança se o diff tocar em palavras-chave sensíveis (auth/secrets/sql/exec/crypto) —
tudo em paralelo. Depois, cada achado crítico é mandado pra um agente "cético"
independente, que precisa refutá-lo com 80%+ de confiança antes dele ser descartado
(senão, fica bloqueando por padrão).
**Por que pode importar**: é um padrão bem desenhado (falha travando por padrão,
autocrítica adversarial), mas construído pra pipeline de múltiplos contribuidores —
pra um mantenedor único, uma passada manual de revisão cobre a mesma necessidade por
muito menos custo de manutenção.
**Status**: `ideia`, investigação concluída — decisão de "vale implementar aqui" ainda
em aberto, mas minha inclinação é que não vale, dado o tamanho do projeto ·
**escopo: fora** (está na tabela "Pós-conclusão").

### 12. Hook `SessionStart` injetando contexto git (evitar cold start)

**O que é**: você trouxe uma lista de 10 ferramentas de memória/contexto pra avaliar
(claude-mem, mcp-memory-keeper, mcp-memory-service, memory-bank-mcp, Neo4j Claude
Memory, Mem0, Letta/MemGPT, Greptile MCP, "Context Mode", hook `SessionStart` DIY).
Pesquisa dedicada (1 agente, GitHub real + docs oficiais) achou: nenhuma estava
instalada nesta máquina; a maioria é redundante com o que o projeto já tem
(`memory-bank-mcp` ≈ `CLAUDE.md`/`ROADMAP.md` como doc viva, `Mem0`/`Letta`/`Neo4j`
exigem serviço pago ou servidor externo pesado, `Greptile` é API paga, `Context Mode`
não mapeia pra um repositório único confiável) ou têm nome ambíguo (múltiplos
repositórios não relacionados disputando o mesmo nome).
**Decisão**: implementar só o hook `SessionStart` DIY (opção #10 da lista) — zero
dependência nova, usa só `git` (já é requisito do projeto), documentado oficialmente
pelo próprio Claude Code.
**Implementação real**: `source/hooks/session-start-git-context.js`. Contrato do hook
verificado contra a documentação oficial antes de implementar (não assumido): stdout
puro em exit 0 é adicionado direto ao contexto da sessão, sem precisar de wrapper JSON;
dispara em `startup`/`resume`/`clear`/`compact`/`fork` via `matcher`; nunca bloqueia o
início da sessão. Registrado com `matcher: "startup|resume|clear"` — deliberadamente
exclui `compact`/`fork` (não são "cold start" de verdade, reinjetar o mesmo resumo no
meio da sessão seria ruído). Roda `git status`/`diff --stat`/`log -3`/`rev-list
--left-right --count` contra o `cwd` da sessão; se a árvore estiver limpa e sem
divergência do upstream, **não produz nenhuma saída** (economiza token no caso comum,
que é a maioria das aberturas de sessão). Testado de verdade: contra este próprio repo
com mudanças não commitadas (produziu o resumo certo: branch, commits à frente,
arquivos alterados, log recente) e contra um repo limpo recém-criado (saída vazia,
confirmando o caso silencioso). 6 testes cobrindo `formatGitContext` (a parte pura,
testável sem tocar git de verdade). Sincronizado e registrado no `settings.json` real
via `install.ps1`.
**Status**: `feito`.

### 14. `/newproject`, `/scanproject`, `/fixproject` + menu "o que você deseja fazer agora?"

**O que é**: três comandos novos que fecham o ciclo de vida de um projeto do ponto de
vista de quem usa o base_project — começar certo, avaliar o que já existe, corrigir o
que estiver errado — mais um menu estilo WhatsApp mostrado em dois momentos (início de
sessão e fim de tarefa substancial) listando tudo que dá pra fazer, em linguagem
simples. Ligado à direção "modo leigo" levantada na mesma conversa.

**Por que pode importar**: os 5 comandos existentes até aqui cobrem ações pontuais
(mapear, auditar, instalar plugin, decidir, ver painel), mas nenhum deles responde "por
onde eu começo" ou "o que está faltando no meu projeto" — que são exatamente as
perguntas que travam alguém sem saber usar a ferramenta corretamente. O menu ataca o
mesmo problema pelo lado da descoberta: sem ele, um usuário leigo só descobre que
`/plugins` existe se alguém contar.

**Arquitetura**: os três comandos compartilham uma única fonte de verdade —
`source/claude/references/project-standards.md` (+ par opencode) — um checklist de 9
categorias (identidade, controle de versão, segredos, dependências, testes,
qualidade de código, CI, segurança básica, estrutura) do que é "um projeto bem
formado". `/newproject` usa o checklist como forma do plano (é read-only, como
`architect` — nunca cria arquivo sozinho). `/scanproject` usa o mesmo checklist como
critério de avaliação, reporta achados com severidade e arquivo/linha (mesmo formato
que `reviewer` já usa), também read-only — nunca corrige nada, pra garantir que o
resultado é confiável antes de qualquer correção agir sobre ele. `/fixproject` roda
`/scanproject` primeiro (ou reaproveita achados recentes da mesma conversa), corrige
cada achado (`architect`→`coder` pra mudanças não-triviais, direto pra correções de
uma linha), e reverifica cada um de verdade depois (re-rodar o comando que originou o
achado, não assumir pela forma do diff) — mesma régua de 4 gates do `reviewer` aplicada
aqui a "a correção realmente resolveu, não só existe".

O menu (`source/claude/references/command-menu.md` + par opencode) é outra fonte única
— uma instrução em `CLAUDE.md`/`opencode-instructions.md` manda renderizar esse arquivo
verbatim (nunca redigitar a lista de memória, pra não divergir do conjunto real de
comandos). Gatilho restrito a dois momentos (início de sessão sem pedido específico já
dado, e fim de tarefa substancial) — deliberadamente não a cada turno, pra não virar
ruído em uso de power-user.

**Status**: `feito`. Instalado e sincronizado via `install.ps1` real nesta máquina
(`~/.claude/commands/{newproject,scanproject,fixproject}.md`,
`~/.claude/base_project/references/{project-standards,command-menu}.md`, e os
equivalentes opencode). `install.ps1`/`install.sh`/CI atualizados pra sincronizar a
pasta `references/` nova. Validado: `npm test` (39/39), `tsc` (limpo), `validate:plugins`
(catálogo válido). `biome check` aponta só warnings pré-existentes em arquivos `.js` não
tocados nesta mudança (todos os arquivos novos desta entrega são `.md`) — candidato
real pro `/scanproject` rodar contra o próprio repo base_project no futuro.

### 15. `/cleanproject` e alias `/wpp`

**O que é**: dois complementos pequenos ao trio 14. `/cleanproject` audita organização
de arquivo/pasta (arquivo morto, estrutura fora de convenção, duplicação) — categoria
distinta de `/scanproject` (que audita qualidade/segurança/CI), mas mesmo contrato
read-only e mesmo consumidor de correção (`/fixproject`, que agora aceita achados de
qualquer um dos dois). `/wpp` é um alias que renderiza o menu "o que você deseja fazer
agora?" sob demanda, além dos dois gatilhos automáticos já existentes.

**Contexto da decisão**: nasceu de uma ideia do usuário de criar uma pasta vazia
`PROJETO/` dentro do repositório do base_project pra isolar projetos pessoais dele — a
causa raiz real, depois de perguntar, era achar que a estrutura deste repositório
(`base_project` em si) estava bagunçada, não um risco genuíno de vazamento entre
projetos (que já não existe, dada a regra "zero pegada": nada do base_project é escrito
dentro de um projeto consumidor — ver "Decisões já tomadas"). A pasta `PROJETO/` foi
descartada como solução (não resolvia a causa raiz, e criava um risco novo de
confusão entre o histórico git do instalador e o de um projeto pessoal, caso fossem
commitados no mesmo repositório) — `/cleanproject` ataca a causa raiz de verdade.

**Implementação real**: `source/claude/commands/cleanproject.md` +
`source/opencode/command/cleanproject.md` (mapeia a árvore real via
graphify/repomix quando disponível, verifica achado por grep real — nunca por nome de
arquivo isolado — e propõe estrutura-alvo sem executar nada). `fixproject.md` (ambos
os engines) atualizado pra aceitar achados de `/cleanproject` também, com a regra
explícita de que mover um arquivo inclui atualizar toda referência/import no mesmo
passo. `wpp.md` (ambos os engines) — mesma renderização verbatim de
`references/command-menu.md` que os dois gatilhos automáticos já usam.
`command-menu.md` (ambos) ganhou a entrada de `/cleanproject`.

**Status**: `feito`. Instalado e sincronizado via `install.ps1` real
(`~/.claude/commands/{cleanproject,wpp}.md` + equivalentes opencode). `npm test`
(39/39), `tsc` limpo, `validate:plugins` ok — nenhum código novo (arquivos são todos
`.md`), então nada para o Biome cobrir além do que já existia. CI atualizado pra
conferir os 2 artefatos novos nos dois jobs.

### 13. Remover o dashboard

**O que é**: o dashboard local (`/dashboard`, `source/dashboard/*.js`, servidor em
`http://127.0.0.1:4317`) foi útil enquanto validávamos manualmente a lógica de detecção
de plugin instalado/usado, mas você avaliou que ele não é mais necessário no uso real do
projeto hoje.

**Execução real**: removido por completo. `source/dashboard/` inteiro apagado (server.js,
lib/snapshot.js, launch.js, opencode-usage-logger.js, log-usage.js — o coletor foi
removido junto com o dashboard, não mantido separado: sem consumidor, vira código morto,
decisão confirmada explicitamente antes de executar). Comando `/dashboard` removido dos
dois engines (`source/claude/commands/dashboard.md` + par opencode). `install.ps1`/
`install.sh`: removida toda a lógica de sincronização do dashboard (diretórios
`claudeDashboardDir`/`opencodeDashboardDir`/`opencodePluginsDir`, a seção inteira de sync
de arquivos) e o merge de hooks `PostToolUse` (entrada `log-usage.js`), `Stop` e
`UserPromptExpansion` (ambos ficaram vazios sem o dashboard, removidos do objeto de
settings inteiramente — `loop-detect`/`post-edit-format`/`SessionStart` preservados
intactos). `biome.json`/`tsconfig.json`: removido `source/dashboard/**/*.js` do escopo.
`ci.yml`: removidos os checks de artefato `dashboard/server.js`/`dashboard/lib/
snapshot.js` nos dois jobs de instalação. Testes: `tests/snapshot.test.js` e
`tests/log-usage.test.js` apagados por completo (39 → 25 testes). `command-menu.md`
(ambos os engines): entrada `/dashboard` removida.

Máquina real limpa também, não só o repositório-fonte: `~/.claude/base_project/dashboard/`
e `~/.config/opencode/base_project/dashboard/` removidos, `~/.config/opencode/plugins/`
removido (só existia pro `opencode-usage-logger.js`), comandos `/dashboard` instalados
apagados, `settings.json` real editado à mão pra remover a entrada `log-usage.js` de
`PostToolUse` e as seções `Stop`/`UserPromptExpansion` (validado como JSON ainda válido
depois), `~/.base_project/usage.jsonl` e `~/.base_project/state.db` apagados
(`repo-path.txt` mantido — ainda é usado pra localizar o repositório). Validado: `npm
test` (25/25), `tsc` limpo, `validate:plugins` ok, `install.ps1` re-rodado sem erro e sem
nenhuma menção a `dashboard` na saída.

**Status**: `feito`.

### 16. Versionamento (`package.json` + git tag) e `/status`

**O que é**: até aqui o base_project não tinha número de versão nenhum — nenhuma forma
de responder "que versão eu tenho instalada" sem ler o git log inteiro. Junto,
`/status`: um comando que mostra a versão e uma lista simples (só nomes, sem explicar
nada) de tudo que está ativo de verdade na máquina agora — agentes, comandos, hooks,
plugins instalados.

**Decisão de versionamento**: sem publicar pacote/app nenhum, `git tag` já é suficiente
pra marcar pontos no histórico (aparece automaticamente na página do repositório no
GitHub, sem nenhum fluxo de "release"). Campo `version` em `package.json` (que já
existe na raiz por causa do item 8) é a fonte formal e fácil de ler programaticamente;
a tag git ancora esse número a um commit específico. Primeira tag: `v1.0.0` — criada
localmente, sem push (decisão explícita: dar push é uma ação visível/compartilhada que
merece confirmação separada, não empacotada dentro de uma tarefa maior).

**Implementação real**: `package.json` ganhou `"version": "1.0.0"`.
`source/claude/commands/status.md` + `source/opencode/command/status.md`: lê a versão
via `git describe --tags` no repositório do base_project (localizado via
`~/.base_project/repo-path.txt`) + `package.json`, lista agentes/comandos ativos via
marcador `base_project:managed` nos arquivos `.md` instalados, hooks ativos lendo
`settings.json` real, e plugins do catálogo detectados como instalados (mesma lógica de
detecção que já existia — `claude plugin list --json` pro lado Claude Code,
`mcp.json`/`mcpServers` pro lado opencode). Deliberadamente **sem nenhuma explicação**
no output — só nomes, formato compacto, porque o objetivo é inventário rápido, não
documentação (isso já existe em ARCHITECTURE.md). `command-menu.md` (ambos os engines)
ganhou a entrada.

**Status**: `feito`. Instalado e sincronizado via `install.ps1` real
(`~/.claude/commands/status.md` + equivalente opencode). `npm test` (25/25), `tsc`
limpo, `validate:plugins` ok (mostrando `base_project@1.0.0` — confirma que o campo foi
lido). CI atualizado pra conferir o artefato novo.

### 17. Reorganizar a raiz do repositório: pasta `dev/` pra separar admin de produto

**O que é**: você perguntou se dava pra separar o que é "admin-only" (só quem desenvolve
o base_project precisa) do que é "produto" (o que qualquer usuário do base_project usa,
mesmo sem saber que existe) — como alternativa à ideia descartada de criar uma pasta
`PROJETO/` vazia (a causa raiz real era a raiz deste repositório parecer bagunçada, não
risco de vazamento entre projetos, que já não existe pela regra "zero pegada").

**Decisão**: criar `dev/` na raiz e mover pra dentro dela tudo que só interessa a quem
desenvolve o instalador: `scripts/` (o instalador de verdade + utilitários),
`schemas/`, `tests/`, `ROADMAP.md`. `source/` (o produto real) e `README.md`/
`ARCHITECTURE.md` (docs de usuário) continuam na raiz.

**Achado real durante a execução — Biome 2.x não permite `includes` escapando o
diretório do próprio config via `../`**: a primeira tentativa moveu `biome.json`/
`tsconfig.json` pra dentro de `dev/` também (já que eram "config de tooling", mesma
categoria admin). Rodar `npx biome check .` depois disso quebrou com "Found a nested
root configuration, but there's already a root configuration" — Biome 2.x trata o
diretório de onde é invocado como uma raiz implícita de projeto, e um `biome.json`
alojado numa subpasta (`dev/`) vira uma "segunda raiz aninhada" em conflito. Pior:
mesmo contornando esse erro, um `includes: ["../source/hooks/**/*.js"]` relativo ao
config em `dev/` é rejeitado ("path ignored") — Biome 2.x não deixa um config escapar
pra fora do próprio diretório via `../` de jeito nenhum, mesmo com `--config-path`
explícito. Como o lint precisa cobrir `source/hooks/**/*.js` (fora de `dev/`) *e*
`dev/scripts/*.js`/`dev/tests/**/*.js` (dentro), o único lugar que os dois configs
conseguem enxergar as duas árvores é a raiz — `biome.json`/`tsconfig.json` foram
revertidos pra lá. `tsconfig.json` tecnicamente não tem essa restrição de boundary (o
`tsc` aceita `../` sem reclamar), mas foi junto por consistência (os dois configs do
mesmo par de diretórios devem morar no mesmo lugar).

**Implementação real**: `git mv` preservando histórico pra
`dev/{scripts,schemas,tests}/` e `dev/ROADMAP.md`. Corrigido: `$repoRoot`/`REPO_ROOT`
em `install.ps1`/`install.sh` (agora sobem 2 níveis, não 1, já que os scripts moveram
uma pasta mais fundo); `scanSkillSrc` no `install.ps1` (referenciava `scripts\` direto
a partir do `repoRoot`, não do próprio `$PSScriptRoot` como o `.sh` já fazia
corretamente); ícone de pasta do Windows Explorer (aplicava a `source/scripts/assets`,
agora `source/dev/assets`); `validate-plugins.js` (ganhou `DEV_ROOT`/`REPO_ROOT`
separados, já que schema e catálogo agora vivem em árvores diferentes); os 5 arquivos
de teste que fazem `require("../source/hooks/...")` (ganharam um `../` a mais);
`package.json` (`scripts.*` apontando pra `dev/`); `ci.yml` (invocação de
`dev/scripts/install.sh`/`.ps1`, os asserts de artefato instalado ficaram inalterados
— esses são destinos em `~/.claude/base_project/`, não mudam com o reorg da fonte).

**Validado de verdade, não só editado**: `install.ps1` re-rodado a partir do novo
local (`dev\scripts\install.ps1`) sincronizou tudo sem erro; `npx biome check .` e
`npx tsc` rodados da raiz — **mesma contagem de arquivo processada de antes do reorg**
(`Checked 11 files`, idêntico ao baseline), confirmando que o escopo do lint não
encolheu nem cresceu por acidente; `npm test` 25/25; `npm run validate:plugins` ok;
`/scanproject` rodado contra o repositório reorganizado depois de tudo, sem achado
novo além dos já conhecidos (1 warning de Biome pré-existente, não relacionado).

**Status**: `feito`. Raiz do repositório reduzida de ~15 entradas rastreadas pra ~10
(`source/`, `dev/`, `README.md`, `ARCHITECTURE.md`, `CLAUDE.md`, `package.json`,
`package-lock.json`, `biome.json`, `tsconfig.json`, `.github/`).

### 18. `/update`, `/uninstall`, e sugestão de `fallbackModel` — pesquisa de "o que falta"

**O que é**: com a v1.0.0 próxima do fechamento, pedimos pesquisa real (web, não só
comparação com o ECC já minerado) sobre o que mais valeria acrescentar. Achados
relevantes, verificados contra documentação/artigos reais, não estimativa:

- **`/recap`** (nativo do Claude Code, lançado recentemente, ligado por padrão):
  sintetiza git status + mudanças de arquivo ao voltar de um período ocioso na sessão,
  sugerindo "o que fazer a seguir". Overlap conceitual real com o
  `session-start-git-context.js` (nosso hook) — mas o gatilho parece ser diferente
  (retorno de ociosidade dentro da sessão vs. `startup|resume|clear` do nosso hook).
  **Decisão**: manter o hook como está, sem alteração — não temos certeza suficiente
  do overlap real pra justificar mexer, e o uso contínuo vai revelar isso melhor que
  especulação. Reavaliar se ficar claro que é redundante de verdade.
- **`/doctor`** (nativo, ganhou um upgrade recente — virou checkup completo com
  autocorreção de settings/skills/MCP/hooks/memória). Confirma que não vale construir
  um health-check próprio pro base_project — mesma armadilha que já rejeitamos com o
  skill-router (redundante com algo nativo melhor).
  **Decisão**: não construir nada — `/status` (item 16) já cobre a parte
  catalog-aware que o `/doctor` nativo não sabe (o que do *base_project* está ativo).
- **`fallbackModel`** (nativo, `settings.json`): até 3 modelos de reserva tentados em
  cadeia quando o principal está sobrecarregado (erro 529). Zero dependência, encaixa
  na filosofia do projeto.
  **Decisão**: sugerir, nunca aplicar sozinho — mesma regra do "Plugin
  auto-suggestion" (item 4): mencionar uma vez, nunca editar `settings.json` sem
  pedido explícito, porque é uma mudança de comportamento real (qual modelo responde).
- **`/update`**: gap real, não coberto por nada nativo — o auto-update nativo do
  Claude Code só cobre plugin de marketplace, e base_project não é isso (é um clone
  git com installer manual). Padrão bem estabelecido (é o modelo `omz update` do
  oh-my-zsh). Também reaproveita `~/.base_project/repo-path.txt`, que ficou órfão
  desde a remoção do dashboard (item 13) — era usado só pelo `/api/update-check` que
  não existe mais.
  **Decisão**: construir.
- **`/uninstall`**: também não coberto por nada nativo. Baixo risco de implementar
  (é leitura + confirmação antes de apagar), alto valor pra "modo leigo" — poder sair
  de forma limpa sem caçar arquivo por arquivo em `~/.claude/`.
  **Decisão**: construir, com confirmação em 3 camadas por pedido explícito do
  usuário (ver implementação abaixo) — não um único "tem certeza?" genérico.

**Implementação real — `/update`**: `source/claude/commands/update.md` +
`source/opencode/command/update.md`. Lê `~/.base_project/repo-path.txt`, confere
`git status --porcelain` no repo do base_project primeiro — **para e não faz nada** se
houver mudança não commitada (nunca `stash`/`reset` por conta própria), `git fetch` +
compara `HEAD` com `@{u}`, mostra o log do que há de novo, pede confirmação, só então
`git pull` (nunca `--force`/`--rebase`) + reroda o installer certo pro SO, reporta
versão antes→depois. Nunca dá push nem mexe no remoto.

**Implementação real — `/uninstall`**: `source/claude/commands/uninstall.md` +
`source/opencode/command/uninstall.md`. Inventário real primeiro (nunca por suposição
de memória), depois 3 tiers de confirmação **separados**, cada um só executado se
confirmado:
- **Tier A** (reversível 100% reinstalando, sem efeito fora do namespace do
  base_project): arquivos `.md` marcados, `plugins.json`, hooks em
  `~/.claude/base_project/`, bloco delimitado no `CLAUDE.md`, `~/.base_project/`.
- **Tier B** (muda comportamento de toda sessão futura, não só do base_project): os 3
  registros de hook em `settings.json`, as chaves `instructions`/`mcp.file` do
  `opencode.jsonc`.
- **Tier C** (maior raio de impacto — afeta todo projeto Claude Code/opencode da
  máquina, não só quem usa base_project): os 4 registros de MCP server via `claude mcp
  remove --scope user`, e o `mcp.json` do opencode se for 100% nosso.
Nunca toca em arquivo sem o marcador `base_project:managed`/`_managed_by` (mesma regra
"não é nosso, pula" do installer) e **nunca apaga o repositório do base_project em
si** — só os efeitos colaterais instalados globalmente.

**Implementação real — sugestão de `fallbackModel`**: `install.ps1`/`install.sh`,
logo após o merge de hooks em `settings.json` — se a chave `fallbackModel` não existir,
imprime uma dica (`Write-Warn`/`warn`) com o snippet exato pra adicionar, nunca escreve
nada sozinho. Testado de verdade: apareceu corretamente na saída real do installer
nesta máquina.

**Status**: `feito`. `install.ps1` re-rodado, sincronizou `update.md`/`uninstall.md`
nos dois engines + o aviso de `fallbackModel` apareceu certo. `npm test` (25/25), `tsc`
limpo, `validate:plugins` ok, `npx biome check .` mesma contagem de arquivo de sempre
(`Checked 11 files`, nada novo — os 2 comandos são `.md`, não código).

### 19. Descoberta viva + período de teste (catálogo deixa de ser só estático)

**O que é**: mudança de arquitetura maior que qualquer item anterior — não é mais só
sincronizar um catálogo fixo (`plugins.json`), é o `/newproject`/`/plugins` ganharem uma
etapa de **busca ao vivo** (catálogo → marketplace oficial → web aberta, nessa ordem)
antes de recomendar, e um **período de teste com veredito automático** pra tudo que
entra vindo de fora do catálogo. Nasceu de uma conversa longa sobre se o base_project
"faz sentido" dado o tamanho que ganhou em <1 semana sem validação — a conclusão foi que
o pedaço genuinamente diferenciado (nenhum marketplace de Claude Code hoje mede se o que
foi instalado continua sendo usado) é justamente isto, não o instalador em si.

**Por que pode importar**: hoje `plugins.json` só cresce por edição manual (você lembra
de adicionar uma entrada quando acha algo bom) — é curadoria estática disfarçada de
automação, e o catálogo nunca sabe se uma entrada existente ainda serve pra alguma
coisa. A mudança resolve dois problemas ao mesmo tempo: (1) cobre ferramentas que nunca
foram catalogadas manualmente, e (2) aplica ao próprio catálogo a mesma disciplina de
"não confiar no achismo" que já vem sendo aplicada ao resto do projeto (ver decisão do
pipeline de orquestração, acima — reimplementar como instrução magra, não inflar com
dependência nova).

**Desenho acordado (4 fases, nenhuma implementada ainda)**:

1. **Descoberta — generosa, sem eu pré-filtrar.** Ao descrever um projeto novo (ou
   escanear um existente), busco em 3 camadas nessa ordem: `plugins.json` primeiro (já
   validado, mais barato, zero risco), depois marketplace oficial do Claude Code, só
   então web aberta (GitHub/npm) se nada cobrir. Trago **tudo** relevante que achar —
   decisão de corte é sempre do dono do projeto, nunca minha. Regra explícita porque é
   fácil eu errar nisso por padrão: não omitir um achado por eu achar "dispensável".
2. **Decisão — pergunta simples, modo leigo.** "Achei isto que pode ajudar: [lista].
   Baixar tudo, tirar algum, ou nenhum?" — nunca pergunta nada técnico. Cada item fora
   do catálogo passa por `scripts/scan-skill.js` (já existe, item 10) antes de instalar,
   obrigatório, não opcional como é hoje no fluxo do `/plugins`. Credencial pedida na
   hora se `requires_input` existir (mesmo campo que `supabase`/etc já usam).
3. **Período de teste — só para o que veio de fora do catálogo.** Aviso explícito na
   instalação ("existe, parece útil, mas ainda não sei se funciona bem — vou testar").
   Contador de N usos reais (não tempo corrido — decisão explícita, porque tempo
   corrido penaliza ferramenta usada raramente sem relação com qualidade). A cada uso,
   registro sinal técnico (completou sem erro/timeout, formato de resposta válido) +
   meu julgamento (o resultado fez sentido pro que foi pedido, ou só "rodou") +
   ocasionalmente uma pergunta sim/não ao usuário ("isso ajudou aqui?") — nunca pergunta
   nada que exija entender métrica.
4. **Veredito — promoção ou descarte, depois de N usos.** Sinal bom → vira entrada
   permanente em `plugins.json` (mesmo schema do item 8) + ganha uma seção no
   `CLAUDE.md` do projeto onde foi usado, documentando como invocar/convenções —
   fecha o "não basta baixar, precisa saber usar", pedido explícito nesta conversa,
   pra sessões futuras não redescobrirem do zero. Sinal ruim → aviso + pergunta
   sim/não ("testei N vezes, taxa de erro alta — manter ou remover?"), usuário decide.

**Pontos frágeis já identificados, não resolvidos** (registrar antes de esquecer):
- Busca web aberta sem nenhum piso de qualidade pode trazer lixo — precisa de um
  critério mínimo (estrelas/atividade/licença, como já fizemos manualmente pras 4
  referências pesquisadas na seção de pipeline de orquestração), não zero filtro.
- "N usos" não pode ser um número fixo universal — MCP chamado toda hora acumula sinal
  rápido, algo usado 1x/semana leva muito mais tempo corrido pra mesma evidência.
  Precisa de definição por tipo de ferramenta, não uma constante global.
- Instalar a partir de um achado de busca aberta é mais arriscado que o catálogo fixo
  de hoje: o comando de instalação é **inferido** por mim, não testado por alguém antes
  — maior chance de errar o comando ou (pior) instalar algo malicioso. É o único ponto
  onde nenhuma versão desse desenho reduz o risco a zero; scan obrigatório + confirmação
  explícita mitigam, não eliminam.
- `CLAUDE.md` do projeto-alvo pode inchar rápido se muitas ferramentas forem aceitas —
  candidato a virar arquivo de referência separado (mesmo padrão que
  `project-standards.md`/`command-menu.md` já usam aqui) se isso acontecer na prática.

**Status**: `fazendo` — só a Fase 1 (descoberta viva), decisão explícita de fatiar em vez
de implementar as 4 fases de uma vez, mesma razão registrada acima.

**Implementação real (Fase 1 apenas)**: `source/claude/commands/plugins.md` +
`source/opencode/command/plugins.md`. Passo 3 original (avaliar `recommend_if` contra o
catálogo) preservado como "catalog pass", intocado; novo passo 3b faz a busca viva
(marketplace oficial → web aberta, nessa ordem, só para necessidades que o catálogo não
cobriu) com regra explícita de não pré-filtrar por gosto próprio — lista generosa,
decisão de corte é do usuário. Passo 4 (apresentação) atualizado pra separar claramente
"do catálogo" de "descoberta viva, não validado, comando de instalação inferido". Novo
passo 5b (Claude Code) / 4c (opencode) cobre instalação do que vier da descoberta viva —
sempre confirmação explícita do comando exato antes de rodar (nunca reusa a permissão
genérica do passo 4), prefere escopo local quando existe. Passo de scan
(`scripts/scan-skill.js`) tornado **obrigatório**, não mais advisory-only, para qualquer
item vindo da descoberta viva independente do `kind` — cobre o risco já identificado no
desenho (comando de instalação inferido por mim, não pré-testado por ninguém, é o ponto
de maior risco). Nada de `plugins.json` foi escrito automaticamente — promoção de um
achado bom a entrada permanente do catálogo continua sendo trabalho futuro (Fase 4), não
parte desta mudança.

**Deliberadamente fora desta fatia**: período de teste com N usos, avaliação
técnica+julgamento, veredito de promoção/descarte automático, seção gravada no
`CLAUDE.md` do projeto-alvo. Essas são as Fases 2-4 do desenho original — cada uma
precisa da sua própria decisão de execução, não entram junto por padrão.

**Validado**: `dev/scripts/install.sh` sincroniza os dois arquivos sem erro (rodado
de verdade neste ambiente, não assumido). `npm run validate:plugins` ok (catálogo
intocado, ainda válido). `npm test` 25/25. `npx tsc` limpo. Nenhum arquivo de código
tocado (mudança é só nos dois `.md` de comando + este registro no ROADMAP), então o
escopo do Biome não muda.

---

## Decisões já tomadas (histórico, não reabrir sem motivo novo)

- **Zero pegada no repositório do projeto instalado** — nada é escrito dentro do projeto
  onde o base_project é usado, tudo vive em `~/.claude/`/`~/.config/opencode/`. Isso é
  central à identidade do projeto, não é negociável só porque ECC faz diferente.
- **Dashboard local, sem comunicação entre projetos** — cada instância do dashboard só
  mostra dados do projeto de onde foi aberto, mesmo que o log de uso seja compartilhado
  em disco.
- **CodeBurn e Brave Search removidos** — CodeBurn não reduzia custo (só observava);
  Brave Search exige pagamento. Ver `scripts/NPInstructions.md` para o histórico
  completo dessas remoções.

---

## Como adicionar um item novo aqui

Quando encontrar algo interessante em outro projeto: adicione uma entrada na seção
"Ideias levantadas" seguindo o formato (o que é / por que importa / status), e se for
uma referência nova, adicione também na tabela "Referências externas". Não implemente
direto — primeiro registra, depois decide junto comigo se vale a pena.
