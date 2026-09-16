name: dashboard-layout
description: Defines the structural architecture of corporate dashboards, including layout composition (sidebar, header, content zones), information hierarchy and data organization patterns. Must strictly follow ui-design-system rules.

---

# DASHBOARD LAYOUT — ARCHITECTURAL SYSTEM

This skill defines the structural composition of dashboard and administrative interfaces.

It does NOT define visual styling details.
It defines layout architecture and information organization only.

All visual rules must be inherited from:
ui-design-system

---

# 1. CORE ARCHITECTURE (APP SHELL)

All dashboards must follow a 3-layer structure:

## 1.1 Sidebar (Navigation Layer)

- Fixed vertical navigation
- Primary entry point for system routes
- Must support:
  - active state
  - collapsed state (optional)
  - grouped navigation sections

Sidebar is persistent across all dashboard screens.

---

## 1.2 Header (Context Layer)

- Persistent top bar
- Contains:
  - page context (title / breadcrumb)
  - global actions (notifications, profile, settings)
  - optional global search

Header must NOT contain heavy business logic.

---

## 1.3 Content Area (Data Layer)

- Primary working area
- Fully scrollable independently
- Contains:
  - metrics
  - tables
  - forms
  - charts
  - dashboards

Content area is the only dynamic region.

---

# 2. INFORMATION HIERARCHY RULE

Dashboards must follow this hierarchy:

1. KPIs / Metrics (top-level summary)
2. Secondary insights (charts / summaries)
3. Detailed data (tables / lists)
4. Actions (forms / controls)

Never mix levels of importance in the same visual weight.

---

# 3. GRID ORGANIZATION SYSTEM

All layouts must be structured using grid-based composition.

Allowed structures:

- 12-column grid (complex dashboards)
- 4-column grid (metric summaries)
- modular grid blocks

Rules:

- alignment consistency is mandatory
- avoid free-form positioning
- maintain visual rhythm across sections

---

# 4. DASHBOARD COMPONENT GROUPING

Dashboards must be composed of logical sections:

## 4.1 KPI Section

- High-level metrics only
- Positioned at top of content area
- Must be immediately readable

---

## 4.2 Insights Section

- Charts, trends, aggregations
- Must explain system state

---

## 4.3 Data Section

- Tables or lists
- High density structured data
- Must prioritize readability and scanning

---

## 4.4 Action Section

- Forms, filters, bulk actions
- Always clearly separated from data display

---

# 5. TABLE INTEGRATION RULE

Tables are the primary data structure in dashboards.

Rules:

- must support pagination
- must support sorting (when applicable)
- must support row-level actions
- must support loading and empty states

Tables must never overload visual hierarchy.

---

# 6. NAVIGATION BEHAVIOR RULE

- Sidebar defines system structure
- Header defines contextual actions
- Content defines user tasks

No cross-responsibility allowed.

Example violation:

- business logic inside sidebar
- data manipulation inside header

---

# 7. RESPONSIVENESS ARCHITECTURE

Dashboards must adapt across devices:

## Desktop

- full sidebar visible
- full grid layout enabled

## Tablet

- condensed sidebar
- adjusted grid density

## Mobile

- sidebar becomes drawer
- content becomes single-column flow

Responsiveness must not break hierarchy.

---

# 8. STATE ARCHITECTURE (MANDATORY)

All dashboard screens must support:

- loading state
- empty state
- error state
- partial data state

No dashboard is valid without full state coverage.

---

# 9. UI SYSTEM DEPENDENCY RULE

This skill depends on:

ui-design-system (mandatory)

Rules:

- This skill defines structure only
- UI Design System defines appearance
- Both must not overlap responsibilities

---

# 10. SECURITY AWARE LAYOUT

Dashboards must NOT:

- expose sensitive admin actions without validation
- assume frontend authorization is sufficient
- bypass backend permissions model

Security logic is not a UI responsibility.

---

# 11. PERFORMANCE LAYOUT RULE

Dashboards must avoid:

- unnecessary re-renders
- excessive nested components
- over-fetching data in layout level

Layout must remain lightweight.

---

# FINAL PRINCIPLE

Dashboard layout is not visual design.

It is structural engineering for data-heavy systems.
