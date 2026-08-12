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

## Sincronização fonte → instalado

`source/dashboard/*.js` e `source/plugins.json` têm cópias instaladas em
`~/.claude/base_project/` e `~/.config/opencode/base_project/`. Editar só `source/` não tem
efeito imediato na máquina de dev — depois de editar, sincronize manualmente ou rode o
instalador de novo:

```powershell
Copy-Item source\dashboard\server.js "$env:USERPROFILE\.claude\base_project\dashboard\server.js" -Force
Copy-Item source\dashboard\log-usage.js "$env:USERPROFILE\.claude\base_project\dashboard\log-usage.js" -Force
Copy-Item source\plugins.json "$env:USERPROFILE\.claude\base_project\plugins.json" -Force
```

O dashboard (`server.js`) precisa reiniciar para pegar mudanças de código — não hot-reload:

```powershell
Get-NetTCPConnection -LocalPort 4317 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
node "$env:USERPROFILE\.claude\base_project\dashboard\launch.js"
```

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

## CI (`.github/workflows/ci.yml`)

- `package.json`/`package-lock.json` existem na raiz desde o item 8 do ROADMAP (dependência
  real: `ajv`+`ajv-formats` para `scripts/validate-plugins.js`). O CI usa `npm ci` +
  `cache: "npm"` normalmente — voltou a isso depois de uma fase intermediária sem lockfile.
- `biome.json` escopa o lint só a `source/dashboard/**/*.js` — sem isso, o Biome varre
  `.opencode/`, `graphify-out/`, e qualquer coisa gerada/de terceiros.
- `tsconfig.json` existe só para permitir `npx tsc` rodar sem erro de "no inputs" — `checkJs`
  fica `false` de propósito (o dashboard é JS puro sem anotações de tipo; `checkJs: true`
  geraria centenas de erros de `any` implícito que não refletem bugs reais).
- `npm run validate:plugins` (= `node scripts/validate-plugins.js`) roda no CI e valida
  `source/plugins.json` contra `schemas/plugins.schema.json` antes de qualquer merge.

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
