import { describe, expect, it } from 'vitest';
import { attachmentHref, attachmentPreview } from './urls';

const ORIGIN = 'https://tasks.example.com';

describe('attachmentHref', () => {
  it('keeps web addresses', () => {
    expect(attachmentHref('https://files.todoist.com/upload/a.pdf', ORIGIN)).toBe('https://files.todoist.com/upload/a.pdf');
    expect(attachmentHref('  http://example.com/a b  ', ORIGIN)).toBe('http://example.com/a%20b');
  });

  it('refuses addresses that can run script or carry content', () => {
    for (const value of [
      'javascript:alert(1)',
      'JaVaScRiPt:alert(1)',
      '\tjavascript:alert(1)',
      'java\nscript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'vbscript:msgbox(1)',
      'file:///etc/passwd',
    ]) {
      expect(attachmentHref(value, ORIGIN), value).toBeNull();
    }
  });

  it('refuses what is not an absolute address', () => {
    for (const value of ['', '   ', '/upload/a.pdf', 'a.pdf', '//evil.example/a', undefined, null, 42, {}]) {
      expect(attachmentHref(value, ORIGIN)).toBeNull();
    }
  });

  it('keeps a blob only when this page made it', () => {
    expect(attachmentHref(`blob:${ORIGIN}/0b6e`, ORIGIN)).toBe(`blob:${ORIGIN}/0b6e`);
    expect(attachmentHref('blob:https://evil.example/0b6e', ORIGIN)).toBeNull();
    expect(attachmentHref(`blob:${ORIGIN}/0b6e`, undefined)).toBeNull();
  });
});

describe('attachmentPreview', () => {
  it('loads pictures Todoist serves', () => {
    expect(attachmentPreview('https://files.todoist.com/upload/photo.png', ORIGIN)).toBe('https://files.todoist.com/upload/photo.png');
    expect(attachmentPreview('https://todoist.com/a.png', ORIGIN)).toBe('https://todoist.com/a.png');
  });

  it('does not fetch pictures from anywhere else', () => {
    for (const value of [
      'https://tracker.example/pixel.png',
      'https://files.todoist.com.evil.example/a.png',
      'https://eviltodoist.com/a.png',
      'https://user:pass@evil.example/@files.todoist.com/a.png',
      'http://files.todoist.com/upload/photo.png',
      'javascript:alert(1)',
      'data:image/svg+xml,<svg/>',
    ]) {
      expect(attachmentPreview(value, ORIGIN), value).toBeNull();
    }
  });

  it('loads a demo picture this page made', () => {
    expect(attachmentPreview(`blob:${ORIGIN}/0b6e`, ORIGIN)).toBe(`blob:${ORIGIN}/0b6e`);
    expect(attachmentPreview('blob:https://evil.example/0b6e', ORIGIN)).toBeNull();
  });
});
