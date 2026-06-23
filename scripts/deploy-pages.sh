#!/bin/bash
# Build the Next static export and deploy it to GitHub Pages.
# Live URL: https://homeplacer.github.io/hplacer-website/
# Run from anywhere:  bash scripts/deploy-pages.sh
# (Deploys whatever is in your working tree. Commit your changes first if you
#  want the repo to match what's live.)
set -e
cd "$(dirname "$0")/.."

echo "==> building static export (root domain)"
rm -rf .next out
[ -d src/app/api ] && mv src/app/api /tmp/hp-api-stash   # API routes aren't allowed in static export
PAGES_BUILD=1 npx next build                              # no basePath — served at hplacer.com root
[ -d /tmp/hp-api-stash ] && mv /tmp/hp-api-stash src/app/api

echo "==> publishing out/ to gh-pages"
cd out
touch .nojekyll                         # keep GitHub Pages from dropping _next/
echo "hplacer.com" > CNAME              # GitHub Pages custom domain
rm -rf .git
git init -q && git checkout -q -b gh-pages
git add -A
git -c user.name="Home Placer" -c user.email="joe@forturro.com" commit -q -m "Deploy hplacer.com static site"
git push -q -f https://github.com/homeplacer/hplacer-website.git gh-pages
rm -rf .git

echo "==> done -> https://hplacer.com/ (rebuilds in ~1-2 min once DNS is live)"
