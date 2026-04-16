import { EditorView } from "@codemirror/view";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";
import type { Extension } from "@codemirror/state";

export interface EditorColorScheme {
  name: string;
  label: string;
  dark: EditorThemeColors;
  light: EditorThemeColors;
}

interface EditorThemeColors {
  // Editor chrome
  bg: string;
  text: string;
  gutterBg: string;
  gutterText: string;
  gutterBorder: string;
  activeLineBg: string;
  activeGutterBg: string;
  cursor: string;
  selection: string;
  // Syntax highlighting
  heading: string;
  emphasis: string;
  strong: string;
  link: string;
  url: string;
  code: string;
  quote: string;
  meta: string;
  list: string;
}

export const EDITOR_COLOR_SCHEMES: EditorColorScheme[] = [
  {
    name: "default",
    label: "Default",
    dark: {
      bg: "#282c34",
      text: "#abb2bf",
      gutterBg: "#282c34",
      gutterText: "#636d83",
      gutterBorder: "#3e4452",
      activeLineBg: "#2c313c",
      activeGutterBg: "#2c313c",
      cursor: "#528bff",
      selection: "rgba(62, 68, 82, 0.6)",
      heading: "#e06c75",
      emphasis: "#c678dd",
      strong: "#e5c07b",
      link: "#61afef",
      url: "#56b6c2",
      code: "#98c379",
      quote: "#5c6370",
      meta: "#636d83",
      list: "#d19a66",
    },
    light: {
      bg: "#ffffff",
      text: "#1f2328",
      gutterBg: "#f6f8fa",
      gutterText: "#636c76",
      gutterBorder: "#d0d7de",
      activeLineBg: "#f6f8fa",
      activeGutterBg: "#e1e4e8",
      cursor: "#1f2328",
      selection: "rgba(9, 105, 218, 0.2)",
      heading: "#d73a49",
      emphasis: "#6f42c1",
      strong: "#e36209",
      link: "#0969da",
      url: "#0550ae",
      code: "#032f62",
      quote: "#6a737d",
      meta: "#8b949e",
      list: "#e36209",
    },
  },
  {
    name: "tokyo-night",
    label: "Tokyo Night",
    dark: {
      bg: "#1a1b26",
      text: "#a9b1d6",
      gutterBg: "#1a1b26",
      gutterText: "#3b3d57",
      gutterBorder: "#2f3348",
      activeLineBg: "#24283b",
      activeGutterBg: "#24283b",
      cursor: "#c0caf5",
      selection: "rgba(42, 55, 100, 0.5)",
      heading: "#bb9af7",
      emphasis: "#c0caf5",
      strong: "#e0af68",
      link: "#7aa2f7",
      url: "#73daca",
      code: "#9ece6a",
      quote: "#565f89",
      meta: "#444b6a",
      list: "#ff9e64",
    },
    light: {
      bg: "#d5d6db",
      text: "#343b58",
      gutterBg: "#cbccd1",
      gutterText: "#6e7191",
      gutterBorder: "#b4b5ba",
      activeLineBg: "#cbccd1",
      activeGutterBg: "#c0c1c6",
      cursor: "#343b58",
      selection: "rgba(52, 84, 138, 0.2)",
      heading: "#8c4351",
      emphasis: "#7c3aed",
      strong: "#8f5e15",
      link: "#34548a",
      url: "#166775",
      code: "#485e30",
      quote: "#6e7191",
      meta: "#9699a3",
      list: "#965027",
    },
  },
  {
    name: "nord",
    label: "Nord",
    dark: {
      bg: "#2e3440",
      text: "#d8dee9",
      gutterBg: "#2e3440",
      gutterText: "#4c566a",
      gutterBorder: "#3b4252",
      activeLineBg: "#3b4252",
      activeGutterBg: "#3b4252",
      cursor: "#d8dee9",
      selection: "rgba(67, 76, 94, 0.6)",
      heading: "#81a1c1",
      emphasis: "#b48ead",
      strong: "#ebcb8b",
      link: "#88c0d0",
      url: "#8fbcbb",
      code: "#a3be8c",
      quote: "#616e88",
      meta: "#4c566a",
      list: "#d08770",
    },
    light: {
      bg: "#eceff4",
      text: "#2e3440",
      gutterBg: "#e5e9f0",
      gutterText: "#4c566a",
      gutterBorder: "#d8dee9",
      activeLineBg: "#e5e9f0",
      activeGutterBg: "#d8dee9",
      cursor: "#2e3440",
      selection: "rgba(94, 129, 172, 0.2)",
      heading: "#5e81ac",
      emphasis: "#b48ead",
      strong: "#d08770",
      link: "#5e81ac",
      url: "#4c6e96",
      code: "#a3be8c",
      quote: "#7b88a1",
      meta: "#9199a8",
      list: "#d08770",
    },
  },
  {
    name: "solarized",
    label: "Solarized",
    dark: {
      bg: "#002b36",
      text: "#839496",
      gutterBg: "#002b36",
      gutterText: "#586e75",
      gutterBorder: "#073642",
      activeLineBg: "#073642",
      activeGutterBg: "#073642",
      cursor: "#839496",
      selection: "rgba(7, 54, 66, 0.8)",
      heading: "#b58900",
      emphasis: "#d33682",
      strong: "#cb4b16",
      link: "#268bd2",
      url: "#2aa198",
      code: "#859900",
      quote: "#586e75",
      meta: "#657b83",
      list: "#cb4b16",
    },
    light: {
      bg: "#fdf6e3",
      text: "#657b83",
      gutterBg: "#eee8d5",
      gutterText: "#93a1a1",
      gutterBorder: "#d3cbb7",
      activeLineBg: "#eee8d5",
      activeGutterBg: "#e6e0ce",
      cursor: "#657b83",
      selection: "rgba(238, 232, 213, 0.8)",
      heading: "#b58900",
      emphasis: "#d33682",
      strong: "#cb4b16",
      link: "#268bd2",
      url: "#2aa198",
      code: "#859900",
      quote: "#93a1a1",
      meta: "#93a1a1",
      list: "#cb4b16",
    },
  },
  {
    name: "dracula",
    label: "Dracula",
    dark: {
      bg: "#282a36",
      text: "#f8f8f2",
      gutterBg: "#282a36",
      gutterText: "#6272a4",
      gutterBorder: "#44475a",
      activeLineBg: "#44475a",
      activeGutterBg: "#44475a",
      cursor: "#f8f8f2",
      selection: "rgba(68, 71, 90, 0.6)",
      heading: "#ff79c6",
      emphasis: "#f1fa8c",
      strong: "#ffb86c",
      link: "#8be9fd",
      url: "#50fa7b",
      code: "#50fa7b",
      quote: "#6272a4",
      meta: "#6272a4",
      list: "#bd93f9",
    },
    light: {
      bg: "#f8f8f2",
      text: "#282a36",
      gutterBg: "#f0f0e8",
      gutterText: "#6272a4",
      gutterBorder: "#d0d0c8",
      activeLineBg: "#f0f0e8",
      activeGutterBg: "#e8e8e0",
      cursor: "#282a36",
      selection: "rgba(124, 58, 237, 0.15)",
      heading: "#d6336c",
      emphasis: "#7c3aed",
      strong: "#e36209",
      link: "#0969da",
      url: "#2e8b57",
      code: "#2e8b57",
      quote: "#6272a4",
      meta: "#9ea4b8",
      list: "#7c3aed",
    },
  },
  {
    name: "catppuccin",
    label: "Catppuccin",
    dark: {
      bg: "#1e1e2e",
      text: "#cdd6f4",
      gutterBg: "#1e1e2e",
      gutterText: "#6c7086",
      gutterBorder: "#313244",
      activeLineBg: "#313244",
      activeGutterBg: "#313244",
      cursor: "#f5e0dc",
      selection: "rgba(88, 91, 112, 0.4)",
      heading: "#f38ba8",
      emphasis: "#cba6f7",
      strong: "#fab387",
      link: "#89b4fa",
      url: "#94e2d5",
      code: "#a6e3a1",
      quote: "#6c7086",
      meta: "#585b70",
      list: "#f9e2af",
    },
    light: {
      bg: "#eff1f5",
      text: "#4c4f69",
      gutterBg: "#e6e9ef",
      gutterText: "#9ca0b0",
      gutterBorder: "#ccd0da",
      activeLineBg: "#e6e9ef",
      activeGutterBg: "#dce0e8",
      cursor: "#4c4f69",
      selection: "rgba(30, 102, 245, 0.15)",
      heading: "#d20f39",
      emphasis: "#8839ef",
      strong: "#fe640b",
      link: "#1e66f5",
      url: "#179299",
      code: "#40a02b",
      quote: "#9ca0b0",
      meta: "#acb0be",
      list: "#df8e1d",
    },
  },
  {
    name: "rose-pine",
    label: "Ros\u00e9 Pine",
    dark: {
      bg: "#191724",
      text: "#e0def4",
      gutterBg: "#191724",
      gutterText: "#6e6a86",
      gutterBorder: "#26233a",
      activeLineBg: "#26233a",
      activeGutterBg: "#26233a",
      cursor: "#e0def4",
      selection: "rgba(46, 40, 68, 0.7)",
      heading: "#ebbcba",
      emphasis: "#c4a7e7",
      strong: "#f6c177",
      link: "#9ccfd8",
      url: "#31748f",
      code: "#31748f",
      quote: "#6e6a86",
      meta: "#555169",
      list: "#eb6f92",
    },
    light: {
      bg: "#faf4ed",
      text: "#575279",
      gutterBg: "#f2e9e1",
      gutterText: "#9893a5",
      gutterBorder: "#dfdad6",
      activeLineBg: "#f2e9e1",
      activeGutterBg: "#ebe5dd",
      cursor: "#575279",
      selection: "rgba(144, 122, 169, 0.15)",
      heading: "#d7827e",
      emphasis: "#907aa9",
      strong: "#ea9d34",
      link: "#286983",
      url: "#56949f",
      code: "#56949f",
      quote: "#9893a5",
      meta: "#b4afba",
      list: "#b4637a",
    },
  },
  {
    name: "gruvbox",
    label: "Gruvbox",
    dark: {
      bg: "#282828",
      text: "#ebdbb2",
      gutterBg: "#282828",
      gutterText: "#665c54",
      gutterBorder: "#3c3836",
      activeLineBg: "#3c3836",
      activeGutterBg: "#3c3836",
      cursor: "#ebdbb2",
      selection: "rgba(80, 73, 69, 0.6)",
      heading: "#fb4934",
      emphasis: "#d3869b",
      strong: "#fabd2f",
      link: "#83a598",
      url: "#8ec07c",
      code: "#b8bb26",
      quote: "#665c54",
      meta: "#7c6f64",
      list: "#fe8019",
    },
    light: {
      bg: "#fbf1c7",
      text: "#3c3836",
      gutterBg: "#f2e5bc",
      gutterText: "#928374",
      gutterBorder: "#d5c4a1",
      activeLineBg: "#f2e5bc",
      activeGutterBg: "#ebdbb2",
      cursor: "#3c3836",
      selection: "rgba(69, 133, 136, 0.15)",
      heading: "#9d0006",
      emphasis: "#8f3f71",
      strong: "#b57614",
      link: "#458588",
      url: "#689d6a",
      code: "#79740e",
      quote: "#928374",
      meta: "#a89984",
      list: "#af3a03",
    },
  },
];

function buildTheme(colors: EditorThemeColors): Extension[] {
  const theme = EditorView.theme({
    "&": {
      backgroundColor: colors.bg,
      color: colors.text,
    },
    ".cm-gutters": {
      backgroundColor: colors.gutterBg,
      color: colors.gutterText,
      borderRight: `1px solid ${colors.gutterBorder}`,
    },
    ".cm-activeLineGutter": {
      backgroundColor: colors.activeGutterBg,
    },
    ".cm-activeLine": {
      backgroundColor: colors.activeLineBg,
    },
    ".cm-cursor": {
      borderLeftColor: colors.cursor,
    },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": {
      backgroundColor: `${colors.selection} !important`,
    },
  });

  const highlighting = syntaxHighlighting(
    HighlightStyle.define([
      // Headings
      { tag: tags.heading1, color: colors.heading, fontWeight: "bold", fontSize: "1.3em" },
      { tag: tags.heading2, color: colors.heading, fontWeight: "bold", fontSize: "1.2em" },
      { tag: tags.heading3, color: colors.heading, fontWeight: "bold", fontSize: "1.1em" },
      {
        tag: [tags.heading4, tags.heading5, tags.heading6],
        color: colors.heading,
        fontWeight: "bold",
      },
      // Emphasis & strong
      { tag: tags.emphasis, color: colors.emphasis, fontStyle: "italic" },
      { tag: tags.strong, color: colors.strong, fontWeight: "bold" },
      // Links & URLs
      { tag: tags.link, color: colors.link, textDecoration: "underline" },
      { tag: tags.url, color: colors.url },
      // Code
      { tag: [tags.monospace, tags.processingInstruction], color: colors.code },
      // Quotes
      { tag: tags.quote, color: colors.quote, fontStyle: "italic" },
      // List markers
      { tag: tags.list, color: colors.list },
      // Metadata / markers (e.g. #, *, >, ```)
      { tag: [tags.meta, tags.comment], color: colors.meta },
      { tag: tags.contentSeparator, color: colors.meta },
      // Strikethrough
      { tag: tags.strikethrough, textDecoration: "line-through", color: colors.meta },
    ]),
  );

  return [theme, highlighting];
}

export function getEditorScheme(name: string): EditorColorScheme {
  return EDITOR_COLOR_SCHEMES.find((s) => s.name === name) ?? EDITOR_COLOR_SCHEMES[0];
}

export function getEditorTheme(schemeName: string, mode: "dark" | "light"): Extension[] {
  const scheme = getEditorScheme(schemeName);
  return buildTheme(scheme[mode]);
}

const SHIKI_THEME_MAP: Record<string, { dark: string; light: string }> = {
  default: { dark: "github-dark", light: "github-light" },
  "tokyo-night": { dark: "tokyo-night", light: "github-light" },
  nord: { dark: "nord", light: "github-light" },
  solarized: { dark: "solarized-dark", light: "solarized-light" },
  dracula: { dark: "dracula", light: "github-light" },
  catppuccin: { dark: "catppuccin-mocha", light: "catppuccin-latte" },
  "rose-pine": { dark: "rose-pine", light: "rose-pine-dawn" },
  gruvbox: { dark: "gruvbox-dark-medium", light: "gruvbox-light-medium" },
};

export function getShikiTheme(schemeName: string, mode: "dark" | "light"): string {
  return SHIKI_THEME_MAP[schemeName]?.[mode] ?? SHIKI_THEME_MAP.default[mode];
}
