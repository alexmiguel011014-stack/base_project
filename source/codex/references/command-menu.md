# base_project:managed

Fonte única do menu “o que você deseja fazer agora?”. Editar só aqui — a instrução em `AGENTS.md` manda renderizar este arquivo, não redigitar a lista de memória.

## Menu

O que você deseja fazer agora?

- `$bootstrap` — sincroniza o projeto e o armário unificado `~/.agents/`, detecta drift real e mapeia o código com repomix + graphify.
- `$newproject` — planeja um projeto novo com a estrutura certa e inicia a pesquisa do `$newgoal` em segundo plano quando o ambiente permitir.
- `$newgoal` — pesquisa e escreve o plano executável em `GOALS.md`; nunca implementa o plano.
- `$repertoire` — pesquisa profundamente o domínio de um projeto ou um assunto avulso; declara limites e sempre confirma antes.
- `$execgoals` — executa o `GOALS.md` ativo item por item, só marca o que foi verificado e checa a estrutura após lotes de edição.
- `$scanproject` — audita identidade, CI, testes, lint, segurança básica e estrutura. Comece aqui.
- `$audit` — aprofunda segurança ou mostra as camadas de configuração aplicadas a um projeto e agente.
- `$cleanproject` — procura arquivos mortos, pastas erradas e duplicação sem alterar nada.
- `$fixproject` — corrige os achados de `$scanproject` e `$cleanproject` e verifica cada correção.
- `$undo` — reverte o último lote de mudanças com confirmações separadas por risco.
- `$diario` — registra contribuições no diário externo ao repositório, usando o histórico já coletado.
- `$ship` — valida, commita e envia as mudanças sem force-push nem resolução automática de conflitos.
- `$pr` — prepara e abre um pull request da branch atual, sempre confirmando título e corpo.
- `$plugins` — recomenda e instala capacidades opcionais adequadas ao projeto.
- `$council` — testa uma decisão com cinco perspectivas independentes antes de sintetizar um veredito.
- `$designreview` — revisa um design, screenshot, URL ou interface produzida contra uma rubrica verificável.
- `$wpp` — mostra este mesmo menu novamente quando você quiser.
- `$status` — mostra a versão e tudo que o base_project ativou no Codex.
- `$usagebp` — mostra o que foi instalado, usado, nunca usado, lento ou está falhando.
- `$update` — verifica e aplica uma atualização do próprio base_project após confirmação.
- `$uninstall` — remove a integração em camadas, com confirmação proporcional ao impacto.
- Ou apenas descreva o que precisa em português; o Codex escolhe as ferramentas adequadas.
