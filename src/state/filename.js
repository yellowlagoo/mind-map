/** Turn a board title into a safe download filename. */
export function filenameFromTitle(title) {
  const safe = (title || "map")
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  return `${safe || "map"}.json`;
}
