# Uploading a build

The build is a static site: `npm run build` puts it in `dist/`, and any host
that serves files will do. What follows is the part that is easy to get wrong.

Upload the **whole** of `dist/`, `assets/` and the dotfile included. Every
other file sits at the root, which is deliberate: the icons used to live in
`dist/icons/`, that folder was dropped by an upload twice, and the second
failure left a directory on the server that could not be read into or
repaired by re-uploading. A manifest whose icons all 404 fails the browser's
installability check silently — the app looks and works perfectly, it simply
stops offering to install and the installed copy has no icon of its own.

Two things to check after an upload:

```bash
curl -o /dev/null -w '%{http_code}\n' https://<host>/icon-192.png   # 200
curl -o /dev/null -w '%{content_type}\n' https://<host>/manifest.webmanifest
curl -s https://<host>/oauth/client.json | head -c 40                     # {"client_id"…
curl -sI https://<host>/ | grep -i content-security-policy
```

The second should say `application/manifest+json`. It comes from `.htaccess`,
which ships in `dist/` — a dotfile, so a client set to hide them will skip it.

The third is what "Continue with Todoist" depends on: Todoist fetches that
file to identify the app. The build writes it for `PUBLIC_URL`, the official
site by default; a copy hosted anywhere else must be built with
`PUBLIC_URL=https://<host>/ npm run build` (see "Self-hosting" in the README),
and the file's `client_id` should then start with that address. If it answers with the app's own page instead, the
`oauth/` folder was not uploaded and Todoist replies `invalid_client`. The
fourth checks that the host sends the security headers (see below).

## The security policy on each host

The Todoist token is kept in the browser, so the Content-Security-Policy is
what stands between a slip in rendering and a stolen token. It is defined
once, in `security-headers.ts`, and every build carries it in two forms:

- a `<meta http-equiv="Content-Security-Policy">` tag at the top of
  `index.html`, which works on any host, and
- a `_headers` file in `dist/`.

A `<meta>` policy cannot say `frame-ancestors`, so `theme-boot.js` also hides
the app whenever it is loaded inside another site's frame. Where the host can
send real headers, it should, because only a header stops the frame outright:

| Host | Headers come from | What to do |
| --- | --- | --- |
| Apache | `public/.htaccess`, shipped in `dist/` | Upload the dotfile too. |
| Vercel | `vercel.json` at the repository root | Import the repository; set `PUBLIC_URL` in the project's environment variables. |
| Netlify, Cloudflare Pages | `dist/_headers`, written by the build | Nothing; set `PUBLIC_URL` for the build. |
| GitHub Pages | none — Pages cannot set headers | `.github/workflows/pages.yml` builds and deploys; the `<meta>` policy and the frame guard cover it. |

`.htaccess` and `vercel.json` are copies of the policy, and
`src/securityHeaders.test.ts` fails as soon as either disagrees with
`security-headers.ts`.

On a host with headers, the fourth command above prints the policy. On
GitHub Pages it prints nothing; check the page instead:

```bash
curl -s https://<host>/ | grep -o 'http-equiv="Content-Security-Policy"'
```

## GitHub Pages

`.github/workflows/pages.yml` runs the unit tests, builds with `PUBLIC_URL`
set to the repository's Pages address (or a custom domain, if one is
configured, or the `PUBLIC_URL` repository variable when set), and deploys
`dist/`. Once per repository:

1. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
2. On a fork, open the **Actions** tab once and enable workflows; GitHub
   keeps them off in a new fork.
3. Push to `main`, or run the workflow from the Actions tab.
