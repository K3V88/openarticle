# OpenArticle validation

Checked on 18 November 2026 using an isolated Chromium profile. The user's everyday Chrome profile was not modified.

| Check | Result |
| --- | --- |
| TypeScript and production build | Pass |
| Unit and security tests | 25 pass |
| Actual Chrome toolbar popup | 9 browser tests pass |
| Production permissions | Exactly activeTab, scripting, storage; no host permissions |
| Public article | Reader works; hidden draft text is excluded; source is unchanged |
| Subscription messages, restricted metadata, subscription overlay, incomplete text | Reader stays disabled |
| Unknown page | Unknown; reader disabled |
| Heading and image preservation | Verified with local public article; image requests deferred until consent |
| Reader controls | Theme, A+, A−, and reading progress checked in Chromium |
| Search and original links | Open the expected new tabs; search terms correctly encoded; candidates remain unverified |
| Live NASA article | Pass: HTTP 200; 16 extracted paragraphs; reader controls work |
| Live authorized syndicated article | Pass: HTTP 200; 32 paragraphs and 3 subheadings; reader controls work |

The regression browser suite triggers the actual extension toolbar action using Chrome DevTools. It loads the production manifest unchanged and verifies that no host origins were granted. The previous temporary-localhost-permission shortcut has been removed. Regression search responses are mocked; no availability assertion is inferred from a search hit.

## Live pages checked

- [NASA: The International Space Station Marks 25 Years of Continuous Human Presence](https://www.nasa.gov/centers-and-facilities/johnson/the-international-space-station-marks-25-years-of-continuous-human-presence/)
- [UNSW: We must prepare entire cities for extreme heat. Our new study reveals how](https://www.unsw.edu.au/newsroom/news/2026/10/we-must-prepare-entire-cities-for-extreme-heat-our-new-study-reveals-how)

The UNSW page explicitly identifies its Creative Commons republication from The Conversation and links to the [original article](https://theconversation.com/we-must-prepare-entire-cities-for-extreme-heat-our-new-study-reveals-how-290858). That publisher-provided statement supports using it as an authorized public-copy test. It does not verify unrelated search results or grant OpenArticle any subscription entitlement.

The UNSW cookie dialog initially caused conservative reader blocking. The live test used the site's normal **Accept only essential** button before retrying. No overlay was deleted or access control changed. The live check also exposed a clipping false positive caused by accessibility labels and related-story headings. Detection now checks paragraph content within the selected article and its containing elements; regression tests still verify that genuinely clipped article text is blocked.

The two live pages yielded no reader images; image preservation and successful loading were verified separately with the local fixture. Phys.org returned HTTP 400 during an exploratory request and was not treated as a successful live test. No attempt was made to bypass that response.

Raw machine-readable results and reader screenshots are in `artifacts/live/` after `npm run test:live`. These artifacts are local and gitignored.

## Reproduce

```sh
npm ci
npm run check
npx playwright install chromium
npm run test:browser
npm run test:live
npm run demo
```

For a visible test browser, use `OPENARTICLE_HEADED=1 npm run test:browser`. The test browser closes automatically when the tests finish. Live tests need internet access and are separate from deterministic regression tests.

## Try it in your own Chrome

1. Open `chrome://extensions`, enable **Developer mode**, click **Load unpacked**, and choose the project's `dist` folder. If already loaded, click **Reload** on its extension card.
2. Pin OpenArticle in Chrome's Extensions menu.
3. With `npm run demo` running, open **http://127.0.0.1:8000/**.
4. Click **Public article**, then click the OpenArticle toolbar icon. Expect **Free article** with **Read Article** enabled.
5. Open the reader and try the font, theme, images, and progress controls.
6. Return to the test index and try subscription, incomplete, and unknown pages. Compare against the expected status table.
7. Click **Find Free Version** on a real article and choose a search link. Google may show its own consent page or service limits. Check each result's full text and publisher authorization yourself.

Installing and pinning in your personal Chrome profile is the remaining user-side step. Automated testing has already covered the toolbar permission flow in a separate browser. Detection remains heuristic; a pass on these pages is not a guarantee for every publisher.
