# Contributing to Obsipano

First off, thank you for considering contributing to Obsipano! It's people like you that make this project better.

## Code of Conduct

This project and everyone participating in it is governed by the [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report unacceptable behavior via the [GitHub issues](https://github.com/fazelstudio/obsipano/issues).

## How Can I Contribute?

### Reporting Bugs

Before submitting a bug report, please check the existing issues to see if the problem has already been reported. If it has, add a comment to the existing issue instead of opening a new one.

When creating a bug report, include as many details as possible:

- **Clear title and description** — What happened vs. what you expected.
- **Steps to reproduce** — Include code or project files if relevant.
- **Environment** — OS, app version, build method (dev vs. built binary).
- **Screenshots** — If applicable, add screenshots to help explain the problem.
- **Logs** — Include any relevant console or Rust backend logs.

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating one:

- **Use a clear and descriptive title**.
- **Describe the current behavior** and **explain what you'd like to happen**.
- **Explain why this enhancement would be useful** to most Obsipano users.
- **Include mockups or examples** if applicable.

### Pull Requests

1. **Fork the repository** and create your branch from `main`.
2. **Install dependencies** with `bun install`.
3. **Make your changes** following the code style of the project.
4. **Run type checking, linting, and SDK tests** before submitting:

   ```bash
   bun run check
   bun run lint
   bun run sdk:test
   ```

5. **Test your changes** by running the app:

   ```bash
   bun run tauri dev
   ```

6. **Write meaningful commit messages** following conventional commits (e.g., `feat: add compass plugin`, `fix: resolve panorama loading crash`).
7. **Submit a pull request** to the `main` branch.

### Development Setup

```bash
git clone https://github.com/fazelstudio/obsipano.git
cd obsipano
bun install
bun run tauri dev
```

Make sure you have the [prerequisites](README.md#prerequisites) installed.

## Styleguides

### Git Commit Messages

- Use the present tense ("add feature" not "added feature").
- Use the imperative mood ("move cursor to..." not "moves cursor to...").
- Limit the first line to 72 characters or less.
- Reference issues and pull requests after the first line.
- Use conventional commit prefixes: `feat:`, `fix:`, `refactor:`, `docs:`, `style:`, `chore:`.

### TypeScript Style

- This project uses TypeScript's strict mode.
- Avoid `any` types where possible — prefer `unknown` and type guards.
- Do not hardcode reusable values — import from the appropriate centralized
  constants module.
- Do not hardcode CSS values — use Tailwind utility classes and CSS variables from `src/index.css`.
- Follow the existing patterns in the codebase.
- Run `bun run lint` to check for style issues.

### Architecture Rules

- Read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) before changing folder
  boundaries.
- UI code must use commands for project mutations; do not call Zustand
  mutation methods directly from new features.
- Keep `.obsipano` persistence and native Tauri integration in `src/lib`.
- Keep persisted data contracts in `src/types`.
- New extension-facing actions must be added to the typed command map and
  documented in [docs/EXTENSIONS.md](docs/EXTENSIONS.md).
- Prefer compatibility re-exports when moving public modules so existing
  contributors and extensions are not broken unnecessarily.

### Rust Style

- Format your code with `rustfmt`.
- Follow common Rust idioms and naming conventions.
- Run `cargo clippy` before submitting Rust changes.

## Project Structure

See the [README](README.md#project-structure) for an overview of the project layout.

---

Thank you for contributing!
