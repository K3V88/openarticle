# OpenArticle

A Manifest V3 Chrome extension for reading available articles and discovering legitimate public copies. No backend, analytics, credentials, crawler impersonation, network interception, or subscription bypass.

## Install in Chrome

1. Install Node.js 22 or newer and npm.
2. In this project directory, run `npm ci`.
3. Run `npm run check` to type-check, run local automated tests, and generate the extension.
4. Open `chrome://extensions` in Chrome.
5. Enable **Developer mode** at the top right.
6. Click **Load unpacked** and select this project's **dist** directory.
7. Pin OpenArticle from Chrome's Extensions menu.
8. Open an HTTP/HTTPS news article, click OpenArticle, then choose **Read Article** or **Find Free Version**.

After changing source files, run `npm run build` and click **Reload** on the extension card. `src/*.ts` compiles into the requested `popup.js`, `content.js`, and `reader.js` files inside `dist/`. Load `dist/`, not the source directory. No background worker is necessary.

## How it works

Clicking the toolbar action grants temporary access to the current tab. The popup injects a local analysis script into the main frame only. No pages are scanned in the background.

- **Free article:** substantial article text, no detected restriction signals. This is a heuristic, not verification of entitlement or guaranteed complete text.
- **Possible soft paywall:** subscription/sign-in messages, clipping, or a short preview. Reader mode is disabled.
- **Hard paywall:** restricted-access metadata or a visible subscription gate. Reader mode is disabled.
- **Unknown:** no recognizable article body. Reader mode is disabled.

Detection examines visible messages, article length, subscription overlays, JSON-LD `isAccessibleForFree`, and common access metadata. A short free story may be marked as a possible paywall. Unfamiliar paywalls, other languages, shadow DOM, frames, dynamic pages, and incomplete text may escape detection. Reopen the popup after a page finishes loading or after signing in. The extension cannot determine subscription entitlements. Even an authorized subscriber may be blocked when restriction indicators remain; use the original site in that case.

**Read Article** rechecks the page, clones its currently rendered DOM, excludes hidden content and unrelated elements, then uses Mozilla Readability. It does not use article text embedded in JSON, fetch alternate endpoints, remove live overlays, change cookies, reveal hidden text, or modify the source page. DOMPurify sanitizes the extracted HTML, and links are restricted to HTTP/HTTPS. Article images are preserved but load only when you click **Load article images**; their hosts receive ordinary image requests without a referrer. Dark mode, font controls, and progress are provided. Preferences are confined to the current view.

**Find Free Version** offers explicit Google queries for the exact title, publisher versions, and syndicated/republication candidates. Clicking a query opens a search tab and sends that query to Google under Google's policies. OpenArticle does not fetch, scrape, rank, or verify results, and never labels candidates as verified free. Check that the result is the same full article, that the publisher authorizes access or republication, and that no subscription is needed. Fictional syndicated test content is clearly labeled as such.

## Permissions and privacy

- `activeTab`: temporarily inspect the tab where you clicked the extension.
- `scripting`: run the bundled detector/extractor in that tab.
- `storage`: transfer one article to the reader using `chrome.storage.session` (memory, not sync or disk-backed article storage).

No host permissions, history, cookies, credentials, paid API access, tracking, remote scripts, or automatic web requests. Opening the popup reads only the current page. Reader transfers use random identifiers, expire after five minutes, and are removed on consumption. Abandoned transfers are cleared on a subsequent popup opening after expiry and all session data is cleared when Chrome ends the extension session. Reloading a consumed reader shows an expiry message: reopen it from the popup. Article content is never uploaded. Search queries and opt-in image loading are the only extension-directed external traffic.

Chrome internal pages, the Chrome Web Store, PDFs without normal article DOM, and local file URLs are unsupported. Browser-level page restrictions can prevent script injection and are reported in the popup.

## Tests

Validated: TypeScript checks, 25 unit/security tests, and 9 Chromium tests of the real toolbar popup pass. Live reader checks also pass on a public NASA article and an authorized UNSW republication from The Conversation. See [TESTING.md](TESTING.md) for the checked pages, evidence, and limitations.

```sh
npm run check                  # TypeScript, node tests, production build
npx playwright install chromium
npm run test:browser           # Actual toolbar popup, unchanged manifest
npm run test:live              # Public NASA + authorized UNSW republication
npm run demo                   # Local test page at http://127.0.0.1:8000/
```

Unit tests exercise public articles, subscription overlays/messages, publisher metadata, incomplete text, fictional syndicated articles, unknown pages, hidden content, clipping, extraction immutability, sanitization, and manifest permissions. Browser tests verify the built extension's popup, reader, image consent, controls, search links, and blocked reading against a local HTTP server. The test harness loads the exact shipped manifest and invokes Chrome's actual toolbar action through DevTools. It verifies activeTab without adding host permissions. It also checks both source links and a real new search tab; the Google response is mocked in regression tests for reproducibility. Browser automation uses the current Playwright Chromium build with the Extensions DevTools domain, even though the extension itself supports Chrome 102 and newer.

For manual testing:

```sh
npm run demo
```

Open **http://127.0.0.1:8000/** for clickable tests and expected results. You can also visit `http://127.0.0.1:8000/tests/fixtures/public.html`, `subscription.html`, `metadata.html`, `subscription-message.html`, `incomplete.html`, and `syndicated.html`. Open the extension on each. Public/syndicated pages should offer the reader; restriction/preview fixtures should disable it. Compare the original page before and after. On a real public news site, check extracted headings, images, source links, theme, font controls, and progress. Verify syndicated search results yourself; the extension makes no availability claim.

The live check confirms that those two specific articles render successfully and that UNSW explicitly credits a Creative Commons republication license. This does not establish universal publisher compatibility or verify future search results. Live checks need internet access and may fail when publishers change their pages or show a consent dialog. `npm run test:live` chooses only essential cookies through UNSW’s normal consent button; it never removes an overlay. Raw live reports and reader screenshots are saved locally under `artifacts/live/`.

## Project layout

- `manifest.json`, `popup.html/.css`, `reader.html/.css`: extension shell.
- `src/article.ts`: detector and visible-DOM extraction.
- `src/content.ts`: isolated-world entry point.
- `src/popup.ts`: current-tab UI and user-initiated search.
- `src/reader.ts`, `src/sanitize.ts`: reader and sanitization.
- `build.mjs`: bundles dependencies locally to `dist/`.
- `tests/`: automated checks, real-toolbar test helper, and mock pages.
- `scripts/demo.mjs`, `scripts/test-live.mjs`: local fixture server and live smoke tests.
- `TESTING.md`: validation results and the remaining check in your own Chrome profile.
- `package-lock.json`: reproducible dependency versions.
- `THIRD_PARTY_NOTICES.md`, `licenses/`: bundled dependency licenses.

Reference documentation: [Chrome activeTab](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab), [Chrome scripting](https://developer.chrome.com/docs/extensions/reference/api/scripting), [Mozilla Readability](https://github.com/mozilla/readability), and [DOMPurify](https://github.com/cure53/DOMPurify).

## Inspect a publisher access problem

Run `npm run inspect:access -- 'https://publisher.example/article'` to record the public HTTP status, a small allowlist of response headers, visible gate counts, restricted-metadata presence, and the extension's classification. The result is saved locally to `artifacts/access/report.json`. This uses an isolated, signed-out browser and does not extract article text or expose hidden content. It does not modify publisher access controls.

A diagnostic run on the supplied Telegraaf article returned **HTTP 403**, a `server: cloudflare` response header, and a Cloudflare block-page title. No article element or restricted JSON-LD was present in that response; the extension classified it as **Unknown**. This is evidence of a Cloudflare-served access block in the test environment, not an explanation of Telegraaf's subscription enforcement. The **Hard paywall** result in your own browser may come from a different page response. In OpenArticle, that label means restricted publisher metadata or a visible recognized subscription gate was detected; it does not prove that the content is enforced on the server.

Append `--extract` to the inspection command to also invoke OpenArticle's existing guarded text extractor. The report records success/refusal and character counts without storing article text. On the supplied Telegraaf URL, the extraction attempt returned zero characters because the response was a Cloudflare 403 page and the reader access check refused extraction.
