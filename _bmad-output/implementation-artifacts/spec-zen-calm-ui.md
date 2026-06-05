---
title: 'Zen Calm UI — dump isolation, muted sort, fade transitions'
type: 'feature'
created: '2026-06-05'
status: 'done'
route: 'one-shot'
---

## Intent

**Problem:** The app felt productive but not meditative — brain dump had visible chrome, saturated sort colors, snappy slide transitions, and a carousel onboarding that broke isolation on first launch.

**Approach:** Apply four targeted calm-mode improvements: isolated dump canvas (collapsed sidebar, fading chrome, quiet extract), muted dark-mode quadrant colors, cross-fade view transitions, and a single-line first-launch hint instead of onboarding carousel.

## Suggested Review Order

1. [Brain dump zen fade + extract button](../../src/views/braindump.ts) — typing timer, chrome fade, quiet extract
2. [Sidebar default + view transitions](../../src/main.ts) — collapsed default, auto-collapse on dump, cross-fade
3. [Calm tokens + zen styles](../../src/style.css) — muted quadrants, bd-zen, welcome pill, 400ms fade
4. [Welcome hint markup](../../index.html) — first-launch pill replaces carousel trigger
5. [Copy strings](../../src/i18n.ts) — bd-welcome EN/AR
