# QuitPath

A small, no-nonsense quit-smoking app. No login, no backend, no tracking pixels,you open it, answer a few honest questions about your habit, and it builds you a plan. Everything lives in your browser's `localStorage`. If that sounds refreshingly boring for 2026, that's on purpose.

Live at: **[horizion.netlify.app](https://horizion.netlify.app)**

few screenshoots 

<img width="810" height="347" alt="Screenshot 2026-07-07 at 10 38 31" src="https://github.com/user-attachments/assets/2fe9b9bc-0d66-4b63-a51e-1fb4fd8dd56a" />
<img width="851" height="429" alt="Screenshot 2026-07-07 at 10 38 44" src="https://github.com/user-attachments/assets/74af3000-2ea2-4d95-8b43-07ab615d979f" />
<img width="820" height="541" alt="Screenshot 2026-07-07 at 10 38 53" src="https://github.com/user-attachments/assets/24474893-1706-4493-bb3c-59dc95061bda" />
<img width="785" height="408" alt="Screenshot 2026-07-07 at 10 38 58" src="https://github.com/user-attachments/assets/c923c16d-b1e2-407e-9dd0-4dfef87ba86c" />
<img width="863" height="593" alt="Screenshot 2026-07-07 at 10 39 02" src="https://github.com/user-attachments/assets/1893c24f-9ec7-4e7c-883e-4a2471c91bbe" />


## Why this exists

Most quit-smoking apps assume you smoke manufactured cigarettes out of a pack, and most of them want you to sign up before they'll tell you anything useful. Neither of those held up for what I wanted:

- Plenty of people roll their own, the math for cost, intake, and even the health caveats are genuinely different, so this app asks up front and branches accordingly instead of forcing a "cigarettes per pack" field on someone who's never bought a pack in their life.
- You shouldn't need an account to track something this personal. There's no server, so there's nothing to breach, sell, or lose access to if a company shuts down. The trade-off is real and I say so in the UI: your data doesn't sync across devices, and it disappears if you clear browser storage. That's the deal.
- "Quit today" and "quit in two weeks" are different problems. A cold-turkey plan and a tapering plan need different UI, different math, and different daily prompts — so the app asks when you want to quit and actually builds a different plan depending on the answer, instead of pretending one flow fits both.

## What it actually does

**Onboarding**, A short wizard, not a form wall:
1. Pick manufactured cigarettes or hand-rolled.
2. Enter the numbers that matter for your type (cigarettes/pack + pack cost, or grams/roll-up + pouch size + pouch cost). Everything gets normalized internally to a "cost per cigarette-equivalent" so the rest of the app doesn't care which type you picked.
3. Optional: years smoked, used to flavor the health-milestone framing (not used for anything alarming, just context).
4. The big one: **when do you want to quit?** Today, or a future date.
   - **Today** → cold turkey. The dashboard starts counting smoke-free days immediately.
   - **A future date** → the app builds a day-by-day step-down schedule, linearly reducing your daily target from your current baseline down to zero on quit day. You see the whole schedule, not just today's number.

**The dashboard** changes shape depending on where you are in the plan:
- **Still tapering**: days until quit date, today's cigarette target vs. baseline, a progress bar through the taper period, and the full schedule table so you're not surprised by tomorrow's number.
- **Post quit-date**: money saved, cigarettes avoided, hours reclaimed, and days smoke-free — all computed from your actual logged activity, not just an idealized "you smoked zero" assumption.

**Logging cigarettes**  This is the part that actually makes the numbers honest. There's a "log what you smoke" tally in *both* phases (taper and post-quit), not just a vague "I slipped" button after the fact. Log one and it:
- Counts against today's taper target and turns red if you go over it (no guilt-tripping copy, just an honest color change).
- After your quit date, subtracts from "cigarettes avoided" and "money saved" instead of pretending those slips didn't happen. If you've logged any, the app says so plainly and moves on , a slip isn't a restart, and the UI doesn't treat it like one.

There's also a one-tap "I had a craving — resisted" button, because celebrating the moments you *didn't* smoke is at least as important as logging the ones you did.

**Trigger tracking**  Not all cigarettes are the same, and treating a stress cigarette the same as a "smoked one out of habit while making coffee" cigarette makes for a worse plan. The dashboard has three logging entry points — **"I smoked one"**, **"I had a craving — resisted"**, and **"I delayed a craving"** — each opening a fast, chip-based flow instead of a form:

1. Tap what's going on (14 chips: stress, anxiety/panic, anger, sadness, after argument, boredom, habit/automatic, morning/waking, after meal, coffee/tea, alcohol/social, work break, before sleep, other).
2. Tap how strong the urge is, 1–10.
3. If you smoked, tap how long you delayed first (immediate / 5 / 10 / 20 min). If you delayed a craving, tap how long you delayed it (5 / 10 / 20 min), then say whether you ended up smoking anyway.
4. Optional one-line note, or skip it.

Each tap auto-advances to the next step, so the whole thing takes a few seconds, on purpose, because a stressed person mid-craving isn't going to fill out a form. Every trigger belongs to one of three groups that drive the rest of the plan:
- **Automatic** (habit, boredom, morning waking, phone-scrolling-style autopilot smoking) — low-awareness, usually the easiest to cut first.
- **Ritual** (meal, coffee/tea, work break, before sleep, alcohol/social) — tied to a routine, cut once automatic ones are down.
- **Emotional** (stress, anxiety/panic, anger, sadness, after argument, loneliness) — kept for later stages and paired with coping suggestions instead of just "don't."

Each log is tagged with an explicit outcome (`smoked` / `resisted` / `delayed`) so "delayed" cravings — the ones where willpower and a coping trick were actually exercised — show up as their own stat instead of being folded into "resisted" or ignored. After you save a log, the app shows a message that matches the outcome: "Logged. This is data, not failure." or "A slip does not restart your progress." for a smoked one, "Notice the trigger and continue." for a resisted one, "You delayed it — that still counts as progress." for a delayed one — plus a trigger-specific coping suggestion to try next time. Never "failed," "restart," or "you ruined your streak."

**Urge delay**  Two ways to use the delay tactic:
- **"▶ Start a 10-min delay timer"** — starts a live countdown banner (it survives a page reload). While it's running you can end it early with "Craving passed 🎉" or "I smoked anyway." When it ends, one way or another, the app asks whether the craving reduced and what helped (chips pulled from the same trigger-specific coping list), then logs it with a `delayed` outcome.
- **"⏳ I delayed a craving"** — for logging a delay after the fact (you didn't have the timer running, but you held off anyway): pick the trigger and intensity, how long you delayed, and whether you ended up smoking.

**Weekly trigger insights**  Once there's a week of logged data, a "Your week in triggers" card appears on the dashboard with: most common trigger, strongest craving trigger (highest average intensity), cravings resisted, cravings delayed, average craving intensity, average delay before smoking, automatic cigarettes reduced vs. the previous week, your best smoke-free time-of-day window, a "top triggers this week" bar breakdown, and a stacked automatic/ritual/emotional progress bar. The taper/status card also gets a "Focus next" note recommending which group to target based on plan stage and what you've actually logged (automatic first, then ritual, emotional last, replaced with coping actions rather than sudden cold turkey).

**Health milestones**  A standard, medically-sourced timeline (20 minutes → heart rate drops, 12 hours → CO clears, all the way out to 15 years → heart disease risk normalizes) that lights up progressively based on real elapsed time since your quit date.

**Motivational quotes**  One per day (deterministic, so it doesn't change if you reload), with a "new quote" button if you want a different one on demand. Short, non-cheesy, and there's a decent-sized pool so it doesn't repeat every week.

**Daily reminder**  Opt-in browser notification at a time you pick. I'm upfront in the settings copy about the real limitation here: this is a static site with no server, so there's no push infrastructure. The reminder only fires while the tab is open somewhere. If you want a reminder that survives a fully closed browser, that needs a backend, and this app deliberately doesn't have one.

**Learn page**  Withdrawal timeline, the "4 Ds" for handling a craving (delay, deep breathe, drink water, do something else), an honest section on how hand-rolled tobacco compares to manufactured cigarettes (people reliably underestimate their tobacco intake when rolling their own, and "no filter" is more common than people think), and a short note on what to do if you slip.

**Settings** Edit your habit numbers, or nuke everything and start over. One button, no confirmation dark patterns.

## Tech stack (or: the lack of one)

Plain HTML, CSS, and vanilla JS. No framework, no bundler, no `node_modules`. That's not a purity thing,it's that a form wizard, some date math, and localStorage reads/writes genuinely don't need React. If this app grows a backend or real accounts later, that's a different conversation. Right now, the entire app is a handful of files you can read top to bottom in fifteen minutes:

```
index.html    — all views (onboarding wizard, dashboard, learn, settings) plus an empty #modalRoot
                for the quick-log/urge-delay overlays, hidden/shown via [hidden]
style.css     — CSS custom properties for theming, dark mode via prefers-color-scheme,
                plus a validated categorical palette (--series-1..6) for trigger charts
app.js        — all logic: state, date math, trigger/coping data, quick-log modal,
                urge-delay timer, weekly analytics, rendering, event wiring
sw.js         — service worker: offline asset caching + notification click handling
manifest.json — PWA manifest so it's installable on a phone home screen
netlify.toml  — static publish config + security headers
```

Everything renders by rebuilding an HTML string and setting `.innerHTML` on a container, no virtual DOM, no diffing. For an app this size that's simpler to reason about than it sounds; the dashboard has maybe three distinct states and none of them need to preserve scroll position or input focus across re-renders.

### A couple of implementation details worth knowing about

- **Dates are handled in local time on purpose.** An early version used `toISOString().slice(0, 10)` to get "today," which quietly breaks near midnight in any timezone ahead of UTC — you'd get tomorrow's date labeled as today. Everything date-related now goes through `toLocalDateStr()`, which reads local `getFullYear/getMonth/getDate` instead of trusting `toISOString`. If you're adding new date logic, use that helper,don't reach for `toISOString()` for anything that needs to match what the user sees on their calendar.
- **Cigarette logs are timestamped events, not counters.** Each log entry has a timestamp, a legacy `type` (`cigarette` or `resisted`, with `slip` kept around for backward compatibility with earlier data), a boolean `smoked`, an explicit `outcome` (`smoked` / `resisted` / `delayed`), plus optional `trigger`, `intensity` (1–10), `delayMinutes`, and `note` fields. The current-day tally, the "since quit date" total, the recent-activity list, and the weekly trigger analytics are all just filters/aggregations over that one array. Older logs saved before trigger tracking existed simply have those fields `undefined`; `isDelayedOutcome()` in `app.js` falls back to inferring a `delayed` outcome from `delayMinutes` for logs saved before the explicit `outcome` field existed, so historical data isn't silently dropped from the new stats.
- **Trigger data lives in three places in `app.js`**: `TRIGGERS` (the 14 chip options and which group each belongs to), `COPING_SUGGESTIONS` (per-group replacement actions), and `GROUP_INFO` (label + description per group, used for the "Focus next" card). `triggerGroup()` is the one function that maps a trigger id to its group, if you add a trigger category, that's the only place you need to register it.
- **The urge-delay timer is persisted, not just in-memory.** `state.activeDelay` stores a `startedAt` timestamp, so a countdown survives a page reload or the tab being backgrounded, actual elapsed time is always recomputed from `Date.now()` rather than trusting a running `setInterval` tick count.
- **The service worker caches app shell assets for offline use**, and its `CACHE_NAME` is versioned. Bump it whenever you ship a change to `app.js`, `style.css`, or `index.html` — otherwise returning users can get served stale assets out of the cache instead of your update. This bit me during development: I shipped a color palette change and the old theme kept showing up until I bumped the cache name and force-cleared it.
- **The color palette is one block of CSS custom properties** at the top of `style.css` (`--primary`, `--success`, `--danger`, background/text/border tokens, both light and dark variants, plus `--series-1` through `--series-6` for the trigger/cigarette-type charts). The series colors were run through a colorblind-safety and contrast validator before picking them, if you add more chart categories, re-validate rather than eyeballing a new hue. If you want to reskin this, that block is the only place you need to touch, nothing else hardcodes a color.

## Running it locally

There's no build step, so any static file server works:

```bash
cd quit_app
python3 -m http.server 8934
# open http://localhost:8934
```

## Deploying

It's a static site with a `netlify.toml` already pointing at the repo root as the publish directory, so:

```bash
npx netlify-cli login        # one-time, opens a browser
npx netlify-cli deploy --prod
```

This repo is also connected to Netlify via GitHub (`eddieir/hope` → auto-deploys off `main`), so in practice: commit, push, and Netlify picks it up on its own. Worth remembering if you make local edits and wonder why the live site hasn't changed  **uncommitted or unpushed changes never reach production**, no matter how correct they look in a local preview. That's an easy trap to fall into with a project this small, because there's no CI failing loudly to remind you.

## Known limitations (stated plainly, not buried)

- **No cross-device sync.** Data is per-browser, per-device. Clearing site data deletes your history. This is a direct consequence of having no backend, and it's a deliberate trade-off, not an oversight.
- **Reminders don't survive a closed tab.** See above — real background push needs a server.
- **No accessibility audit has been done beyond basic semantic HTML.** It should mostly work with a screen reader (real `<label>`s, real `<button>`s), but nobody's gone through it with NVDA/VoiceOver line by line yet.
- **The taper schedule is a straight linear reduction.** Real quitting is rarely linear. It's a reasonable default, not a clinically validated tapering protocol, if you want a more forgiving curve (e.g. front-loaded or stepped), that's a `buildTaperSchedule()` change in `app.js` and nothing else.
- **Weekly trigger insights need a week of logging to be meaningful.** The analytics card only appears once you've logged at least one cigarette or resisted craving with a trigger attached, and stats like "automatic cigs reduced" compare against the *previous* 7 days, so they show `—` until there's two weeks of history to compare.
- **The "Focus next" recommendation is a heuristic, not a coaching algorithm.** It looks at plan stage (taper progress or post-quit) and which trigger groups you've actually logged, and suggests automatic → ritual → emotional in that order. It doesn't adapt to anything more sophisticated than that, and it never blocks or gates behaviour, it's a suggestion, not a rule.

## If you're picking this up cold

Read `app.js` start to finish before changing anything, it's a few hundred lines and there's no indirection to trace through. The onboarding wizard's step navigation (`stepStack`, `goToStep`) is the one part that looks more clever than it needs to; it's a tiny stack-based router because the wizard branches (cigarette vs. hand-rolled steps) and a flat "current step index" couldn't represent that cleanly. Everything else is about as straightforward as it looks.
