# git-reviewer

A local code review tool that provides a GitHub PR-like experience for reviewing changes **before pushing to remote**.

## Why?

With the rise of AI-assisted coding (Claude Code, Copilot, Cursor, etc.), developers increasingly need to review large amounts of generated code before pushing it. The current options are:

- **GitHub/GitLab PRs** — require pushing to remote first, defeating the purpose
- **`git diff` in terminal** — no inline commenting, no review workflow
- **IDE diff viewers** — decent for viewing, but no commenting or review state

**git-reviewer** fills this gap: a lightweight local web app that reads your git repo directly, renders diffs with a familiar UI, and stores review comments in **git-notes** — keeping everything inside git itself.

## Core Concepts

### Review Sessions

A review session is analogous to a GitHub Pull Request. It represents a set of changes to review, defined by a commit range (e.g., `main..HEAD` or `HEAD~3..HEAD`). Sessions are stored as git-notes and persist across restarts.

### Git-Notes Storage

All review data (comments, review status, session metadata) is stored in git-notes under `refs/notes/git-reviewer`. This means:

- No external database — everything lives in git
- Data survives repo clones if notes refs are fetched
- Comments are tied to specific commits
- Standard git tools can inspect the data (`git notes --ref=git-reviewer list`)

### Data Schema

Each review session is stored as a JSON note attached to the head commit of the reviewed range:

```json
{
  "version": 1,
  "session": {
    "id": "uuid",
    "title": "Review AI-generated auth changes",
    "baseRef": "main",
    "headRef": "HEAD",
    "baseCommit": "abc123",
    "headCommit": "def456",
    "status": "changes_requested",
    "createdAt": "2026-03-18T10:00:00Z",
    "updatedAt": "2026-03-18T11:30:00Z"
  },
  "comments": [
    {
      "id": "uuid",
      "file": "src/auth/middleware.ts",
      "line": 42,
      "side": "right",
      "body": "This doesn't handle the expired token case",
      "author": "marcos",
      "createdAt": "2026-03-18T10:15:00Z",
      "resolved": false
    }
  ]
}
```

## Architecture

```
┌─────────────────────────────────────────────────┐
│                   CLI (entry point)              │
│              `git-reviewer serve`                │
└────────────────────┬────────────────────────────┘
                     │
         ┌───────────┴───────────┐
         │                       │
┌────────▼────────┐   ┌─────────▼─────────┐
│   Express API   │   │   React Frontend  │
│                 │   │   (served by API)  │
│  /api/sessions  │   │                   │
│  /api/diff      │   │   - diff2html     │
│  /api/comments  │   │   - Review UI     │
│  /api/repo      │   │   - Comment layer │
└────────┬────────┘   └───────────────────┘
         │
┌────────▼────────┐
│   Git Layer     │
│                 │
│  - simple-git   │
│  - diff parsing │
│  - notes R/W    │
└─────────────────┘
```

### Packages

This is a pnpm monorepo with two packages:

- **`packages/server`** — Node.js Express server that reads the target git repo, generates diffs, and manages review data in git-notes. Also serves the built client in production.
- **`packages/client`** — React app (Vite) that renders the review UI. Uses diff2html for diff rendering and provides an inline commenting layer.

## Tech Decisions

| Decision            | Choice              | Why                                                       |
| ------------------- | ------------------- | --------------------------------------------------------- |
| **Language**        | TypeScript (strict) | Type safety, shared types between server/client           |
| **Server**          | Express             | Simple, well-known, sufficient for a local tool           |
| **Frontend**        | React + Vite        | Fast dev experience, component model fits the UI needs    |
| **Diff rendering**  | diff2html           | Battle-tested library, supports inline/side-by-side views |
| **Git interaction** | simple-git          | Thin wrapper around git CLI, handles all git operations   |
| **Review storage**  | git-notes           | No external DB, data lives in git, portable               |
| **Package manager** | pnpm workspaces     | Efficient, good monorepo support                          |
| **Linting**         | ESLint + Prettier   | Standard tooling                                          |

### Why NOT...

- **VS Code extension?** — Limited UI real estate, webview API constraints, harder to iterate on UI. A standalone web app gives full control over the review experience. Can always add VS Code integration later.
- **Gitea/Forgejo?** — Requires pushing to an internal remote. We want to review _before_ any push.
- **git-appraise directly?** — Abandoned project, CLI-only, no web UI. But we borrow its data model concept (JSON in git-notes).
- **Custom git refs (like git-bug)?** — More robust for multi-user scenarios, but overkill for personal use. Git-notes are simpler and sufficient for a single reviewer.

## Roadmap

### Phase 1 — MVP: Read-Only Diff Viewer

- [x] CLI that starts a local server (`git-reviewer serve`)
- [x] Server reads target repo and generates diffs
- [x] React UI renders diff with diff2html (file tree + inline view)
- [x] Support reviewing `branch..branch`, `commit..commit`, or uncommitted changes

### Phase 2 — Inline Comments

- [x] Click a diff line to add a comment
- [x] Comments persisted to git-notes as JSON
- [x] Display existing comments on page load
- [x] Resolve/unresolve threads

### Phase 3 — Review Sessions

- [x] Create named review sessions (like PRs)
- [x] List all sessions with status (pending, approved, changes requested)
- [x] Session-level approve/reject actions

### Phase 4 — Polish

- [x] Keyboard shortcuts (n/p for next/prev file, c for comment)
- [x] File tree with changed file indicators
- [x] Side-by-side diff view toggle
- [x] Syntax highlighting in diffs
- [x] Dark/light theme

### Future Ideas

- VS Code extension (webview that embeds the review UI)
- Multi-repo support (review changes across repos)
- AI-assisted review (flag potential issues in diffs)
- Share review sessions via git notes push

## Getting Started

### Prerequisites

- Node.js >= 20
- pnpm >= 9
- Git

### Install

```bash
pnpm install
```

### Development

```bash
# Start both server and client in dev mode
pnpm dev

# Server only
pnpm --filter @git-reviewer/server dev

# Client only
pnpm --filter @git-reviewer/client dev
```

### Build

```bash
pnpm build
```

### Usage

```bash
# Review current branch against main
git-reviewer serve --base main

# Review specific commit range
git-reviewer serve --base abc123 --head def456

# Review uncommitted changes
git-reviewer serve --uncommitted

# Specify a different repo path
git-reviewer serve --repo /path/to/repo --base main
```

## License

MIT
