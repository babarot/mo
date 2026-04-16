import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from "react";
import { EditorView, ViewPlugin } from "@codemirror/view";
import type { ViewUpdate } from "@codemirror/view";
import { Compartment, findClusterBreak } from "@codemirror/state";
import { basicSetup } from "codemirror";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { attach } from "@vimee/plugin-codemirror";
import type { VimAction } from "@vimee/core";
import { saveFileContent } from "../hooks/useApi";
import { getEditorTheme } from "../lib/editorThemes";

interface VimEditorProps {
  content: string;
  activeGroup: string;
  fileId: string;
  onQuit: (cursorLine?: number) => void;
  lineWrapping?: boolean;
  autoSave?: boolean;
  initialLine?: number;
  colorScheme?: string;
  blockCursor?: boolean;
}

function getCurrentMode(): "dark" | "light" {
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

const blockCursorStyle = EditorView.theme({
  ".cm-cursor": {
    borderLeftColor: "transparent !important",
    borderLeft: "none !important",
    backgroundColor: "currentColor",
    opacity: "0.7",
    width: "0.6em",
  },
});

const blockCursorWidthPlugin = ViewPlugin.fromClass(
  class {
    view: EditorView;
    constructor(view: EditorView) {
      this.view = view;
      requestAnimationFrame(() => this.adjustWidth());
    }
    update(update: ViewUpdate) {
      if (update.selectionSet || update.docChanged || update.geometryChanged) {
        requestAnimationFrame(() => this.adjustWidth());
      }
    }
    adjustWidth() {
      const { view } = this;
      const pos = view.state.selection.main.head;
      const line = view.state.doc.lineAt(pos);
      let width = "";
      if (pos < line.to) {
        const nextPos = findClusterBreak(view.state.doc.sliceString(pos, line.to), 0, true) + pos;
        const start = view.coordsAtPos(pos);
        const end = view.coordsAtPos(nextPos);
        if (start && end) {
          const w = Math.abs(end.left - start.left);
          if (w > 0) width = `${w}px`;
        }
      }
      for (const el of view.dom.querySelectorAll<HTMLElement>(".cm-cursor")) {
        el.style.width = width;
      }
    }
    destroy() {
      for (const el of this.view.dom.querySelectorAll<HTMLElement>(".cm-cursor")) {
        el.style.width = "";
      }
    }
  },
);

const blockCursorExtensions = [blockCursorStyle, blockCursorWidthPlugin];

export interface VimEditorHandle {
  getCursorLine(): number;
}

export const VimEditor = forwardRef<VimEditorHandle, VimEditorProps>(function VimEditor(
  {
    content,
    activeGroup,
    fileId,
    onQuit,
    lineWrapping = true,
    autoSave = false,
    initialLine,
    colorScheme = "default",
    blockCursor = true,
  },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  useImperativeHandle(ref, () => ({
    getCursorLine() {
      const view = viewRef.current;
      if (!view) return 0;
      return view.state.doc.lineAt(view.state.selection.main.head).number - 1;
    },
  }));
  const themeRef = useRef(new Compartment());
  const wrapRef = useRef(new Compartment());
  const cursorRef = useRef(new Compartment());
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  savingRef.current = saving;

  const activeGroupRef = useRef(activeGroup);
  activeGroupRef.current = activeGroup;
  const fileIdRef = useRef(fileId);
  fileIdRef.current = fileId;
  const autoSaveRef = useRef(autoSave);
  autoSaveRef.current = autoSave;
  const colorSchemeRef = useRef(colorScheme);
  colorSchemeRef.current = colorScheme;
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (!containerRef.current) return;

    const themeCompartment = themeRef.current;
    const wrapCompartment = wrapRef.current;
    const cursorCompartment = cursorRef.current;
    const initialTheme = getEditorTheme(colorSchemeRef.current, getCurrentMode());

    const view = new EditorView({
      doc: content,
      extensions: [
        basicSetup,
        markdown({ base: markdownLanguage, codeLanguages: languages }),
        wrapCompartment.of(lineWrapping ? EditorView.lineWrapping : []),
        themeCompartment.of(initialTheme),
        cursorCompartment.of(blockCursor ? blockCursorExtensions : []),
        EditorView.theme({
          "&": { height: "100%" },
          ".cm-scroller": { overflow: "auto" },
          "&.cm-focused": { outline: "none" },
        }),
      ],
      parent: containerRef.current,
    });

    const doAutoSave = (value: string) => {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = setTimeout(async () => {
        if (savingRef.current) return;
        setSaving(true);
        try {
          await saveFileContent(activeGroupRef.current, fileIdRef.current, value);
        } catch {
          // API error
        } finally {
          setSaving(false);
        }
      }, 1000);
    };

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
      onChange: (value: string) => {
        if (autoSaveRef.current) doAutoSave(value);
      },
      onAction: (action: VimAction) => {
        if (action.type === "quit") {
          const line = view.state.doc.lineAt(view.state.selection.main.head).number - 1;
          onQuit(line);
        }
      },
    });

    viewRef.current = view;

    // Scroll to initial line if specified
    if (initialLine != null && initialLine > 0) {
      const lineNum = Math.min(initialLine + 1, view.state.doc.lines);
      const line = view.state.doc.line(lineNum);
      view.dispatch({
        selection: { anchor: line.from },
        effects: EditorView.scrollIntoView(line.from, { y: "start" }),
      });
    }

    // Watch for theme changes (dark/light mode toggle)
    const observer = new MutationObserver(() => {
      const newTheme = getEditorTheme(colorSchemeRef.current, getCurrentMode());
      view.dispatch({ effects: themeCompartment.reconfigure(newTheme) });
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    return () => {
      clearTimeout(autoSaveTimerRef.current);
      observer.disconnect();
      vim.destroy();
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  // Dynamic color scheme switch
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const newTheme = getEditorTheme(colorScheme, getCurrentMode());
    view.dispatch({ effects: themeRef.current.reconfigure(newTheme) });
  }, [colorScheme]);

  // Dynamic block cursor toggle
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: cursorRef.current.reconfigure(blockCursor ? blockCursorExtensions : []),
    });
  }, [blockCursor]);

  // Dynamic line wrapping toggle
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: wrapRef.current.reconfigure(lineWrapping ? EditorView.lineWrapping : []),
    });
  }, [lineWrapping]);

  return (
    <div
      ref={containerRef}
      className="mo-vim-editor h-full min-h-[400px] rounded-md overflow-hidden border border-gh-border"
    />
  );
});
