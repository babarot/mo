import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from "react";
import { EditorView, keymap } from "@codemirror/view";
import { Compartment, Prec } from "@codemirror/state";
import { basicSetup } from "codemirror";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { saveFileContent } from "../hooks/useApi";
import { getEditorTheme } from "../lib/editorThemes";

interface EditorProps {
  content: string;
  activeGroup: string;
  fileId: string;
  lineWrapping?: boolean;
  autoSave?: boolean;
  initialLine?: number;
  colorScheme?: string;
}

export interface EditorHandle {
  getCursorLine(): number;
  flushSave(): Promise<void>;
  flushSaveTo(group: string, fileId: string): Promise<void>;
}

function getCurrentMode(): "dark" | "light" {
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

export const Editor = forwardRef<EditorHandle, EditorProps>(function Editor(
  {
    content,
    activeGroup,
    fileId,
    lineWrapping = true,
    autoSave = false,
    initialLine,
    colorScheme = "default",
  },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const themeRef = useRef(new Compartment());
  const wrapRef = useRef(new Compartment());
  const savingRef = useRef(false);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const activeGroupRef = useRef(activeGroup);
  activeGroupRef.current = activeGroup;
  const fileIdRef = useRef(fileId);
  fileIdRef.current = fileId;
  const autoSaveRef = useRef(autoSave);
  autoSaveRef.current = autoSave;
  const colorSchemeRef = useRef(colorScheme);
  colorSchemeRef.current = colorScheme;

  // Snapshot the editor buffer synchronously, then save asynchronously, so
  // callers can fire this right before the component unmounts (e.g. when
  // the active file changes mid-edit) and the PUT still reaches the right
  // target. Mirrors autoSave's silent-failure behaviour; surfacing errors
  // is a separate task once there is a toast/banner story.
  const saveBuffer = useCallback(async (group: string, id: string) => {
    const view = viewRef.current;
    if (!view) return;
    if (savingRef.current) return;
    const value = view.state.doc.toString();
    savingRef.current = true;
    try {
      await saveFileContent(group, id, value);
    } catch {
      /* swallow */
    } finally {
      savingRef.current = false;
    }
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      getCursorLine() {
        const view = viewRef.current;
        if (!view) return 0;
        return view.state.doc.lineAt(view.state.selection.main.head).number - 1;
      },
      flushSave() {
        clearTimeout(autoSaveTimerRef.current);
        return saveBuffer(activeGroupRef.current, fileIdRef.current);
      },
      flushSaveTo(group: string, id: string) {
        clearTimeout(autoSaveTimerRef.current);
        return saveBuffer(group, id);
      },
    }),
    [saveBuffer],
  );

  useEffect(() => {
    if (!containerRef.current) return;

    const themeCompartment = themeRef.current;
    const wrapCompartment = wrapRef.current;
    const initialTheme = getEditorTheme(colorSchemeRef.current, getCurrentMode());

    const saveKeymap = Prec.high(
      keymap.of([
        {
          key: "Mod-s",
          preventDefault: true,
          run: () => {
            void saveBuffer(activeGroupRef.current, fileIdRef.current);
            return true;
          },
        },
      ]),
    );

    const view = new EditorView({
      doc: content,
      extensions: [
        saveKeymap,
        basicSetup,
        markdown({ base: markdownLanguage, codeLanguages: languages }),
        wrapCompartment.of(lineWrapping ? EditorView.lineWrapping : []),
        themeCompartment.of(initialTheme),
        EditorView.updateListener.of((update) => {
          if (!update.docChanged) return;
          if (!autoSaveRef.current) return;
          clearTimeout(autoSaveTimerRef.current);
          autoSaveTimerRef.current = setTimeout(() => {
            void saveBuffer(activeGroupRef.current, fileIdRef.current);
          }, 1000);
        }),
        EditorView.theme({
          "&": { height: "100%" },
          ".cm-scroller": { overflow: "auto" },
          ".cm-content": { paddingRight: "3.5rem" },
          "&.cm-focused": { outline: "none" },
        }),
      ],
      parent: containerRef.current,
    });

    viewRef.current = view;

    if (initialLine != null && initialLine > 0) {
      const lineNum = Math.min(initialLine + 1, view.state.doc.lines);
      const line = view.state.doc.line(lineNum);
      view.dispatch({
        selection: { anchor: line.from },
        effects: EditorView.scrollIntoView(line.from, { y: "start" }),
      });
    }

    view.focus();

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
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-once; refs keep latest props
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const newTheme = getEditorTheme(colorScheme, getCurrentMode());
    view.dispatch({ effects: themeRef.current.reconfigure(newTheme) });
  }, [colorScheme]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: wrapRef.current.reconfigure(lineWrapping ? EditorView.lineWrapping : []),
    });
  }, [lineWrapping]);

  return <div ref={containerRef} className="mo-editor h-full overflow-hidden" />;
});
