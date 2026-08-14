# Proposta: cobertura do catálogo pra projetos numéricos/científicos

## O gap

O catálogo atual (`plugins.json`) cobre bem web (Playwright, Supabase, Postgres, SQLite),
design (skill-ui, impeccable, taste-skill, emil-design-eng) e segurança (strix). Não tem
nada pra projetos numéricos/científicos — MATLAB, simulação, ciência de dados, ou qualquer
coisa que implemente/reproduza um método de um paper acadêmico. O projeto MGGP-em-MATLAB
é um exemplo direto: nenhuma entrada existente tinha `recommend_if` aplicável.

Duas entradas resolvem a maior parte disso.

---

## Proposta 1 — MATLAB MCP Server (oficial, MathWorks)

Deixa o agente **executar** MATLAB de verdade — rodar `.m`, rodar testes
`matlab.unittest`, analisar código estaticamente (equivalente ao `mlint`/Code Analyzer),
e checar quais toolboxes estão instaladas — em vez de escrever `.m` "às cegas" e pedir
pro usuário rodar manualmente. Verificado direto no repo oficial antes de propor isso.

```json
{
  "id": "matlab-mcp",
  "name": "MATLAB MCP Server (oficial, MathWorks)",
  "kind": "mcp",
  "summary": "Servidor MCP oficial da MathWorks: executa/avalia código MATLAB, roda arquivos .m, roda testes matlab.unittest com relatório completo, faz análise estática de código (estilo/erros/performance), e detecta MATLAB + toolboxes instaladas.",
  "recommend_if": "O projeto é primariamente MATLAB (.m files presentes) e o MATLAB está instalado e no PATH.",
  "source": "https://github.com/matlab/matlab-mcp-server",
  "requires": [
    "MATLAB R2021a ou mais recente no PATH do sistema (R2023a+ necessário pro modo 'anexar a sessão existente')",
    "Licença MATLAB válida — o Contrato de Licença da MathWorks para este server proíbe uso compartilhado por múltiplos usuários"
  ],
  "manual": true,
  "claude": {
    "instruction": "Baixe o binário do matlab-mcp-server pro seu SO na página de releases do GitHub (ou `go install github.com/matlab/matlab-mcp-server/cmd/matlab-mcp-server@latest`), depois: claude mcp add --transport stdio matlab -- /caminho/completo/pro/binario"
  }
}
```

**Por que importa pro caso concreto (MGGP em MATLAB):** cobre direto o item de
"testes" e "lint" do `project-standards.md` pra esse projeto — `run_matlab_test_file`
roda a suíte `matlab.unittest` que valida o port contra a biblioteca Python original,
e `check_matlab_code` é o "lint" que o checklist pede e que MATLAB puro não tem CLI
padrão pra isso sem essa ponte.

**Ressalva de licença:** vale deixar explícito no catálogo — não é question de pirataria
vs. legítimo, é que o próprio contrato da MathWorks pra esse MCP específico proíbe uso
compartilhado entre usuários. Relevante mencionar quando `/plugins` sugerir isso.

---

## Proposta 2 — arXiv MCP Server

Busca/recupera papers direto do arXiv de dentro do agente. Útil pra qualquer projeto
que está implementando ou reproduzindo um método publicado — deixa checar o paper
original, comparar contra a implementação, ou levantar trabalhos relacionados sem sair
pro browser. Escolhi essa implementação específica depois de comparar algumas opções
(existem várias não-oficiais) — essa tem 3000+ estrelas, mantida ativamente, Apache 2.0.

```json
{
  "id": "arxiv-search",
  "name": "arXiv MCP Server",
  "kind": "mcp",
  "summary": "Busca, baixa e analisa papers do arXiv.org de dentro do agente — útil pra checar o método original de um algoritmo sendo implementado, ou levantar literatura relacionada.",
  "recommend_if": "O projeto implementa ou reproduz um método de um paper acadêmico (ex: TCC, dissertação, port de um algoritmo publicado) e precisa consultar literatura.",
  "source": "https://github.com/blazickjp/arxiv-mcp-server",
  "requires": ["uv (https://docs.astral.sh/uv/) instalado"],
  "note": "NÃO instalar via npm/npx — existe um pacote npm sem relação com o mesmo nome; o próprio projeto avisa isso.",
  "claude": {
    "scope": "local",
    "instruction": "claude mcp add arxiv-search -- uvx arxiv-mcp-server"
  }
}
```

**Por que importa pro caso concreto:** o projeto MGGP inteiro nasceu de rastrear papers
(Rafael Veiga, o paper da `mggp` no arXiv 2211.05723, os papers do GPTIPS) — ter isso
como ferramenta desde o início economiza exatamente o tipo de busca manual que a gente
fez nas últimas conversas.

---

## Onde entra no `plugins.json`

Ambas cabem no array `catalog`, e fazem sentido no profile `"full"` (não em `"minimal"`,
já que são bem específicas de domínio). Nenhuma precisa entrar em `"design"`.
