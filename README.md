# New Home Sales Assistant

A personal, mobile-first command center for a residential new-home sales consultant. It uses a Robinhood-style portfolio view for the pipeline, an ESPN-style scoreboard and headlines for what needs attention today, and a playbook built on the "Executive AI Assistant for a Residential New Home Sales Consultant" instructions.

All data stays private in your browser (localStorage). Use **Playbook → Settings & Backup** to export or import a JSON backup.

## Open the app

- **Right now:** your private claude.ai link — https://claude.ai/artifact/9NtPLdKaBTw66XACWJFKLw (only you can open it unless you share it).
- **Your own web address:** deploy this repo on Netlify (see *Deploying* below), then on your phone open the site and choose **Add to Home Screen**.

Each place keeps its own copy of your data. Move data between them with **Playbook → Settings & Backup → Copy backup**, then paste it into the other copy's restore box.

## What's inside

| Tab | What it does |
| --- | --- |
| **Home** | Weighted pipeline value with a trend chart (1W–ALL), today's appointments as a scoreboard, stat strip, **Top Headlines** (overdue follow-ups, closing risks, genuine incentive deadlines, referral asks), follow-ups due, a starred watchlist and "Work smarter" tips. |
| **Buyers** | Pipeline standings by stage, search and filters (needs attention, move-in ready, build-to-order, under contract), likelihood-to-close score. |
| **Buyer page** | CRM summary (stage, likelihood, next follow-up, risks, outstanding tasks, recommended next action), stage tracker, qualification gaps with natural follow-up questions, a construction milestone timeline for build-to-order homes (only *confirmed* dates are shared), an activity log and a **Wrap-up** step after each meeting. Wrap-up produces the meeting summary, CRM note, action items as tasks, and a follow-up email or text. |
| **Write** | Buyer emails and texts for 11 situations (new lead → referral), internal messages to the PM, lender, title and others (objective / action / deadline / context), and meeting prep (objectives, questions, likely objections, matching homes, talking points, desired outcome). Drafts show a word count (emails under 250 words), flag every `[bracket]` item that needs confirming, and open straight in Mail or Messages. |
| **Agenda** | 7-day schedule with a **schedule check** (conflicts, travel buffers, prep time, follow-up blocks) plus tasks organized as Priority Tasks, Upcoming Deadlines, Buyer Follow-Ups, Internal Actions, Questions Needing Answers and Next Steps, with a copyable daily plan. |
| **Playbook** | Objection handling (acknowledge → explore → respond), discovery question bank, two-scenario payment calculator, inventory homes with side-by-side compare, a competitor intel matrix with verification dates, the follow-up cadence, research and decision brief builders, and settings. |

## Develop

```
npm install
npm run dev      # http://localhost:4321
npm run build
npm test         # util / scoring / templates / schedule-check tests
npm run check    # typecheck + tests
npm run build:standalone   # single HTML file (used for the claude.ai link)
```

### Reliability notes

- **Offline:** a service worker (`public/sw.js`) caches the app so it opens without signal once it has been loaded.
- **Data safety:** if saved data is ever unreadable, it's copied to a `homesales-assistant-v1-recovery-*` key instead of being overwritten. A warning appears if saving fails (storage full). Multiple open tabs stay in sync.
- **Privacy:** `netlify.toml` and `robots.txt` keep the site out of search engines and set security headers. Your buyer data never leaves the browser.
- **Navigation:** the phone/browser Back button moves between screens, and Escape closes sheets.

## Deploying

1. Merge this branch into `main`.
2. In Netlify: **Add new site → Import an existing project → GitHub →** pick this repo. The defaults (`npm run build`, publish `dist`) work as-is.
3. Open the Netlify URL on your phone → Share → **Add to Home Screen**.

Built with Astro + React. The app ships with sample data. To clear it, use **Playbook → Settings & Backup → Start fresh**.
