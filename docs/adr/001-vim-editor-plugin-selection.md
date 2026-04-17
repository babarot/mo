# ADR-001: Vim editor plugin selection (@vimee over @replit/codemirror-vim)

## Status

Accepted

## Context

mo's in-browser Markdown editor is built on CodeMirror 6 and requires Vim keybinding support. Two viable CodeMirror 6 vim plugins exist:

| | @vimee/plugin-codemirror | @replit/codemirror-vim |
|---|---|---|
| npm weekly downloads | 27 | 49,476 |
| GitHub stars | 25 | 449 |
| Contributors | 1 | 30 |
| First published | 2026-03 | 2021-09 |
| Architecture | Headless engine + editor adapter | CM6 extension (CM5 vim.js port) |
| API style | Callback-based (`onSave`, `onModeChange`, `onAction`) | Ex command registration + event listeners |
| TypeScript | First-class types (`VimMode`, `VimAction`) | Partial types |
| Bundle | Small (zero-dep core) | Larger (includes full CM5 vim.js ~4000+ lines) |
| Vim coverage | Core motions, operators, text objects, basic ex | Comprehensive (macros, registers, `:s`, `:g`, etc.) |

@replit/codemirror-vim is the de facto standard with 4.5 years of production use at Replit. @vimee is a 1-person project created in March 2026.

## Decision

Adopted **@vimee/plugin-codemirror** for the following reasons:

1. **Clean callback API** — `attach(view, {onSave, onChange, onModeChange, onAction})` maps directly to mo's needs (save on `:w`, quit on `:q`, status bar mode display). The replit plugin requires manual `Vim.defineEx()` registration and event listener wiring for each feature.

2. **Custom status bar integration** — vimee exposes `getCursor()` and mode state programmatically, making it straightforward to build mo's custom status bar (mode indicator, command line, cursor position). The replit plugin renders its own DOM panel, requiring either adoption of their panel or reverse-engineering internal state.

3. **Sufficient vim coverage for the use case** — mo is a Markdown viewer with occasional editing, not a full IDE. The core vim features (modes, motions, operators, text objects, `:w`/`:q`) are all present. Advanced features like `:g`, `:sort`, complex macros are not needed.

4. **Lower migration cost** — Switching to replit later would require a full rewrite of `VimEditor.tsx` due to the fundamentally different integration pattern (imperative attach vs. CM6 extension). Starting with vimee avoids this cost.

### Trade-offs accepted

- **Maintenance risk** — Single developer, 1-month-old project. If abandoned (no commits for 3+ months), migration to @replit/codemirror-vim becomes necessary.
- **Patch required** — A pnpm patch (`patches/@vimee__plugin-codemirror.patch`) adds `getCommandLine()` and `syncCursorFromEditor()` not yet in the published API.
- **Narrower vim coverage** — Power users expecting full vim fidelity (complex macros, register manipulation, `:g` commands) will find gaps.

## Consequences

- `VimEditor.tsx` depends on vimee's callback-based API pattern. A future switch to @replit/codemirror-vim would require full component rewrite.
- The pnpm patch must be maintained until upstream merges the changes or an alternative is found.
- mo implements its own block cursor (`ViewPlugin` with character-width measurement) rather than relying on any editor plugin's built-in cursor.
- **Migration trigger**: If vimee goes unmaintained for 3+ months or critical bugs accumulate, begin migration to @replit/codemirror-vim.
