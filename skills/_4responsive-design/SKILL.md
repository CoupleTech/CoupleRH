name: responsive-design
description: Defines responsive behavior rules for layout adaptation across devices. Controls how interfaces reflow, scale and reorganize based on screen size, container size and interaction context. Must be used in conjunction with ui-design-system and dashboard-layout.

---

# RESPONSIVE DESIGN — BEHAVIOR SYSTEM

This skill defines HOW interfaces adapt across different screen sizes and contexts.

It does NOT define visual styling.
It does NOT define component implementation.
It only defines adaptive behavior rules.

---

# 1. RESPONSIVE DESIGN PRINCIPLE

All interfaces must be:

- Mobile-first by default
- Progressive enhancement on larger screens
- Content-driven, not device-driven

Layout must adapt to content needs, not screen assumptions.

---

# 2. RESPONSIVE ARCHITECTURE LEVELS

Responsiveness must be applied in 3 layers:

## 2.1 Layout Level (Global Structure)

Controlled by dashboard-layout

Rules:

- sidebar behavior
- header behavior
- content reflow

---

## 2.2 Component Level (Local Adaptation)

Controlled by this skill

Rules:

- components must adapt size and layout
- components must not break hierarchy
- components may reflow internally (stack → row)

---

## 2.3 Content Level (Micro Adaptation)

Controlled by ui-design-system

Rules:

- typography scaling
- spacing adjustments
- visual density control

---

# 3. BREAKPOINT STRATEGY

Breakpoints are guidelines, not device targeting.

Standard scale:

- mobile: base (<640px)
- sm: 640px+
- md: 768px+
- lg: 1024px+
- xl: 1280px+
- 2xl: 1536px+

Rules:

- breakpoints must be used for layout shifts only
- avoid excessive breakpoint fragmentation
- prefer fluid behavior over rigid breakpoints

---

# 4. LAYOUT ADAPTATION RULES

## 4.1 Grid Behavior

- grids must collapse progressively
- multi-column layouts must degrade gracefully
- avoid horizontal overflow at all costs

---

## 4.2 Navigation Behavior

- sidebar → collapses into drawer on mobile
- header → remains persistent but simplified
- actions → grouped into overflow menus on small screens

---

## 4.3 Data Display Behavior

- tables → must adapt to mobile using:
  - horizontal scroll OR
  - stacked card transformation

Choice depends on data density.

---

# 5. TYPOGRAPHY RESPONSIVENESS

Typography must:

- scale fluidly where appropriate
- maintain readability on all devices
- never shrink below usability threshold

Rules:

- avoid abrupt font-size jumps
- preserve hierarchy across breakpoints

---

# 6. SPACING RESPONSIVENESS

Spacing must:

- reduce density on mobile
- increase breathing space on desktop
- maintain proportional rhythm across breakpoints

No layout should feel “cramped” or “empty” at extremes.

---

# 7. COMPONENT RESPONSIVENESS RULE

All components must support:

- mobile state
- tablet state (optional but recommended)
- desktop state

Each state must preserve:

- functionality
- readability
- hierarchy

No feature can disappear on mobile without justification.

---

# 8. CONTENT PRIORITY RULE

On smaller screens:

Priority order:

1. critical actions
2. primary data
3. secondary data
4. decorative elements

Non-essential UI must be deferred or hidden.

---

# 9. PERFORMANCE AWARE RESPONSIVENESS

Responsive behavior must NOT:

- cause layout shift instability (CLS)
- trigger unnecessary re-renders
- duplicate heavy components per breakpoint

Performance must remain stable across all screen sizes.

---

# 10. DESIGN SYSTEM INTEGRATION

This skill depends on:

- ui-design-system (visual rules)
- dashboard-layout (structural rules)

Rules:

- this skill cannot override visual design rules
- this skill cannot override layout architecture
- this skill only defines adaptive behavior

---

# 11. SECURITY AWARE RESPONSIVENESS

Responsive UI must NOT:

- expose hidden admin actions on mobile unintentionally
- bypass permission-based UI rendering
- rely on frontend-only restrictions for access control

Security rules remain backend-first.

---

# FINAL PRINCIPLE

Responsive design is not layout styling.

It is behavioral adaptation of interfaces across environments.
