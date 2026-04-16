import { useEffect, useRef, useState } from "react";
import { EditorView } from "@codemirror/view";
import { Compartment } from "@codemirror/state";
import { basicSetup } from "codemirror";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { oneDark } from "@codemirror/theme-one-dark";
import { attach } from "@vimee/plugin-codemirror";
import type { VimAction } from "@vimee/core";
import { saveFileContent } from "../hooks/useApi";

interface VimEditorProps {
  content: string;
  activeGroup: string;
  fileId: string;
  onQuit: () => void;
}

function isDarkTheme(): boolean {
  return document.documentElement.getAttribute("data-theme") === "dark";
}

const lightTheme = EditorView.theme({
  "&": {
    backgroundColor: "#ffffff",
    color: "#1f2328",
  },
  ".cm-gutters": {
    backgroundColor: "#f6f8fa",
    color: "#636c76",
    borderRight: "1px solid #d0d7de",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "#e1e4e8",
  },
  ".cm-activeLine": {
    backgroundColor: "#f6f8fa",
  },
  ".cm-cursor": {
    borderLeftColor: "#1f2328",
  },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": {
    backgroundColor: "rgba(9, 105, 218, 0.2) !important",
  },
});

export function VimEditor({ content, activeGroup, fileId, onQuit }: VimEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const themeRef = useRef(new Compartment());
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  savingRef.current = saving;

  const activeGroupRef = useRef(activeGroup);
  activeGroupRef.current = activeGroup;
  const fileIdRef = useRef(fileId);
  fileIdRef.current = fileId;

  useEffect(() => {
    if (!containerRef.current) return;

    const themeCompartment = themeRef.current;
    const initialTheme = isDarkTheme() ? oneDark : lightTheme;

    const view = new EditorView({
      doc: content,
      extensions: [
        basicSetup,
        markdown({ base: markdownLanguage, codeLanguages: languages }),
        EditorView.lineWrapping,
        themeCompartment.of(initialTheme),
        EditorView.theme({
          "&": { height: "100%" },
          ".cm-scroller": { overflow: "auto" },
          "&.cm-focused": { outline: "none" },
        }),
      ],
      parent: containerRef.current,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- EditorView satisfies CodeMirrorView at runtime
    const vim = attach(view as any, {
      onSave: async (value: string) => {
        if (savingRef.current) return;
        setSaving(true);
        try {
          await saveFileContent(activeGroupRef.current, fileIdRef.current, value);
        } catch {
          // API error
        } finally {
          setSaving(false);
        }
      },
      onAction: (action: VimAction) => {
        if (action.type === "quit") onQuit();
      },
    });

    viewRef.current = view;

    // Watch for theme changes
    const observer = new MutationObserver(() => {
      const newTheme = isDarkTheme() ? oneDark : lightTheme;
      view.dispatch({ effects: themeCompartment.reconfigure(newTheme) });
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    return () => {
      observer.disconnect();
      vim.destroy();
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="mo-vim-editor h-full min-h-[400px] rounded-md overflow-hidden border border-gh-border"
    />
  );
}
