---
# base_project:managed
description: Map the current project into graphify + repomix outputs.
---

Map the current project for token-efficient AI context:

1. Check this project's `.gitignore` for `graphify-out/` and `repomix-output.xml`. If either is missing, append
   it (create `.gitignore` if the project doesn't have one yet) — these are generated artifacts and must never
   be committed.
2. Run `repomix` and `graphify .` in the current directory.
3. If a command fails (tool not found), tell the user to run the base_project installer
   (`install.ps1` / `install.sh`) once to set up global tooling, then report the exact error.
4. Report only: which artifacts were generated (`repomix-output.xml`, `graphify-out/`) and their status.

$ARGUMENTS
