# base_project — regras internas deste repositório

Este arquivo é sobre trabalhar *neste* repositório (o instalador em si). Não confundir com
`source/CLAUDE.md`, que é o bloco distribuído para os projetos que instalam o base_project —
edite `source/CLAUDE.md` quando a mudança for para os *usuários* do base_project; edite este
arquivo quando a mudança for sobre como *desenvolver* o base_project.

## O que este projeto é

Um instalador de configuração global (Node.js + PowerShell/Bash), não uma aplicação publicada.
Tem um `package.json` na raiz (desde o item 8 do ROADMAP — validação de `plugins.json` via
`ajv`), mas é só tooling de dev/CI (lint, typecheck, validação de schema) — não é pensado para
`npm publish`. Não confundir com `.opencode/package.json` (config interna do opencode).

## Idioma: inglês para o modelo, português para o usuário

Regra que decide o idioma de qualquer arquivo novo em `source/`:

- **Texto que o modelo executa → inglês.** Comandos (`source/*/commands/*.md`), agentes,
  `source/CLAUDE.md`, `source/opencode-instructions.md`, comentários de hook, e referências
  lidas como instrução (`project-standards.md`). O modelo segue instrução em inglês com menos
  ambiguidade, e esses arquivos nunca chegam ao usuário como texto.
- **Texto renderizado literalmente ao usuário → idioma do usuário.** Hoje só
  `references/command-menu.md`, que a instrução manda imprimir palavra por palavra —
  traduzir esse arquivo pioraria o produto, não é dívida a pagar.

Um arquivo em inglês que produz resposta ao usuário deve dizer explicitamente para responder
no idioma do usuário (o `project-standards.md` faz isso no rodapé) — senão o inglês do arquivo
vaza para a resposta.

Verificação rápida de drift: procurar `\b(não|para|você|projeto|arquivo)\b` em `source/**/*.md`
deve casar só nos `command-menu.md`.

## Sincronização fonte → instalado

`source/hooks/*.js`, `source/plugins.json`, `source/claude/`, `source/opencode/` têm cópias
instaladas em `~/.claude/` e `~/.config/opencode/`. Editar só `source/` não tem efeito
imediato na máquina de dev — depois de editar, rode o instalador de novo
(`dev\scripts\install.ps1` / `dev/scripts/install.sh`) para sincronizar.

## Ferramentas instaladas nesta máquina para trabalhar em design/UI

`frontend-design`, `impeccable` (plugins via `claude plugin`), `emil-design-eng` (+ sub-skills),
`design-taste-frontend` (skills via `npx skills add`, instaladas em `~/.claude/skills/`).

**Nunca rode `npx skills add` de dentro deste repositório** — ele instala relativo ao diretório
atual (`.claude/skills/`, `.agents/skills/`, `skills-lock.json`), poluindo o repo com arquivos
que deveriam estar no escopo global do usuário. Sempre rode de um diretório neutro
(`$env:TEMP`) e depois copie o resultado para `~/.claude/skills/`.

## Git: nunca use `git checkout -- <arquivo>` para desfazer uma reformatação

Se um `biome check --write` (ou qualquer formatter) reescrever mais do que o esperado,
**não** use `git checkout --` para reverter — isso descarta qualquer mudança não commitada
no arquivo, não só a reformatação. Prefira `git diff` para revisar e reverter manualmente as
partes indesejadas, ou `git stash` antes de rodar formatters amplos.

## Layout: `dev/` guarda tudo que só quem desenvolve o base_project precisa

`scripts/`, `schemas/`, `tests/`, `ROADMAP.md` vivem dentro de `dev/` — nada disso importa
pra quem só *usa* o base_project (roda o installer, usa os comandos). O que fica na raiz é
só o que um usuário final precisa ver (`README.md`, `ARCHITECTURE.md`, `source/`) mais o que
ferramentas externas exigem estar na raiz por convenção: `package.json`/`package-lock.json`
(`npm ci`/`cache: "npm"`), e **`biome.json`/`tsconfig.json` também continuam na raiz** —
tentativa deliberada de movê-los pra `dev/` foi revertida: o Biome 2.x recusa um
`includes`/pattern que escape do diretório do próprio config via `../` ("Found a nested
root configuration" / "these paths were ignored"), e como o lint precisa cobrir
`source/hooks/**/*.js` (fora de `dev/`) além de `dev/scripts/*.js`/`dev/tests/**/*.js`
(dentro), o config só funciona ficando num ponto que enxerga as duas árvores — a raiz.
`tsconfig.json` tecnicamente toleraria ficar em `dev/` (tsc não tem essa restrição de
boundary), mas foi movido de volta junto por consistência: os dois configs de tooling do
mesmo par de diretórios devem morar no mesmo lugar. Os scripts que os comandos globais
invocam (`dev/scripts/validate-plugins.js` etc.) continuam apontando pra dentro de `dev/`.

## CI (`.github/workflows/ci.yml`)

- `package.json`/`package-lock.json` existem na raiz desde o item 8 do ROADMAP (dependência
  real: `ajv`+`ajv-formats` para `dev/scripts/validate-plugins.js`). O CI usa `npm ci` +
  `cache: "npm"` normalmente — voltou a isso depois de uma fase intermediária sem lockfile.
- `biome.json` (raiz) escopa o lint a `source/hooks/**/*.js`, `dev/scripts/*.js`,
  `dev/tests/**/*.js` — sem isso, o Biome varre `.opencode/`, `graphify-out/`, e qualquer
  coisa gerada/de terceiros.
- `tsconfig.json` (raiz) existe só para permitir `npx tsc` rodar sem erro de "no inputs" —
  `checkJs` fica `false` de propósito.
- `npm run validate:plugins` (= `node dev/scripts/validate-plugins.js`) roda no CI e valida
  `source/plugins.json` contra `dev/schemas/plugins.schema.json` antes de qualquer merge.

### Bug histórico: CI rodava um Biome fantasma (`biome@0.3.3`)

Antes do `package.json`/lockfile existir, o CI instalava a dependência certa
(`npm install --no-save @biomejs/biome`) mas depois chamava `npx biome check .` — **sem** o
escopo `@biomejs/`. O `npx` não achou um binário `biome` correspondente ao pacote instalado
e silenciosamente baixou/rodou um pacote *diferente* do registro chamado só `biome`
(`biome@0.3.3`, um stub que não faz nada de útil). Resultado: o CI reportava sucesso, mas o
lint/format real do dashboard nunca rodou — havia 3 erros de formatação genuínos em
`server.js` que ficaram invisíveis por commits inteiros. Só foi descoberto ao comparar
`npx biome format .` local (achou os erros) com o log real do último CI verde (mostrava
`npm warn exec ... biome@0.3.3` sendo instalado). Com `npm ci` + `@biomejs/biome` como
devDependency real, `node_modules/.bin/biome` existe localmente e `npx biome` resolve para
ele corretamente — o bug se resolveu como efeito colateral de sair do modelo
`npm install --no-save`. Lição: `npx <nome-curto>` não é garantia de rodar o pacote com
escopo (`@scope/nome-curto`) que você acabou de instalar — sempre conferir o log de
instalação do `npx` (`npm warn exec The following package was not found...`) quando o
comportamento parecer suspeito demais de "ok".
