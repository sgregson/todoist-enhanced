/**
 * Addresses someone else wrote, checked before the page uses them.
 *
 * A comment's attachment is described by whoever posted the comment: the
 * description is sent with the comment (`note_add`), so any collaborator on a
 * shared project — or any other app they use — decides what `file_url` says.
 * React 18 puts a `javascript:` address into `href` as it is, so a link built
 * from one would run script on this page, where the Todoist token is kept.
 * And an `<img>` pointed at any host tells that host who opened the task, and
 * when. Both are closed here: only web addresses become links, and only
 * pictures Todoist itself serves are loaded without a click.
 */

/**
 * Where Todoist keeps uploaded files (`files.todoist.com`, in Doist's own
 * fixtures), and its other hosts. A picture anywhere else is shown as a file
 * chip: still one click away, never fetched just by opening the task.
 */
const TODOIST_HOST = /(^|\.)todoist\.com$/i;

const currentOrigin = (): string | undefined => globalThis.location?.origin;

function parse(value: unknown): URL | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    // No base: a relative address is not something a comment can point at.
    return new URL(value.trim());
  } catch {
    return null;
  }
}

/** A blob address this page made itself (a demo attachment), never another origin's. */
const ownBlob = (url: URL, origin: string | undefined): boolean =>
  url.protocol === 'blob:' && origin !== undefined && url.origin === origin;

/**
 * The address to link an attachment to, or null when it is not one a link
 * may carry: http(s), or a blob this page created. Everything else —
 * `javascript:`, `data:`, `vbscript:`, a relative path — is refused.
 */
export function attachmentHref(value: unknown, origin = currentOrigin()): string | null {
  const url = parse(value);
  if (!url) return null;
  if (url.protocol === 'https:' || url.protocol === 'http:' || ownBlob(url, origin)) return url.href;
  return null;
}

/**
 * The address to show an attachment's picture from, or null when the picture
 * should not be fetched until asked for: https on a Todoist host, or a blob
 * this page created.
 */
export function attachmentPreview(value: unknown, origin = currentOrigin()): string | null {
  const url = parse(value);
  if (!url) return null;
  if ((url.protocol === 'https:' && TODOIST_HOST.test(url.hostname)) || ownBlob(url, origin)) return url.href;
  return null;
}
