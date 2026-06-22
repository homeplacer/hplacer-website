# Deploying hplacer.com

The site is a **Next.js** app (server-rendered + a `/api/lead` route), so it needs
a host that runs Next.js — **not** GitHub Pages. Recommended: **Vercel**, with the
domain staying at **GoDaddy**.

## 1. Put it on Vercel (one time)
1. Go to **vercel.com** → sign in with the GitHub account (`homeplacer`).
2. **Add New → Project → Import** the `hplacer-website` repo.
3. Framework auto-detects as **Next.js**. Leave build settings default. Click **Deploy**.
   - You'll get a temporary URL like `hplacer-website.vercel.app` to preview.

## 2. Add the lead keys (so forms deliver)
In Vercel → Project → **Settings → Environment Variables**, add (see `.env.example`):
- `FUB_API_KEY` — Follow Up Boss API key (FUB → Admin → API)
- `RESEND_API_KEY`, `LEADS_TO`, `LEADS_FROM` — optional email copy (resend.com)

Redeploy after adding them. Until then the site still works; leads just log instead of delivering.

## 3. Point hplacer.com (GoDaddy → Vercel)
In Vercel → Project → **Settings → Domains**, add `hplacer.com` and `www.hplacer.com`.
Vercel shows you the exact records. They'll look like:

| Host | Type | Value |
|------|------|-------|
| `@`  | A     | `76.76.21.21` (Vercel shows the current IP) |
| `www`| CNAME | `cname.vercel-dns.com` |

Then in **GoDaddy → My Products → hplacer.com → DNS → Manage DNS**:
1. Edit the existing **A record** for `@` → set the value to Vercel's IP.
2. Edit/add the **CNAME** for `www` → `cname.vercel-dns.com`.
3. Save. SSL is automatic; the site goes live in ~15–60 min.

> Keep the domain registered at GoDaddy — you're only changing two DNS records, not transferring.

## Updating the site later
Every `git push` to `main` auto-builds and deploys on Vercel. (Local: edit → commit → push.)
