// Browser-facing profile export helpers. The pure CSV/XLS/row-building logic
// lives in ./exportProfilesCore.js and is shared with the CLI export
// (server/src/scripts/export-ready-profiles.js); this file adds the
// browser-only download + paste-parsing on top.

export {
  EXPORT_COLUMNS,
  buildExportRows,
  exportFileBaseName,
  normalizeFriends,
  rowsToCsv,
  rowsToXls,
} from "./exportProfilesCore.js";

export function downloadTextFile(filename, content, mime) {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Revoke on the next tick so the download has a chance to start.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

// Accepts a JSON array (["id", ...]), or comma / whitespace / newline
// separated ids, and returns a de-duped, order-preserving list of trimmed ids.
export function parseIdList(text) {
  const cleaned = String(text || "").replace(/[[\]"']/g, " ");
  const seen = new Set();
  const out = [];
  for (const token of cleaned.split(/[\s,]+/)) {
    const id = token.trim();
    if (id && !seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}
