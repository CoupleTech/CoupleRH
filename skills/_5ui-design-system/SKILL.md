name: ui-design-system
description: UI Design System global para padronização visual, consistência de interface e construção de sistemas profissionais escaláveis.

---

# UI DESIGN SYSTEM — CORE ARCHITECTURE

This skill defines the visual and interaction standards for all user interfaces across the system.

It applies to both:

- Lean (Supabase + Vercel)
- Enterprise (VPS + Backend Architecture)

UI consistency is mandatory across all projects.

This skill does NOT control development flow or phases.
It only controls interface design rules.

---

# 1. CORE TECHNOLOGIES

- Tailwind CSS is mandatory for styling
- Lucide React for icons only
- No custom CSS unless explicitly justified
- No UI libraries that conflict with Tailwind structure

---

# 2. VISUAL DESIGN PRINCIPLES

## 2.1 Layout Philosophy

- Clean, structured, grid-based interfaces
- Prefer 12-column or modular grid systems
- Information hierarchy must be visually clear

---

## 2.2 Border System

- Default: rounded-md
- Cards / modals: rounded-lg
- Avoid excessive rounding unless functional (badges, avatars)

---

## 2.3 Shadow System

- Only neutral shadows allowed
- Allowed:
  - shadow-sm
  - shadow-md
- Forbidden:
  - colored shadows
  - glow effects
  - neon styling

---

## 2.4 Color System

Strict limit: 3 core colors only

- Primary (actions / brand)
- Secondary (support / structure)
- Accent (highlight / alerts)

Rules:

- Must be defined at project start (by Rule Kernel)
- No random color introduction per component
- Maintain visual consistency across system

---

## 2.5 Background System

- Prefer neutral backgrounds:
  - white (bg-white)
  - slate/gray soft tones (bg-gray-50, bg-slate-50)
- Cards must be visually separated from background
- Avoid visual noise or gradients unless justified

---

# 3. TYPOGRAPHY SYSTEM

## Hierarchy Rules

- H1: text-2xl to text-3xl, font-semibold or font-bold
- H2/H3: text-lg to text-xl
- Body: text-sm to text-base

Color standards:

- Titles: text-gray-900 / text-slate-800
- Secondary text: text-gray-600 / text-slate-600
- Body: text-gray-700 / text-slate-700

---

# 4. GRID & LAYOUT SYSTEM

- Use grid-cols-12 or grid-cols-4 for dashboards
- Maintain structured alignment for data-heavy screens
- Tables must prioritize readability over compactness
- Mobile-first design is mandatory

Responsive rules:

- Stack layout vertically on mobile
- Allow horizontal scroll for complex tables when necessary

---

# 5. INTERACTIONS & ANIMATIONS

- Transitions must be fast (150ms–200ms max)
- Only animate meaningful properties:
  - color
  - opacity
  - transform (limited use)

Allowed:

- hover:bg-gray-50
- hover:border-gray-300

Forbidden:

- large scale animations on data-heavy components
- excessive motion effects

Focus states are mandatory for accessibility.

---

# 6. COMPONENT BEHAVIOR RULES

All UI components must include:

- Loading state
- Empty state
- Error state

No component is valid without full state coverage.

---

# 7. RESPONSIVENESS RULES

- Mobile-first design is mandatory
- Desktop enhancements must not break mobile structure
- Avoid layout collapse on small screens

---

# 8. SECURITY AWARE UI RULES

UI must NEVER:

- expose sensitive data directly
- bypass backend validation assumptions
- implement security logic only on frontend

UI is presentation layer only.

---

# 9. CODE MATURITY INTEGRATION

All UI implementations must comply with:

code-maturity-assessor skill

Before production:

- no layout inconsistencies
- no unsafe UI patterns
- no unhandled states
- no duplicated UI logic

---

# 10. DESIGN CONSISTENCY RULE

Once a pattern is established in the project:

- it must be reused
- not redefined per screen
- UI consistency > visual experimentation

---

# 11. OUTPUT BEHAVIOR (WHEN USED)

When this skill is active:

- validate UI consistency
- reject inconsistent visual patterns
- enforce design system rules
- suggest corrections when needed

---

# FINAL PRINCIPLE

UI is not decoration.

UI is structural engineering for user interaction.
