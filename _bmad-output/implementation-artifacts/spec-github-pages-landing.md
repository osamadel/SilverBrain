---
title: 'GitHub Pages static landing page'
type: 'feature'
created: '2026-06-05'
status: 'done'
route: 'one-shot'
---

# GitHub Pages static landing page

## Intent

**Problem:** SilverBrain has no public-facing landing page — visitors to the GitHub repo have no quick way to understand the product or download a build.

**Approach:** Add a self-contained static site under `site/` with the app's design language, deployed to GitHub Pages via a workflow on push to `main`.

## Suggested Review Order

**Landing page content & layout**

- Hero, workflow steps, and feature grid mirror the app's four-view flow
  [`index.html:1`](../../site/index.html#L1)

- Design tokens match the dark-canvas SilverBrain palette
  [`index.html:13`](../../site/index.html#L13)

**Deployment pipeline**

- Workflow deploys only `site/` — avoids serving the Tauri app shell
  [`static.yml:1`](../../.github/workflows/static.yml#L1)

- `.nojekyll` disables Jekyll processing for raw static assets
  [`site/.nojekyll`](../../site/.nojekyll)

**Bundled assets**

- Pixel logo and four stitch mockup screenshots ship with the page
  [`site/assets/`](../../site/assets/)
