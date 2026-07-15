---
name: commit-message
description: Generate conventional commit messages from staged changes using "go" or /commit-message
---

# Commit Message Generator

Generates a structured conventional commit message from staged git changes. Invoked by typing `go` or `/commit-message`.

## Workflow

1. Run `git status` to identify staged files and detect unstaged/untracked files.
2. Run `git diff --cached` to analyze only the staged changes.
3. Optionally run `git log --oneline -10` to reference recent commit message style.
4. Treat the current staged changes as the new commit target every time, even if a previous request was already handled.
5. Do not carry forward prior staged-change analysis unless the user explicitly asks for that.
6. Generate a conventional commit message with the format below.

## Output format

```
<type>(<scope>): <brief imperative summary>

Introduces or implements the intended behavior in one or two sentences, focused on the reason for the change and the product/application impact.

- **<Layer name>**:
  - Describe the staged changes in this layer using base-form verbs.

- **File changes**:
  - `M` path/to/modified-file
  - `A` path/to/new-file
  - `R` old/path -> new/path
  - `D` path/to/deleted-file
```

## Rules

- Never stage changes. Never commit changes.
- Analyze only staged changes. Ignore unstaged and untracked files.
- Follow existing repository commit conventions.
- Use a concise, conventional commit title.
- Focus on why the change was made and what behavior it enables, not just what files changed.
- Include only one section per touched layer. Omit sections for layers not touched.
- Do not include empty sections or an alternative one-line version.
- Keep the message directly usable as the body for `git commit -m`.
- In body section bullet points, use base-form verbs (e.g. `Add`, `Move`, `Update`, `Register`, `Remove`, `Keep`), not third-person singular (`Adds`, `Moves`, etc.).

## Layer section rules

- Infer the repository's actual architecture from the staged files, directory layout, framework markers, package manifests, build files, and recent commit style. Use the layer names the project already uses when they are clear.
- Prefer concise, project-specific layer names that describe responsibility. Good examples: **UI**, **API**, **Core**, **Services**, **Persistence**, **Infrastructure**, **Build / project**, **Tooling**, or a domain-specific label such as **Audio engine**.
- If the repository has no obvious layered architecture, group changes by functional area instead.
- Include **Database / persistence** only for schema, migration, ORM, or repository changes.
- Include **Domain** only for domain entities, events, errors, or primitives.
- Include **Application** only for use-case orchestration, commands, queries, handlers, or services.
- Include **UI** or **Frontend** for user-facing interface code in non-web apps. Include **Web** only for MVC, React, TypeScript, or web-facing code in web apps.
- Include **Infrastructure** for cross-cutting implementation concerns (external clients, auth, logging, DI, etc.).
- Include **Build / project** for build system, package manifests, CMake changes.
- Include **Testing** for test files.
- When in doubt, choose the smallest number of meaningful sections.
