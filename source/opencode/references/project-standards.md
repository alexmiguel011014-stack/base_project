# base_project:managed

Checklist de referência compartilhada entre `/newproject`, `/scanproject` e
`/fixproject` — o que "um projeto bem formado" significa para o base_project.
Editar só aqui; os 3 comandos apontam pra este arquivo em vez de repetir a
lista cada um à sua maneira, pra não divergirem com o tempo.

Cada item tem: **o que checar** e **por que importa**. Nem todo item se
aplica a todo projeto (ex: um script solteiro não precisa de CI) — julgamento
de contexto continua sendo necessário, isto não é uma régua rígida.

## 1. Identidade do projeto
- Existe um `README.md` (ou equivalente) explicando o que o projeto é e como rodar.
- Existe um arquivo de instruções pro assistente (`CLAUDE.md`/`AGENTS.md`) se o projeto
  tiver convenções que não são óbvias só lendo o código.

## 2. Controle de versão
- É um repositório git (`git status` funciona).
- `.gitignore` cobre artefatos gerados, dependências (`node_modules/`, `.venv/`,
  `dist/`, `graphify-out/`) e segredos (`.env`).
- Nenhum segredo real (chave de API, token, senha) commitado no histórico.

## 3. Segredos e configuração
- Runtime secrets vêm de `.env` (gitignored), não hardcoded no código.
- Existe um `.env.example` (sem valores reais) se o projeto precisa de config pra rodar.

## 4. Dependências
- Existe um manifesto real (`package.json`, `pyproject.toml`, `Cargo.toml`, etc.) com
  lockfile — não instalação ad-hoc sem registro.
- Nenhuma dependência não utilizada óbvia (import morto de peso significativo).

## 5. Testes
- Existe pelo menos um comando de teste que roda com um único comando e sai com
  código 0/não-zero de forma confiável.
- Cobertura não precisa ser alta — o que importa é que o caminho crítico (a lógica
  central do projeto, não plumbing trivial) tem alguma prova automatizada.

## 6. Qualidade de código
- Lint/format configurado e rodando limpo (ou os erros existentes são conhecidos e
  intencionais, não silêncio por falta de configuração).
- Typecheck (se a linguagem suportar) rodando sem erro.

## 7. CI
- Existe um pipeline (`.github/workflows/`, `.gitlab-ci.yml`, etc.) rodando pelo menos
  lint + teste a cada push/PR — não depende só de rodar na máquina do desenvolvedor.

## 8. Segurança básica
- Sem vulnerabilidade crítica conhecida nas dependências (`npm audit`, `pip-audit`,
  equivalente) sem tratamento.
- Sem padrão de código obviamente perigoso (`eval` de input não confiável, comando
  shell interpolado sem sanitização, credencial em texto puro).

## 9. Estrutura
- Organização de pastas é consistente com a convenção da linguagem/framework
  (não uma mistura arbitrária que dificulta navegação).
- Nenhum arquivo gigante fazendo tudo quando o projeto já cresceu o suficiente pra
  justificar separação (julgamento de escala, não regra fixa de tamanho).

---

Ao rodar `/scanproject`, cada item vira um achado com **severidade** (crítico / médio /
baixo) e **arquivo/linha** quando aplicável — mesmo formato que `@reviewer` já usa
pra revisão de código, não um formato novo.
