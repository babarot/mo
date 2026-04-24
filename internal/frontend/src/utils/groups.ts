import type { Group } from "../hooks/useApi";

export function allFileIds(groups: Group[]): Set<string> {
  const ids = new Set<string>();
  for (const g of groups) {
    for (const f of g.files) {
      ids.add(f.id);
    }
  }
  return ids;
}

export function parseGroupFromPath(pathname: string): string {
  const path = pathname.replace(/^\//, "").replace(/\/$/, "");
  return path || "default";
}

export function groupToPath(groupName: string): string {
  return groupName === "default" ? "/" : `/${groupName}`;
}

export function buildFileUrl(groupName: string, fileId: string): string {
  return `${groupToPath(groupName)}?file=${fileId}`;
}

export function parseFileIdFromSearch(search: string): string | null {
  const params = new URLSearchParams(search);
  const raw = params.get("file");
  if (raw == null || raw === "") return null;
  return raw;
}

// parseHomePathFromPath returns the home-relative portion of a /~/... URL,
// or null if the URL does not use the /~/ prefix. The prefix is reserved so
// /~/foo never collides with a group named "~/foo" because callers evaluate
// this before parseGroupFromPath.
export function parseHomePathFromPath(pathname: string): string | null {
  if (!pathname.startsWith("/~/")) return null;
  const rest = pathname.slice(3);
  if (rest === "") return null;
  return rest;
}

// toHomePathUrl builds a /~/... pathname for an absolute file path living
// under homeDir. Returns null when the file is outside homeDir, when homeDir
// is empty (feature disabled), or when inputs look malformed. The caller is
// responsible for deciding what to do when the result is null (usually: leave
// the current URL as-is).
export function toHomePathUrl(absPath: string, homeDir: string): string | null {
  if (!homeDir || !absPath) return null;
  const prefix = homeDir.endsWith("/") ? homeDir : homeDir + "/";
  if (absPath === homeDir) return "/~/";
  if (!absPath.startsWith(prefix)) return null;
  return `/~/${absPath.slice(prefix.length)}`;
}
