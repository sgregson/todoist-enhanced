import { describe, expect, it } from 'vitest';
import htaccess from '../public/.htaccess?raw';
import themeBoot from '../public/theme-boot.js?raw';
import indexHtml from '../index.html?raw';
import vercelJson from '../vercel.json?raw';
import { headersFile, META_CSP, NO_CACHE_FILES, SECURITY_HEADERS, withSecurityMeta } from '../security-headers';

/**
 * The security policy has one source (security-headers.ts) and two copies a
 * host reads as files of its own. These fail the moment a copy drifts.
 */

const apacheHeader = (name: string): string | undefined =>
  htaccess.match(new RegExp(`Header always set ${name} "([^"]*)"`))?.[1];

describe('the copies of the security policy', () => {
  it('Apache (.htaccess) sends exactly the headers in security-headers.ts', () => {
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      expect(apacheHeader(name), name).toBe(value);
    }
  });

  it('Vercel (vercel.json) sends exactly the headers in security-headers.ts', () => {
    const config = JSON.parse(vercelJson) as { headers: Array<{ source: string; headers: Array<{ key: string; value: string }> }> };
    const all = config.headers.find((rule) => rule.source === '/(.*)');
    expect(Object.fromEntries((all?.headers ?? []).map(({ key, value }) => [key, value]))).toEqual(SECURITY_HEADERS);
    const fresh = config.headers.find((rule) => rule.headers.some((h) => h.value.startsWith('no-cache')));
    for (const file of NO_CACHE_FILES) expect(fresh?.source, file).toContain(file.replace('.', '\\.'));
  });

  it('Netlify and Cloudflare Pages (_headers) get every header for every path', () => {
    const file = headersFile();
    const block = file.slice(file.indexOf('/*\n'), file.indexOf('\n\n', file.indexOf('/*\n')));
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) expect(block).toContain(`  ${name}: ${value}`);
    for (const name of NO_CACHE_FILES) expect(file).toContain(`/${name}\n  Cache-Control: no-cache`);
  });
});

describe('the <meta> policy', () => {
  it('is the header policy without what a <meta> tag cannot carry', () => {
    const header = SECURITY_HEADERS['Content-Security-Policy'].split('; ');
    expect(META_CSP.split('; ')).toEqual(header.filter((directive) => !directive.startsWith('frame-ancestors')));
    expect(META_CSP).toContain("script-src 'self'");
  });

  it('is written into index.html after the charset and before anything that loads', () => {
    const html = withSecurityMeta(indexHtml);
    const csp = html.indexOf('http-equiv="Content-Security-Policy"');
    expect(csp).toBeGreaterThan(html.indexOf('<meta charset'));
    expect(csp).toBeLessThan(html.indexOf('<script'));
    expect(csp).toBeLessThan(html.indexOf('<link'));
    expect(html).toContain(`content="${META_CSP}"`);
    expect(html).toContain('<meta name="referrer" content="strict-origin-when-cross-origin" />');
    expect(html.match(/http-equiv="Content-Security-Policy"/g)).toHaveLength(1);
  });

  it('refuses a page with no charset rather than leaving the policy out', () => {
    expect(() => withSecurityMeta('<html><head></head></html>')).toThrow(/charset/);
  });
});

describe('the frame guard in theme-boot.js', () => {
  function boot(framed: boolean, { leave = true } = {}) {
    const hidden: string[][] = [];
    const replaced: string[] = [];
    const page = { location: { href: 'https://tasks.example.com/' } } as Record<string, unknown>;
    const top = framed
      ? { location: { replace: (href: string) => { if (!leave) throw new Error('blocked'); replaced.push(href); } } }
      : page;
    Object.assign(page, { self: page, top, matchMedia: () => ({ matches: false }) });
    const document = { documentElement: { dataset: {}, style: { setProperty: (...args: string[]) => hidden.push(args) } } };
    new Function('window', 'document', 'localStorage', themeBoot)(page, document, { getItem: () => null });
    return { hidden, replaced };
  }

  it('leaves a top-level page alone', () => {
    expect(boot(false)).toEqual({ hidden: [], replaced: [] });
  });

  it('hides a framed copy and asks to take the whole window', () => {
    expect(boot(true)).toEqual({ hidden: [['display', 'none', 'important']], replaced: ['https://tasks.example.com/'] });
  });

  it('stays hidden when the frame cannot be left', () => {
    expect(boot(true, { leave: false })).toEqual({ hidden: [['display', 'none', 'important']], replaced: [] });
  });
});
