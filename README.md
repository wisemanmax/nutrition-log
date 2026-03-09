# 🥗 NutritionLog

> **Part of the [IRONLOG](https://ironlog.space) ecosystem**

A nutrition and macro tracking PWA. Part of the IRONLOG ecosystem.

## Live App

**[https://nutrition.ironlog.space](https://nutrition.ironlog.space)**

## Files

| File | Purpose |
|------|---------|
| `index.html` | Entire app — single-file PWA (React 18 + Recharts + Babel, no build step) |
| `manifest.json` | PWA install manifest — icons, theme color, display mode |
| `CNAME` | GitHub Pages custom domain config |
| `.nojekyll` | Disables Jekyll processing on GitHub Pages |

## Tech Stack

- **Frontend**: React 18 UMD, Recharts 2.12, Babel Standalone (in-browser JSX)
- **Storage**: localStorage — all data stays on device, nothing uploaded
- **Auth**: Shared `ironlog_session` cookie on `.ironlog.space` domain
- **Deployment**: GitHub Pages with custom subdomain

No build step. No Node required. Edit `index.html`, push, deployed.

## Deploy to GitHub Pages

```bash
# 1. Create a new repo on GitHub named: ironlog-nutrition
# 2. Push this folder
git init
git add .
git commit -m "initial deploy"
git remote add origin https://github.com/YOUR_USERNAME/ironlog-nutrition.git
git push -u origin main

# 3. GitHub repo → Settings → Pages → Source: main branch, root folder
# 4. Add a CNAME DNS record pointing to your GitHub Pages domain
```

## DNS Setup

In your domain registrar for `ironlog.space`:

| Type | Host | Value |
|------|------|-------|
| CNAME | `nutrition` | `YOUR_USERNAME.github.io` |

GitHub Pages auto-provisions HTTPS once DNS propagates (usually < 30 min).

## IRON Rank System

NutritionLog participates in the shared IRONLOG XP/rank system:
- Earn XP by logging consistently in this app
- Progress through 30 ranks: Bronze I → Immortal III
- Level-up celebration overlay fires on rank-up
- Daily Missions with app-specific objectives
- Light/dark theme toggle in Settings

## IRONLOG Ecosystem

| App | URL |
|-----|-----|
| IRONLOG | [ironlog.space](https://ironlog.space) |
| NutritionLog | [nutrition.ironlog.space](https://nutrition.ironlog.space) |
| TherapyLog | [therapylog.ironlog.space](https://therapylog.ironlog.space) |
| FinanceLog | [financelog.ironlog.space](https://financelog.ironlog.space) |
| ReminderLog | [reminderlog.ironlog.space](https://reminderlog.ironlog.space) |

## License

MIT