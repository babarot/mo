import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Sidebar } from "./components/Sidebar";
import { MarkdownViewer } from "./components/MarkdownViewer";
import { SettingsDialog } from "./components/SettingsDialog";
import { loadSettings, saveSettings, applyTheme, type Settings } from "./lib/settings";
import { GroupDropdown } from "./components/GroupDropdown";
import type { ViewMode } from "./components/ViewModeToggle";
import { RestartButton } from "./components/RestartButton";
import { DropOverlay } from "./components/DropOverlay";
import { ZoomModal } from "./components/ZoomModal";
import type { ZoomContent } from "./components/ZoomModal";
import { TocPanel } from "./components/TocPanel";
import type { TocHeading } from "./components/TocPanel";
import { useSSE } from "./hooks/useSSE";
import { useFileDrop } from "./hooks/useFileDrop";
import { useActiveHeading } from "./hooks/useActiveHeading";
import { useScrollRestoration, SCROLL_SESSION_KEY } from "./hooks/useScrollRestoration";
import type { FileEntry, Group, SearchResult } from "./hooks/useApi";
import {
  fetchGroups,
  fetchSearchResults,
  removeFile,
  reorderFiles,
  resolveHomeFile,
} from "./hooks/useApi";
import {
  allFileIds,
  parseGroupFromPath,
  parseFileIdFromSearch,
  parseHomePathFromPath,
  groupToPath,
} from "./utils/groups";
import { isMarkdownFile } from "./utils/filetype";

const VIEWMODE_STORAGE_KEY = "mo-sidebar-viewmode";
const SHOW_TITLE_STORAGE_KEY = "mo-sidebar-show-title";
export const TOC_OPEN_STORAGE_KEY = "mo-toc-open";

export function getInitialTocOpenMap(): Record<string, boolean> {
  try {
    const stored = localStorage.getItem(TOC_OPEN_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch {
    /* ignore */
  }
  return {};
}

export function formatTitle(fileEntry: Pick<FileEntry, "name" | "title"> | undefined): string {
  if (fileEntry == undefined) return "mo";
  const { name, title } = fileEntry;
  const fullTitle = title === undefined ? name : `${title} - ${name}`;
  return `${fullTitle} | mo`;
}

export function isTocOpenForFile(
  map: Record<string, boolean>,
  fileId: string | null,
  fileName: string,
): boolean {
  if (fileId == null) return false;
  if (fileName && !isMarkdownFile(fileName)) return false;
  return map[fileId] === true;
}

export function App() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [activeGroup, setActiveGroup] = useState<string>(() => {
    // When the URL uses the /~/ home-path scheme, the pathname is not a group
    // name. Start with "default" and let the resolve effect below overwrite
    // activeGroup once we know which group the file belongs to.
    if (parseHomePathFromPath(window.location.pathname)) return "default";
    return parseGroupFromPath(window.location.pathname) || "default";
  });
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [tocOpenMap, setTocOpenMap] = useState<Record<string, boolean>>(getInitialTocOpenMap);
  const [headings, setHeadings] = useState<TocHeading[]>([]);
  const [contentRevision, setContentRevision] = useState(0);
  const [searchQuery, setSearchQuery] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [pendingSearchHeading, setPendingSearchHeading] = useState<string | null>(null);
  const [viewModes, setViewModes] = useState<Record<string, ViewMode>>(() => {
    try {
      const stored = localStorage.getItem(VIEWMODE_STORAGE_KEY);
      if (stored) return JSON.parse(stored);
    } catch {
      /* ignore */
    }
    return {};
  });
  const [showTitles, setShowTitles] = useState<Record<string, boolean>>(() => {
    try {
      const stored = localStorage.getItem(SHOW_TITLE_STORAGE_KEY);
      if (stored) return JSON.parse(stored);
    } catch {
      /* ignore */
    }
    return {};
  });
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const knownFileIds = useRef<Set<string>>(new Set());
  const [initialFileId, setInitialFileId] = useState<string | null>(() => {
    const fromUrl = parseFileIdFromSearch(window.location.search);
    if (fromUrl) return fromUrl;
    // Restore active file from scroll context saved before reload
    try {
      const stored = sessionStorage.getItem(SCROLL_SESSION_KEY);
      if (stored) {
        const ctx = JSON.parse(stored);
        if (ctx.url === window.location.pathname && ctx.fileId) return ctx.fileId;
      }
    } catch {
      /* ignore */
    }
    return null;
  });
  const [scrollContainer, setScrollContainer] = useState<HTMLDivElement | null>(null);
  const [zoomContent, setZoomContent] = useState<ZoomContent | null>(null);

  // Track previous values for render-time state adjustment
  const [prevGroups, setPrevGroups] = useState<Group[]>([]);
  const [prevActiveGroup, setPrevActiveGroup] = useState(activeGroup);

  // Adjust derived state during render when groups or activeGroup changes
  if (groups !== prevGroups || activeGroup !== prevActiveGroup) {
    setPrevGroups(groups);
    setPrevActiveGroup(activeGroup);

    // Active file selection and sidebar auto open/close
    const group = groups.find((g) => g.name === activeGroup);
    if (!settings.sidebarOverlay) {
      setSidebarOpen(group != null && group.files.length >= 2);
    }

    if (groups.length === 0) {
      setActiveFileId(null);
    } else if (!group) {
      const sortedGroups = [...groups].sort((a, b) => {
        if (a.name === "default") return 1;
        if (b.name === "default") return -1;
        return a.name.localeCompare(b.name);
      });
      setActiveGroup(sortedGroups[0].name);
    } else if (group.files.length === 0) {
      setActiveFileId(null);
    } else if (initialFileId != null) {
      setInitialFileId(null);
      setActiveFileId(
        group.files.some((f) => f.id === initialFileId) ? initialFileId : group.files[0].id,
      );
    } else {
      setActiveFileId((prev) => {
        if (group.files.some((f) => f.id === prev)) return prev;
        return group.files[0].id;
      });
    }
  }

  const loadGroups = useCallback(async () => {
    try {
      const data = await fetchGroups();
      const newIds = allFileIds(data);
      const wasEmpty = knownFileIds.current.size === 0;
      const added: string[] = [];
      for (const id of newIds) {
        if (!knownFileIds.current.has(id)) {
          added.push(id);
        }
      }
      knownFileIds.current = newIds;

      setGroups(data);

      if (added.length > 0 && !wasEmpty) {
        // Only auto-select if the new file belongs to the current active group
        setActiveGroup((currentGroup) => {
          const group = data.find((g) => g.name === currentGroup);
          if (group) {
            const addedSet = new Set(added);
            const matched = group.files.filter((f) => addedSet.has(f.id));
            if (matched.length > 0) {
              setActiveFileId(matched[matched.length - 1].id);
            }
          }
          return currentGroup;
        });
      }
    } catch {
      // server may not be ready yet
    }
  }, []);

  // Initial data fetch (setState inside .then() is async, not flagged by linter)
  useEffect(() => {
    fetchGroups()
      .then((data) => {
        knownFileIds.current = allFileIds(data);
        setGroups(data);
      })
      .catch(() => {});
  }, []);

  // Resolve /~/ URLs on mount. While this is pending, we must not let the
  // "sync URL with active group" effect rewrite the pathname, or the home
  // path gets wiped before we can read it on the server.
  const pendingHomePathRef = useRef<string | null>(parseHomePathFromPath(window.location.pathname));

  useEffect(() => {
    const relPath = pendingHomePathRef.current;
    if (!relPath) return;
    resolveHomeFile(relPath)
      .then((result) => {
        pendingHomePathRef.current = null;
        if (result) {
          setActiveGroup(result.group);
          setInitialFileId(result.id);
        } else {
          console.warn(`mo: no registered file for ~/${relPath}`);
          window.history.replaceState(null, "", "/");
        }
      })
      .catch((err) => {
        pendingHomePathRef.current = null;
        console.warn("mo: failed to resolve home path", err);
        window.history.replaceState(null, "", "/");
      });
  }, []);

  // Sync URL path with active group
  useEffect(() => {
    if (pendingHomePathRef.current) return;
    const expectedPath = groupToPath(activeGroup);
    if (window.location.pathname !== expectedPath) {
      window.history.replaceState(null, "", expectedPath);
    }
  }, [activeGroup]);

  // Clear search params after consuming initial file ID
  useEffect(() => {
    if (initialFileId === null && window.location.search) {
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [initialFileId]);

  useEffect(() => {
    if (!searchQuery?.trim()) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }

    let cancelled = false;
    setSearchLoading(true);

    const timer = setTimeout(() => {
      fetchSearchResults(searchQuery, activeGroup)
        .then((resp) => {
          if (!cancelled) {
            setSearchResults(resp.results);
            setSearchLoading(false);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setSearchResults([]);
            setSearchLoading(false);
          }
        });
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery, activeGroup]);

  const activeFile = useMemo(
    () => groups.find((g) => g.name === activeGroup)?.files.find((f) => f.id === activeFileId),
    [groups, activeGroup, activeFileId],
  );
  const activeFileName = activeFile?.name ?? "";
  const tocOpen = isTocOpenForFile(tocOpenMap, activeFileId, activeFileName);
  const currentShowTitle: boolean = showTitles[activeGroup] ?? false;

  const setTocOpen = useCallback(
    (open: boolean) => {
      if (activeFileId == null) return;
      setTocOpenMap((prev) => ({ ...prev, [activeFileId]: open }));
    },
    [activeFileId],
  );

  useEffect(() => {
    document.title = formatTitle(activeFile);
  }, [activeFile]);

  useSSE({
    onUpdate: () => {
      loadGroups();
    },
    onFileChanged: (fileId) => {
      captureScrollPosition();
      setActiveFileId((current) => {
        if (current === fileId) {
          setContentRevision((r) => r + 1);
        }
        return current;
      });
    },
  });

  const { isDragging } = useFileDrop(activeGroup);

  const currentViewMode: ViewMode = viewModes[activeGroup] ?? "flat";

  useEffect(() => {
    localStorage.setItem(VIEWMODE_STORAGE_KEY, JSON.stringify(viewModes));
  }, [viewModes]);

  useEffect(() => {
    localStorage.setItem(SHOW_TITLE_STORAGE_KEY, JSON.stringify(showTitles));
  }, [showTitles]);

  useEffect(() => {
    try {
      localStorage.setItem(TOC_OPEN_STORAGE_KEY, JSON.stringify(tocOpenMap));
    } catch {
      /* ignore */
    }
  }, [tocOpenMap]);

  useEffect(() => {
    saveSettings(settings);
    applyTheme(settings.theme);
    if (settings.theme === "auto") {
      const mql = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = () => applyTheme("auto");
      mql.addEventListener("change", handler);
      return () => mql.removeEventListener("change", handler);
    }
  }, [settings]);

  const handleViewModeToggle = useCallback(() => {
    setViewModes((prev) => {
      const current = prev[activeGroup] ?? "flat";
      const nextMode: ViewMode = current === "flat" ? "tree" : "flat";
      return { ...prev, [activeGroup]: nextMode };
    });
  }, [activeGroup]);

  const handleTitleToggle = useCallback(() => {
    setShowTitles((prev) => ({ ...prev, [activeGroup]: !prev[activeGroup] }));
  }, [activeGroup]);

  const handleSearchToggle = useCallback(() => {
    setSearchQuery((prev) => {
      if (prev != null) return null;
      setSidebarOpen(true);
      return "";
    });
  }, []);

  const handleGroupChange = (name: string) => {
    setActiveGroup(name);
    setActiveFileId(null);
    window.history.pushState(null, "", groupToPath(name));
  };

  const handleFileSelect = useCallback(
    (fileId: string) => {
      setActiveFileId(fileId);
      if (settings.sidebarOverlay) setSidebarOpen(false);
    },
    [settings.sidebarOverlay],
  );

  const handleFileOpened = useCallback((fileId: string) => {
    setActiveFileId(fileId);
    setPendingSearchHeading(null);
  }, []);

  const handleSearchResultSelect = useCallback((fileId: string, heading?: string) => {
    setActiveFileId(fileId);
    setPendingSearchHeading(heading || null);
  }, []);

  const handleRemoveFile = useCallback(() => {
    if (activeFileId != null) {
      removeFile(activeGroup, activeFileId);
    }
  }, [activeFileId, activeGroup]);

  const handleFilesReorder = useCallback((groupName: string, fileIds: string[]) => {
    // Optimistic update
    setGroups((prev) =>
      prev.map((g) => {
        if (g.name !== groupName) return g;
        const idToFile = new Map(g.files.map((f) => [f.id, f]));
        const reordered = fileIds
          .map((id) => idToFile.get(id))
          .filter((f): f is NonNullable<typeof f> => f != null);
        return { ...g, files: reordered };
      }),
    );
    reorderFiles(groupName, fileIds);
  }, []);

  const headingIds = useMemo(() => headings.map((h) => h.id), [headings]);

  const activeHeadingId = useActiveHeading(headingIds, scrollContainer);

  const { captureScrollPosition, onContentRendered } = useScrollRestoration(
    scrollContainer,
    activeHeadingId,
    activeFileId,
  );

  const handleHeadingClick = useCallback(
    (id: string) => {
      const el = document.getElementById(id);
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const behavior = settings.smoothScroll && !reduced ? "smooth" : "auto";
      el?.scrollIntoView({ behavior, block: "start" });
    },
    [settings.smoothScroll],
  );

  const handleZoom = useCallback((content: ZoomContent) => {
    setZoomContent(content);
  }, []);

  const handleZoomClose = useCallback(() => {
    setZoomContent(null);
  }, []);

  return (
    <div className="flex flex-col h-full font-sans text-gh-text bg-gh-bg">
      <header className="h-12 shrink-0 flex items-center gap-3 px-4 bg-gh-header-bg text-gh-header-text border-b border-gh-header-border">
        <button
          type="button"
          className="flex items-center justify-center bg-transparent border border-gh-border rounded-md p-1.5 cursor-pointer text-gh-header-text transition-colors duration-150 hover:bg-gh-bg-hover"
          onClick={() => setSidebarOpen((v) => !v)}
          aria-label="Sidebar"
          aria-expanded={sidebarOpen}
          title="Toggle sidebar"
        >
          <svg
            className="size-5"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            viewBox="0 0 24 24"
          >
            <rect x="2" y="3" width="20" height="18" rx="2" />
            <line x1="9" y1="3" x2="9" y2="21" />
            {sidebarOpen ? (
              <polyline points="6,10 4,12 6,14" />
            ) : (
              <polyline points="5,10 7,12 5,14" />
            )}
          </svg>
        </button>
        <GroupDropdown
          groups={groups}
          activeGroup={activeGroup}
          onGroupChange={handleGroupChange}
        />
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            className="flex items-center justify-center bg-transparent border border-gh-border rounded-md p-1.5 cursor-pointer text-gh-header-text transition-colors duration-150 hover:bg-gh-bg-hover"
            onClick={() => setSettingsOpen(true)}
            title="Settings"
          >
            <svg
              className="size-5"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
              />
            </svg>
          </button>
        </div>
      </header>
      <div className="flex flex-1 overflow-hidden relative">
        {sidebarOpen && (
          <>
            {settings.sidebarOverlay && (
              <div className="absolute inset-0 z-20" onClick={() => setSidebarOpen(false)} />
            )}
            <Sidebar
              groups={groups}
              activeGroup={activeGroup}
              activeFileId={activeFileId}
              onFileSelect={handleFileSelect}
              onFilesReorder={handleFilesReorder}
              viewMode={currentViewMode}
              showTitle={currentShowTitle}
              onViewModeToggle={handleViewModeToggle}
              onTitleToggle={handleTitleToggle}
              searchQuery={searchQuery}
              onSearchQueryChange={setSearchQuery}
              onSearchToggle={handleSearchToggle}
              searchResults={searchResults}
              searchLoading={searchLoading}
              onSearchResultSelect={handleSearchResultSelect}
              overlay={settings.sidebarOverlay}
            />
          </>
        )}
        <main className="flex-1 flex flex-col overflow-hidden relative">
          <div
            ref={setScrollContainer}
            className={`flex-1 bg-gh-bg ${isEditing ? "overflow-hidden flex flex-col" : "overflow-y-auto overscroll-contain p-8"}`}
          >
            {activeFileId != null ? (
              <MarkdownViewer
                fileId={activeFileId}
                fileName={activeFileName}
                activeGroup={activeGroup}
                revision={contentRevision}
                onFileOpened={handleFileOpened}
                onHeadingsChange={setHeadings}
                onContentRendered={onContentRendered}
                isTocOpen={tocOpen}
                onTocToggle={() => setTocOpen(!tocOpen)}
                onRemoveFile={handleRemoveFile}
                uploaded={activeFile?.uploaded}
                isWide={settings.wide}
                fontSize={settings.fontSize}
                editorLineWrapping={settings.editorLineWrapping}
                editorAutoSave={settings.editorAutoSave}
                editorColorScheme={settings.editorColorScheme}
                editorBlockCursor={settings.editorBlockCursor}
                onEditStateChange={setIsEditing}
                onZoom={handleZoom}
                scrollToHeading={pendingSearchHeading}
                onScrolledToHeading={() => setPendingSearchHeading(null)}
                searchQuery={searchQuery}
                scrollContainer={scrollContainer}
              />
            ) : (
              <div className="flex items-center justify-center h-50 text-gh-text-secondary text-sm">
                No file selected
              </div>
            )}
          </div>
          {tocOpen && settings.tocFloating && (
            <>
              <div className="absolute inset-0 z-20" onClick={() => setTocOpen(false)} />
              <TocPanel
                headings={headings}
                activeHeadingId={activeHeadingId}
                onHeadingClick={handleHeadingClick}
                floating
              />
            </>
          )}
        </main>
        {tocOpen && !settings.tocFloating && (
          <TocPanel
            headings={headings}
            activeHeadingId={activeHeadingId}
            onHeadingClick={handleHeadingClick}
          />
        )}
      </div>
      <RestartButton isEditing={isEditing} />
      {isDragging && <DropOverlay />}
      {zoomContent && <ZoomModal content={zoomContent} onClose={handleZoomClose} />}
      {settingsOpen && (
        <SettingsDialog
          settings={settings}
          onChange={setSettings}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  );
}
