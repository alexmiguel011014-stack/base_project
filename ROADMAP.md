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

## Pós-conclusão: revisar depois de fechar o escopo acima

Estas 11 áreas do ECC são reais e foram investigadas a fundo, mas **não entram no
escopo ativo agora** — ficam registradas aqui explicitamente para revisão *depois* que
o escopo acima estiver implementado e validado, não para reabrir sem motivo antes disso.

| Área do ECC                                                              | Escala real                                                                                                                                                                                                                           | Por que não cabe aqui agora                                                                                                                                                                     |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 287 skills de conteúdo                                                   | Organizadas em ~28 módulos por linguagem/domínio                                                                                                                                                                                    | Redundante com o que o modelo já sabe bem; a parte que teria valor são as*meta-skills* (ex: `skill-scout`, que procura antes de criar uma nova skill do zero), não o volume de conteúdo. |
| 94 comandos (`commands/`)                                               | Maioria é build/test/review por linguagem, ou workflow de PR/epic pensado pra equipe                                                                                                                                                 | Não se aplica ao escopo de instalador de propósito único do base_project.                                                                                                                     |
| 30 MCP servers catalogados                                                | A maioria comercial/de equipe (Jira, Confluence, Railway, fal.ai)                                                                                                                                                                     | O próprio ECC recomenda "manter menos de 10 ativos" — nosso catálogo mais enxuto (4 sempre ativos) já segue esse conselho.                                                                   |
| `integrations/` (protocolo AURA)                                        | Adaptador de confiança pra pagamento agente-a-agente, um projeto de terceiro nicho                                                                                                                                                   | Sem relação com o escopo do base_project.                                                                                                                                                      |
| 11 workflows de CI, matriz completa de teste, scan de supply-chain, SLSA3 | Proporcional à exposição de um projeto de 239k estrelas                                                                                                                                                                            | Nosso CI de 1 job (lint+typecheck) é do tamanho certo pra um instalador pessoal sem contribuidores externos.                                                                                    |
| `orch-review.workflow.js` (revisão multi-agente adversarial)           | Lido por completo: revisor de código + revisor de linguagem específica + revisor de segurança rodando em paralelo, e um agente "cético" que precisa refutar cada achado crítico com 80%+ de confiança antes dele ser descartado | Sofisticado, mas desenhado pra pipeline de múltiplos contribuidores; revisão manual resolve pra um mantenedor só.                                                                             |
| ~55 scripts de manutenção (`scripts/`)                                | Dashboards de operador, geração de vídeo de release, integração com Discord, coordenação via GitHub Issues                                                                                                                     | Ferramentas de escala de comunidade, sem equivalente de uso pessoal.                                                                                                                             |
| `rules/` por linguagem/framework                                        | 10 arquivos sempre-instalados + 21 pastas de linguagem                                                                                                                                                                                | Vai contra a premissa central do base_project (zero arquivo escrito no repositório do usuário), a menos que o escopo do projeto mude.                                                          |
| `docs/` (~40 arquivos + 12 idiomas)                                     | Guias de arquitetura, migração, i18n                                                                                                                                                                                                | Só se justifica com contribuidores e tradutores externos.                                                                                                                                       |
| `continuous-learning-v2`                                                | Hooks observam every tool call → um modelo Haiku em background (a cada 5min, só depois de 20+ observações) extrai "instintos" com pontuação de confiança, agrupados por hash de projeto                                        | Engenharia real e substancial, mas é prioridade de time/power-user, não de mantenedor único.                                                                                                  |
| Adaptadores multi-harness (`.cursor/`, `.codex/`, `.gemini/`)       | Confirmado, lendo os 3:**nenhum é cópia mecânica** — cada um exige código de adaptação escrito à mão (o do Gemini é só um shim de 1.8KB, os outros têm subconjuntos parciais e formatos de evento diferentes)       | Informativo (mostra que dá pra ser barato*se* algum dia quisermos um 3º harness), mas não vale fazer preventivamente — hoje só Claude Code + opencode.                                    |

### Achado que não é lacuna — valida uma escolha nossa

`plugins/` no ECC: tudo (287 skills, 94 comandos, 68 agentes) é empacotado como **um
único plugin monolítico** — instala tudo ou nada, e um sistema de perfis (item C acima)
decide o que fica ativo depois. O `plugins.json` do base_project é o oposto: um
catálogo à la carte de 13 plugins independentes, cada um instalável sozinho. Isso não é
uma lacuna a fechar — é uma decisão de arquitetura diferente e deliberada, e
provavelmente mais alinhada com o "instale só o que você realmente quer" que já é a
identidade do base_project. Não recomendo copiar o modelo monolítico do ECC aqui.

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
**Status**: `ideia`, precisa de mais conversa antes de virar `decidido` · **escopo: fora
por enquanto** (não fazia parte das 5 lacunas priorizadas na pesquisa ECC — decidir
separadamente se entra no escopo ativo).

### 4. Skills auto-ativadas em vez de comandos digitados

**O que é**: no Superpowers, skills disparam sozinhas quando o contexto bate, sem
precisar digitar `/nome`. O base_project hoje é 100% opt-in via comando explícito
(`/plugins`, `/dashboard`, etc.) ou skill chamada por nome.
**Por que pode importar**: mais fricção pra você lembrar de invocar manualmente vs.
mais "mágica"/imprevisibilidade se ativar sozinho. Trade-off real, não óbvio qual lado
é melhor pra um projeto pessoal pequeno.
**Status**: `ideia` · **escopo: fora por enquanto**.

### 5. Dashboard web (atual) vs. app Electron

**O que é**: hoje o dashboard é um servidor Node local + página no navegador
(`http://127.0.0.1:4317`). Uma alternativa seria empacotar como app desktop via
Electron (ícone na bandeja, notificações nativas, não depende de abrir navegador).
**Prós do dashboard web atual**:

- Zero dependência nova (`http` do Node já é suficiente — nenhum pacote pesado)
- Já funciona em qualquer SO sem build separado
- Mais fácil de auditar/editar (é um arquivo `.js`, não um bundle)
  **Prós do Electron**:
- Sensação de "app de verdade", ícone na bandeja do sistema
- Notificações nativas do SO (ex: avisar quando um plugin novo é detectado)
- Não depende de lembrar a URL/porta
  **Contras do Electron**:
- Runtime pesado (~100-200MB só de Chromium embutido) para o que hoje é um dashboard
  simples de leitura
- Mais superfície pra manter (build multiplataforma, updates do próprio Electron)
- Vai contra a filosofia atual de "instalador leve, zero dependência pesada"
  **Status**: `ideia`, sem decisão — listada aqui explicitamente porque foi uma pergunta
  sua ("será que é melhor ter um dashboard ou instalar um app pelo electron?"). Minha
  inclinação inicial é que o ganho do Electron não paga o custo de peso pra este projeto
  específico, mas isso merece conversa própria antes de fechar.
  **Status**: `ideia` · **escopo: fora por enquanto**.

### 6. CI mais completo

**O que é**: agora que o CI finalmente roda (`biome check`, `tsc`), falta rodar testes
de verdade (item 1) e talvez validar os instaladores (`install.ps1`/`install.sh`) em
CI, não só localmente.
**Por que pode importar**: os bugs do instalador nesta sessão (remoção de MCP quebrando
com stderr, `desktop.ini` bloqueando reinstalação) só foram achados testando à mão —
um CI que roda o instalador numa VM limpa pegaria isso antes de virar problema real.
**Status**: `ideia` · **escopo: fora por enquanto** (relacionado ao item A/1, mas não é
um dos 5 priorizados — revisar junto quando o item 1 for implementado).

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
