<p align="center">
<br><br><br>
<img src="https://github.com/k1LoW/mo/raw/main/images/logo.svg" width="120" alt="mo">
<br><br><br>
</p>

# mo (personal fork)

> [!NOTE]
> Personal fork of [k1LoW/mo](https://github.com/k1LoW/mo) with additional features that may not align with the upstream project's direction. These extensions are maintained for my own workflow and are not intended to be merged upstream.
>
> For the original documentation (installation, usage, CLI flags, etc.), please see the [upstream README](https://github.com/k1LoW/mo#readme).

## Additional features

This fork adds the following on top of the upstream `mo`:

- **In-browser Markdown editor** — Fullscreen CodeMirror 6 + [vimee](https://github.com/vimeejs/vimee) Vim editor. Toggle with the edit button, `:q` to exit.
  - 8 color schemes (Default, Tokyo Night, Nord, Solarized, Dracula, Catppuccin, Rosé Pine, Gruvbox) with Markdown syntax highlighting
  - Block cursor with dynamic width measurement for fullwidth CJK characters
  - Status bar with mode indicator, command line, and cursor position
  - Scroll position sync between view and edit modes
- **Rendering** — Enhanced Markdown rendering closer to GitHub's look and feel.
  - Fullscreen raw view with syntax highlighting, word wrap, and editor color scheme support
  - Light/dark code blocks via Shiki dual theme (`github-light` / `github-dark`) with `github-markdown-css` background
- **Sidebar** — Improved sidebar with contextual controls.
  - Toolbar with view mode, title display, and search toggles inside the sidebar
  - Overlay mode: sidebar floats over content and auto-closes on file select or outside click
- **Table of Contents** — Enhanced ToC navigation.
  - Floating mode: ToC floats over content as a rounded card, auto-closes on outside click
  - Instant heading jump: optional instant scroll (no animation) via smooth scroll toggle
- **Settings dialog** — Centralized configuration UI for theme, font size, layout width, sidebar overlay, floating ToC, smooth scroll, and editor options.

## License

This fork inherits the [MIT License](LICENSE) from the original project by [k1LoW](https://github.com/k1LoW).
