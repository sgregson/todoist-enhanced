/**
 * What the page may load and where it may talk to, in one place.
 *
 * The Todoist token sits in this origin's storage, and the app renders
 * descriptions and comments other people wrote. The Markdown renderer escapes
 * all of it, but if anything ever slipped through, this policy is what stops
 * it from running a script.
 *
 *   script-src   Only this site's own files. No inline script anywhere:
 *                the theme boot script is a file (theme-boot.js) for that.
 *                This is the directive that guards the token.
 *   style-src    The stylesheet, plus inline styles: React sets project
 *                colours, the custom accent and the swipe offset inline.
 *   connect-src  This site and the Todoist API: fetch and XHR reach nothing
 *                else. (A script that did run could still leak through an
 *                image address, since img-src is open — which is why
 *                script-src matters most.)
 *   img-src      Avatars and workspace logos come from Todoist on hosts that
 *                are not documented, so any HTTPS image is allowed. Comment
 *                attachments are narrowed in the app instead
 *                (src/domain/urls.ts): only Todoist's own pictures load
 *                without a click.
 *
 * Every host gets the same policy, however it can carry it:
 *
 *   Apache            public/.htaccess, as response headers.
 *   Vercel            vercel.json, as response headers.
 *   Netlify,
 *   Cloudflare Pages  `_headers`, written into the build by vite.config.ts.
 *   GitHub Pages, or  A <meta> tag the build puts at the top of index.html,
 *   anything else     present on every host. A <meta> policy cannot say
 *                     frame-ancestors, so public/theme-boot.js refuses to
 *                     show the app inside another site's frame instead.
 *
 * The first two are files of their own; src/securityHeaders.test.ts fails
 * when either drifts from this one.
 */

const CSP_DIRECTIVES = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "connect-src 'self' https://api.todoist.com",
  "img-src 'self' data: blob: https:",
  "font-src 'self'",
  "manifest-src 'self'",
  "worker-src 'self'",
  "base-uri 'self'",
  "frame-src https://tally.so",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
] as const;

/** Directives a policy delivered in a <meta> tag may not carry: browsers ignore them there and log an error. */
const HEADER_ONLY = new Set(['frame-ancestors', 'report-uri', 'report-to', 'sandbox']);

export const SECURITY_HEADERS = {
  'Content-Security-Policy': CSP_DIRECTIVES.join('; '),
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
} as const;

/** The same policy, minus what a <meta> tag cannot say. */
export const META_CSP = CSP_DIRECTIVES
  .filter((directive) => !HEADER_ONLY.has(directive.split(' ')[0]))
  .join('; ');

/**
 * Files that must never be served from a cache, or a new build sits behind
 * the old one: the service worker, and the theme boot script, which has no
 * hash in its name. Everything under assets/ is hashed and kept forever.
 */
export const NO_CACHE_FILES = ['sw.js', 'registerSW.js', 'theme-boot.js', 'manifest.webmanifest'] as const;

const CHARSET = /<meta\s+charset=[^>]*>/i;

/**
 * index.html with the policy written into it, straight after the charset and
 * before anything that could load or run — a <meta> policy only governs what
 * comes after it in the document.
 */
export function withSecurityMeta(html: string): string {
  if (!CHARSET.test(html)) throw new Error('index.html has no <meta charset>: nowhere to put the security policy.');
  const tags = [
    `<meta http-equiv="Content-Security-Policy" content="${META_CSP}" />`,
    `<meta name="referrer" content="${SECURITY_HEADERS['Referrer-Policy']}" />`,
  ];
  return html.replace(CHARSET, (charset) => [charset, ...tags].join('\n    '));
}

/** The `_headers` file Netlify and Cloudflare Pages read from the build. */
export function headersFile(): string {
  const all = Object.entries(SECURITY_HEADERS).map(([name, value]) => `  ${name}: ${value}`);
  const fresh = NO_CACHE_FILES.map((file) => `/${file}\n  Cache-Control: no-cache, must-revalidate`);
  return [
    '# Written by the build from security-headers.ts. Netlify and Cloudflare Pages',
    '# read this file; other hosts serve it as a plain file and ignore it.',
    '/*',
    ...all,
    '',
    ...fresh.flatMap((block) => [block, '']),
    '/assets/*',
    '  Cache-Control: public, max-age=31536000, immutable',
    '',
  ].join('\n');
}
