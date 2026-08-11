# base_project — regras internas deste repositório

Este arquivo é sobre trabalhar *neste* repositório (o instalador em si). Não confundir com
`source/CLAUDE.md`, que é o bloco distribuído para os projetos que instalam o base_project —
edite `source/CLAUDE.md` quando a mudança for para os *usuários* do base_project; edite este
arquivo quando a mudança for sobre como *desenvolver* o base_project.

## O que este projeto é

Um instalador de configuração global (Node.js + PowerShell/Bash), não uma aplicação. Não tem
`package.json` de app real — só `.opencode/package.json` (config interna, não confundir).

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

- Sem `package.json`/lockfile na raiz de propósito — `npm ci`/`cache: "npm"` quebram sem eles.
  O CI instala `biome`/`typescript` via `npm install --no-save`.
- `biome.json` escopa o lint só a `source/dashboard/**/*.js` — sem isso, o Biome varre
  `.opencode/`, `graphify-out/`, e qualquer coisa gerada/de terceiros.
- `tsconfig.json` existe só para permitir `npx tsc` rodar sem erro de "no inputs" — `checkJs`
  fica `false` de propósito (o dashboard é JS puro sem anotações de tipo; `checkJs: true`
  geraria centenas de erros de `any` implícito que não refletem bugs reais).
