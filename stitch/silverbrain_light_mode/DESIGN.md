---
name: SilverBrain Light Mode
colors:
  surface: '#f9f9fb'
  surface-dim: '#d9dadc'
  surface-bright: '#f9f9fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f3f5'
  surface-container: '#edeef0'
  surface-container-high: '#e8e8ea'
  surface-container-highest: '#e2e2e4'
  on-surface: '#1a1c1d'
  on-surface-variant: '#454652'
  inverse-surface: '#2f3132'
  inverse-on-surface: '#f0f0f2'
  outline: '#767684'
  outline-variant: '#c6c5d5'
  surface-tint: '#4854bb'
  primary: '#4450b7'
  on-primary: '#ffffff'
  primary-container: '#5e6ad2'
  on-primary-container: '#fdfaff'
  inverse-primary: '#bdc2ff'
  secondary: '#4e57a7'
  on-secondary: '#ffffff'
  secondary-container: '#9ea7fe'
  on-secondary-container: '#303988'
  tertiary: '#834f00'
  on-tertiary: '#ffffff'
  tertiary-container: '#a56500'
  on-tertiary-container: '#fffaf8'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dfe0ff'
  primary-fixed-dim: '#bdc2ff'
  on-primary-fixed: '#000965'
  on-primary-fixed-variant: '#2e3aa2'
  secondary-fixed: '#dfe0ff'
  secondary-fixed-dim: '#bdc2ff'
  on-secondary-fixed: '#020a63'
  on-secondary-fixed-variant: '#363f8e'
  tertiary-fixed: '#ffddbb'
  tertiary-fixed-dim: '#ffb867'
  on-tertiary-fixed: '#2b1700'
  on-tertiary-fixed-variant: '#673d00'
  background: '#f9f9fb'
  on-background: '#1a1c1d'
  surface-variant: '#e2e2e4'
typography:
  headline-xl:
    fontFamily: Manrope
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Manrope
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Manrope
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Geist
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 8px
  container-max: 1200px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 48px
---

## Brand & Style
The design system is built on a **Focus-First Minimalism** philosophy. It prioritizes cognitive ease by stripping away non-essential interface elements, allowing the user's content to take center stage. The aesthetic is "airy" and intentional, utilizing negative space not just as a buffer, but as a structural tool.

The brand persona is intellectual, precise, and unobtrusive. It functions as a "digital sanctuary" for deep work. 

**Visual Signature:**
- **The Logo:** A new pixelated brain icon represents the intersection of human thought and digital precision. It should be rendered in the primary lavender-blue or a neutral dark grey.
- **Progressive Disclosure:** Non-essential UI remains hidden until interaction. Use subtle visual cues like small dots or faint chevrons to indicate available but hidden actions.
- **Texture:** Eschew heavy shadows and gradients for a clean, flat aesthetic that relies on hairlines and tonal shifts for hierarchy.

## Colors
The color palette is designed to reduce ocular fatigue while maintaining high legibility. 

- **Canvas:** The primary background uses a soft off-white (`#F9F9FB`) to avoid the harsh glare of pure white.
- **Primary Accent:** Lavender-blue (`#5E6AD2`) is used sparingly for primary actions and active states. It has been checked for AA accessibility against the off-white canvas.
- **Borders:** "Hairline" strokes (`#E5E5ED`) replace shadows to define boundaries without adding visual weight.
- **Interactive States:** Use a lighter tint of the primary color (`#F0F1FA`) for hover states and subtle backgrounds.

## Typography
The typography system balances modern refinement with technical precision. 

- **Headlines (Manrope):** Chosen for its balanced, modern proportions. It provides a welcoming yet professional tone.
- **Body (Inter):** A systematic, utilitarian font that ensures maximum readability across long-form content.
- **Labels & Monospace (Geist):** Used for metadata and hidden UI cues. Its developer-friendly, precise nature complements the focus-first philosophy.

All type scales are optimized for a 4px baseline grid. Headlines should use tighter letter spacing to maintain a "tight" editorial feel.

## Layout & Spacing
The layout follows a **Fluid-Fixed hybrid model**. Containers scale fluidly until they reach a maximum width of 1200px, after which they center within the viewport.

- **Rhythm:** An 8px linear scale governs all spacing.
- **Margins:** Large exterior margins (48px on desktop) reinforce the "airy" feel and create a focused central column.
- **Focus States:** When "Focus Mode" is active, sidebars and headers should collapse into minimalist bars or hide entirely, triggered only by edge-hover or specific keyboard shortcuts.
- **Responsive:** On mobile, margins shrink to 16px, and multi-column grids collapse into a single vertical stack.

## Elevation & Depth
In this design system, depth is communicated through **Tonal Layering** and **Hairlines** rather than physical light-source shadows.

- **Level 0 (Base):** The #F9F9FB canvas.
- **Level 1 (Surfaces):** Cards and containers use a pure white (#FFFFFF) background to subtly lift off the canvas.
- **Hairlines:** A 1px solid border (#E5E5ED) is the primary method of separation. 
- **Backdrop Blur:** For transient elements like modals or dropdowns, use a subtle 8px backdrop blur with a 70% opacity white fill to maintain context of the underlying layer.

## Shapes
The shape language is "Soft" (0.25rem / 4px base radius). This maintains a professional, structured look while removing the harshness of sharp corners.

- **Standard Elements:** 4px radius (Buttons, Input fields).
- **Large Containers:** 8px radius (Cards, Modals).
- **Interactive Cues:** Small circular dots (radius: 100%) are used to indicate hidden interactive zones.

## Components

### Buttons
- **Primary:** Lavender-blue fill with white text. No shadow; 1px inset highlight on hover.
- **Ghost:** No background or border. Text-only until hover, where a light lavender tint (#F0F1FA) appears.

### Input Fields
- **Style:** Understated. Use a bottom-only hairline in the default state. Transition to a full 1px border in Lavender-blue upon focus.
- **Labels:** Use the "Geist" label-md style, positioned above the field with generous padding.

### Cards
- **Structure:** White background, 1px hairline border, no shadow. 
- **Header:** Use a subtle horizontal rule to separate header content if necessary.

### Focus-First Elements
- **Hidden Actions:** Use a single "more" dot (3px diameter) next to list items. On hover, the dot expands into a chevron or reveals a horizontal button group.
- **Chips:** Small, low-contrast pills for tags. Use `#E5E5ED` backgrounds with `#4A4A4E` text.

### Toggle
- **Seamless Transition:** The light/dark toggle should use a cross-fade transition of 300ms. All variables are mapped 1:1 between modes to ensure layout stability during switching.