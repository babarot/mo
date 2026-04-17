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

- **In-browser Markdown editor** — Edit files directly in the browser with a fullscreen CodeMirror 6 + [vimee](https://github.com/vimeejs/vimee) Vim editor. Toggle with the edit button, `:q` to exit.
  - 8 color schemes (Default, Tokyo Night, Nord, Solarized, Dracula, Catppuccin, Rosé Pine, Gruvbox) with Markdown syntax highlighting
  - Block cursor with dynamic width measurement for fullwidth CJK characters
  - Status bar with mode indicator, command line, and cursor position
  - Scroll position sync between view and edit modes
- **Fullscreen raw view** — Raw Markdown source view fills the content area with syntax highlighting, word wrap, and editor color scheme support (Shiki themes mapped from the selected color scheme).
- **Light/dark code blocks** — Code fence syntax highlighting follows the app theme instantly via Shiki dual theme (`github-light` / `github-dark`). Background color defers to `github-markdown-css` for accurate GitHub styling.
- **Sidebar toolbar** — View mode, title display, and search toggles moved from the header into the sidebar for better contextual grouping.
- **Sidebar overlay mode** — Optional overlay mode where the sidebar floats over content and auto-closes on file select or outside click. Enable in Settings > Appearance.
- **Settings dialog** — Centralized configuration UI for theme, font size, layout width, sidebar overlay, and editor options.

## License

This fork inherits the [MIT License](LICENSE) from the original project by [k1LoW](https://github.com/k1LoW).
