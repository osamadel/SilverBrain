---
name: SilverBrain
colors:
  surface: '#131316'
  surface-dim: '#131316'
  surface-bright: '#39393c'
  surface-container-lowest: '#0e0e11'
  surface-container-low: '#1c1b1f'
  surface-container: '#201f23'
  surface-container-high: '#2a292d'
  surface-container-highest: '#353438'
  on-surface: '#e5e1e6'
  on-surface-variant: '#c6c5d5'
  inverse-surface: '#e5e1e6'
  inverse-on-surface: '#313034'
  outline: '#908f9e'
  outline-variant: '#454652'
  surface-tint: '#bdc2ff'
  primary: '#bdc2ff'
  on-primary: '#121f8b'
  primary-container: '#5e6ad2'
  on-primary-container: '#fdfaff'
  inverse-primary: '#4854bb'
  secondary: '#c5c7c7'
  on-secondary: '#2e3131'
  secondary-container: '#47494a'
  on-secondary-container: '#b7b9b9'
  tertiary: '#ffb867'
  on-tertiary: '#482900'
  tertiary-container: '#a56500'
  on-tertiary-container: '#fffaf8'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#dfe0ff'
  primary-fixed-dim: '#bdc2ff'
  on-primary-fixed: '#000965'
  on-primary-fixed-variant: '#2e3aa2'
  secondary-fixed: '#e1e3e3'
  secondary-fixed-dim: '#c5c7c7'
  on-secondary-fixed: '#191c1c'
  on-secondary-fixed-variant: '#454747'
  tertiary-fixed: '#ffddbb'
  tertiary-fixed-dim: '#ffb867'
  on-tertiary-fixed: '#2b1700'
  on-tertiary-fixed-variant: '#673d00'
  background: '#131316'
  on-background: '#e5e1e6'
  surface-variant: '#353438'
  surface-1: '#16171b'
  surface-2: '#23252a'
  surface-3: '#2c2e35'
  surface-4: '#3c3f4a'
  hairline: '#23252a'
  hairline-strong: '#36393f'
  primary-hover: '#828fff'
  primary-focus: '#5e69d1'
  ink-muted: '#d0d6e0'
  ink-subtle: '#8a8f98'
  ink-tertiary: '#62666d'
  eisenhower-do: '#ff4d4d'
  eisenhower-schedule: '#4d79ff'
  eisenhower-delegate: '#27a644'
  eisenhower-eliminate: '#62666d'
typography:
  display-xl:
    fontFamily: Geist Sans
    fontSize: 80px
    fontWeight: '600'
    lineHeight: '1.05'
    letterSpacing: -3.0px
  display-lg:
    fontFamily: Geist Sans
    fontSize: 56px
    fontWeight: '600'
    lineHeight: '1.10'
    letterSpacing: -1.8px
  display-md:
    fontFamily: Geist Sans
    fontSize: 40px
    fontWeight: '600'
    lineHeight: '1.15'
    letterSpacing: -1.0px
  headline:
    fontFamily: Geist Sans
    fontSize: 28px
    fontWeight: '600'
    lineHeight: '1.20'
    letterSpacing: -0.6px
  card-title:
    fontFamily: Inter
    fontSize: 22px
    fontWeight: '500'
    lineHeight: '1.25'
    letterSpacing: -0.4px
  subhead:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '400'
    lineHeight: '1.40'
    letterSpacing: -0.2px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.50'
    letterSpacing: -0.1px
  body:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.50'
    letterSpacing: -0.05px
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.50'
    letterSpacing: '0'
  button:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: '1.20'
    letterSpacing: '0'
  eyebrow:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '500'
    lineHeight: '1.30'
    letterSpacing: 0.4px
  caption:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: '1.40'
    letterSpacing: '0'
  mono:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '400'
    lineHeight: '1.50'
    letterSpacing: '0'
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  xxs: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 32px
  xxl: 48px
  section: 96px
  gutter: 24px
---

## Brand & Style

The design system embodies a **Minimalist / Corporate Modern** aesthetic tailored for high-output productivity. It is defined by a "dark-canvas" philosophy where depth is communicated through a four-step surface ladder rather than atmospheric shadows. 

The brand personality is disciplined, technical, and high-fidelity. It aims to evoke a sense of "flow state"—calm, focused, and professional. By utilizing a near-black foundation with a single lavender-blue chromatic accent, the interface recedes to let user content (tasks, timers, and data) become the protagonist. This is a tool for power users who value density, precision, and a distraction-free environment.

## Colors

The color system is built on a strict **Dark Mode** foundation. 

- **Canvas:** The anchor of the system is a deep, faint-blue black (`#010102`).
- **Surface Ladder:** Hierarchy is managed through four levels of gray, each progressively lighter. Use these levels to "lift" content—cards sit on Surface 1, while nested elements or active states move up to Surface 2 or 3.
- **Accents:** Lavender-blue is reserved strictly for primary actions, the brand mark, and focus states. 
- **Semantic (Eisenhower):** These specific hues are reserved for task prioritization. They should appear as small indicators (pills or 2px borders) to maintain the minimalist aesthetic without overwhelming the dark canvas.
- **Hairlines:** All borders should be 1px "hairlines." Avoid thick strokes or soft shadows.

## Typography

The typography system relies on **Geist Sans** for high-impact headlines and **Inter** for functional UI and body text. 

- **Headings:** Must utilize aggressive negative letter-spacing as they scale up. This creates a "tight," technical feel characteristic of high-end productivity tools.
- **Eyebrows:** Use small-caps or medium weights with positive letter-spacing to provide clear taxonomic contrast against the tight headings.
- **Mono:** **JetBrains Mono** is reserved for metadata, status IDs, and the Pomodoro timer display to evoke a "utility" or "instrumentation" feel.
- **Accessibility:** For mobile breakpoints, `display-xl` should scale down to approximately 36px while maintaining its weight.

## Layout & Spacing

This design system uses a **Fixed Grid** philosophy for desktop, centered within a 1280px container.

- **Rhythm:** A 4px base unit governs all dimensions. Card interior padding is standardized at `lg` (24px) to ensure density without clutter.
- **Grid Model:** A 12-column system is used. Tasks and Eisenhower quadrants typically span 3 or 6 columns. 
- **Density:** The layout should feel "dense" and product-focused. Maximize the use of the 1280px container; avoid excessive margins that push content into a narrow center column.
- **Vertical Spacing:** Use `section` (96px) to separate major functional areas (e.g., Eisenhower Matrix vs. Pomodoro Dashboard).

## Elevation & Depth

Depth is achieved through **Tonal Layers** and **Hairline Outlines**. Shadows are almost entirely avoided, except for rare, high-z-index elements like dropdown menus which may use a subtle, 10% opacity black shadow.

- **Level 0:** The Canvas (`#010102`). Default for background.
- **Level 1:** Surface 1 + 1px Hairline. Standard for cards, quadrants, and panels.
- **Level 2:** Surface 2 + 1px Hairline Strong. Used for hovered cards or the "currently active" quadrant.
- **Level 3:** Surface 3. Used for sub-navigation, popovers, or floating timers.
- **Interaction:** On hover, elements should "lift" one step up the surface ladder (e.g., Surface 1 transitions to Surface 2).

## Shapes

The shape language is structured to feel modern but precise. 

- **Standard (8px):** All buttons, inputs, and small task indicators.
- **Large (12px):** Primary task cards and quadrants in the Eisenhower Matrix.
- **Extra Large (16px):** Main layout panels or large container views.
- **Pills:** Strictly reserved for status badges, tags, and the Eisenhower priority indicators. Never use pill-shaped buttons for primary actions.

## Components

### Buttons
- **Primary:** Lavender-blue background, white text. No border. On hover, use `primary-hover`. On click, use `primary-focus`.
- **Secondary:** Surface 1 background with 1px Hairline. Use for "Add Task" or "Edit" buttons.

### Task Cards
- **Structure:** Surface 1 background, `rounded.lg` (12px) corners, 1px Hairline.
- **Priority Indicator:** A 2px vertical stripe on the left edge using the Eisenhower Quadrant colors.
- **Content:** Headline (body-md) for task title, Caption (body-sm) for metadata.

### Eisenhower Matrix
- **Grid:** A 2x2 layout with 24px gutters.
- **Header:** Each quadrant starts with an Eyebrow label (e.g., "DO FIRST") in its respective semantic color.

### Pomodoro Timer
- **Typography:** Uses `mono` at a large scale (e.g., 40px) for the countdown.
- **State:** When active, the border of the timer panel should pulse subtly with the `primary-focus` color.

### Input Fields
- **Style:** Surface 1 background, 1px Hairline border.
- **Focus:** 2px `primary-focus` outline at 50% opacity. No shadow.

### Step Indicators
- **Style:** Small 6px circles. Active state is Lavender-blue; inactive state is `ink-tertiary`. Used for onboarding or multi-step task creation.