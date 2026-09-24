# RevBounce — manual QA checklist

Automated pass first: `node tests/run.mjs <baseUrl>` → expect **55/55**.
Then walk this list on `/test-site.html` (real page + snippet) and in the dashboard.

## A. Install & config
- [ ] `<script async src="/embed.js" data-site="…">` is the only markup added
- [ ] Page renders normally with the snippet (no layout shift, no console errors)
- [ ] Block `/embed.js` in an ad blocker → site still works, no visible error
- [ ] Wrong `data-site` → no pop, no error
- [ ] Load the page on a domain not in the allow-list → engine refuses to run
- [ ] Publish a change in the builder → live within 60 s **without** touching site code

## B. Triggers (§7.2)
- [ ] Desktop exit intent fires only after the load delay and only on a genuine upward exit
- [ ] Slow cursor drift to the top does **not** fire (velocity threshold)
- [ ] Idle fires after N seconds; any mouse/key/scroll/touch resets it
- [ ] Switch tabs while idle → timer pauses, resumes on return
- [ ] Mobile: one back press shows the pop, a second press navigates away
- [ ] In-app browser (Instagram/Facebook) → silently falls back to idle
- [ ] Device targeting respected (uncheck Mobile → nothing on a phone)

## C. Offer sequence (§7.3)
- [ ] 1–5 campaigns show in the configured order with all three kinds mixed
- [ ] **NO** advances to the next campaign; a campaign never repeats
- [ ] Disabled / capped / geo-ineligible / invalid-URL slots are skipped
- [ ] "1 of N" counter matches the eligible count
- [ ] Host & Post: YES expands the in-pop form, validates, submits once (button disables), advances on success
- [ ] Host & Post failure: form stays open, friendly error, retry works
- [ ] Link-Out / Feed: opens a new tab, original page stays usable, advances on return
- [ ] Popup blocked → "Click here to open the offer" fallback appears
- [ ] Final NO closes the pop; Close-on-Yes honoured when enabled
- [ ] ✕, overlay click and **Escape** always close — at every step

## D. Multi-tab, refresh, config (§7.4)
- [ ] Two tabs open → only one shows a pop
- [ ] Refresh mid-sequence → resumes at the same campaign
- [ ] Frequency blocks a reopen after close (default 1×/24 h)
- [ ] Publish a new version mid-session → current sequence finishes on the old version
- [ ] Disable a campaign after publish → `/public/click` returns `skipped`, engine advances

## E. Email Capture (§6)
- [ ] Invalid format rejected client-side and server-side
- [ ] Disposable domain rejected; MX check rejects a bogus domain
- [ ] Duplicate shows the configured "already subscribed" message (not an error)
- [ ] Success message shows; close-after-success honoured
- [ ] Record appears in **Email Records** with API + FTP status
- [ ] Kill the API endpoint → email still stored, marked failed, **Resend** works
- [ ] CSV export downloads with the filtered rows

## F. Dashboard (§5, §12)
- [ ] KPI cards show value, ▲/▼ % vs previous period and a sparkline
- [ ] Date range + Daily/Weekly/Monthly change the chart
- [ ] Top Performing Pops and Performance by Pop Type populate; row menus work
- [ ] Pops list: edit, duplicate, pause/resume, archive, get install code
- [ ] Builder: all 8 steps, live preview updates instantly, Desktop/Tablet/Mobile toggle
- [ ] Publish → version history → rollback creates a new version
- [ ] Reports: all 9 group-by views, sortable, paginated, CSV export, saved/scheduled reports
- [ ] Payouts: approve → mark paid (out-of-order blocked); statements download
- [ ] Admin: split editor, impersonation banner, fraud flags, feature flags, audit log
- [ ] Advertiser account sees only its own campaigns/reports
- [ ] Tablet width usable; mobile navigable; skeletons on load; toasts on every action

## G. Non-functional (§13)
- [ ] `/healthz` returns healthy with subsystem list
- [ ] `/docs` renders and `/api/openapi.json` validates
- [ ] `gzip -c embed.js | wc -c` < 40 KB
- [ ] Config responds well under 150 ms warm
- [ ] `POST /api/privacy {action:"delete"}` removes the subject's rows
- [ ] Consent off (`window.revbounceConsent=false`) → anonymous session-only id, no cookie
- [ ] Keyboard-only: pop is reachable, focus trapped, Escape closes

## H. Acceptance criteria
- [ ] A non-technical publisher can create and publish a pop end to end
- [ ] One snippet, no re-installation ever required
- [ ] Exit-intent and idle behave per settings; device targeting works
- [ ] Offer Pop holds 1–5 mixed-type campaigns in order; NO advances
- [ ] Host & Post opens in-pop and advances after success
- [ ] Link-Out/Feed opens a new tab, page stays usable
- [ ] Visitor can close at any time; frequency prevents repeats
- [ ] Email Capture works independently: validate → store → export → deliver with status
- [ ] All events appear in reports
- [ ] The pop never breaks the host website
