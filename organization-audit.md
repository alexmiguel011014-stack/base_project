# Organization Audit — File/Folder Structure

**Scope:** Read-only scan of actual vs. intended structure (ARCHITECTURE.md).
- Cross-referenced `source/claude/commands/` vs. `source/opencode/command/`
- Compared root directory against ARCHITECTURE.md §2 "Mapa de diretórios"
- Checked `dev/scripts/` vs. `dev/tests/` for admin/non-admin segregation

## Checklist Findings

| # | Item | Found | Intended | Status | Severity | Evidence |
|---|------|-------|----------|--------|----------|----------|
| 1 | `recomendacoes.txt` at root | ✓ found at `recomendacoes.txt` | `dev/` only (admin) | **misplaced** | **medium** | Architecture §2: `dev/` separates admin-only files. `recomendacoes.txt` has no business being at root; it confuses the "product" surface that users see. |
| 2 | `assets/` at root | ✓ found at `assets/` (contains `desktop.ini`, `icone.ico`) | Not specified in architecture (typically gitignored assets) | **present, low impact** | **low** | Sits at root alongside `source/` and `dev/`. Per convention, asset files like icons should either be in `source/` (if distributed) or gitignored. Sitting at root adds visual clutter but isn't functionally wrong. |
| 3 | Near-identical command files duplication | ✓ `source/claude/commands/` and `source/opencode/command/` both have 17 files with matching names | Mirroring for dual-engine support (Claude Code + opencode) — intentional but near-identical | **intentional duplication** | **medium** | 17 files identical in name across both directories; content differs slightly (e.g., `bootstrap.md` 3990 vs 3987 bytes, `plugins.md` 9064 vs 8096 bytes). Architecture doc explicitly states both pairs exist for their respective engine formats. However, the near-identical naming creates navigational noise for anyone browsing both trees. |
| 4 | `graphify-out/` and `repomix-output.xml` at root | ✓ both present | Covered by `.gitignore` (should never be committed) | **present, gitignored** | **low** | Both are generated artifacts. They're in `.gitignore` so they won't be committed, but their presence at root (rather than in `graphify-out/` subpath or ignored entirely) is cosmetic clutter. The `.gitignore` already handles them, so this is a minor issue. |
| 5 | `audit-report.md` at root | ✓ newly created by this audit | Not part of original structure | **present** | **low** | New file from this session. Not a pre-existing organizational issue. |

## Summary

- **High findings:** 0 — no actively misleading or duplicated logic that breaks navigation.
- **Medium findings:** 2 — (`recomendacoes.txt` at root, command-file duplication across `source/` and `opencode/`)
- **Low findings:** 3 — (`assets/` at root, generated artifacts at root, `audit-report.md` newly placed)

## Target Assessment

- Moving `recomendacoes.txt` into `dev/` aligns with Architecture §2's rule that `dev/` is the admin-only compartment. This is the highest-impact cleanup.
- The `source/claude/commands/` vs. `source/opencode/command/` duplication is by design (mirroring for two engine formats). No movement needed unless the project drops support for one engine format.
- `assets/` and generated artifacts at root are cosmetic; the `.gitignore` already protects against committing `graphify-out/` and `repomix-output.xml`.

**Running `/fixproject` makes sense:** Yes — the two medium-severity items (`recomendacoes.txt` relocation, command-file de-duplication consideration) are actionable. The low items are optional cleanups.