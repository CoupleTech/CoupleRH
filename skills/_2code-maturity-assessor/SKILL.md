name: code-maturity-assessor
description: Systematic code maturity evaluation skill integrated into the project execution pipeline. Analyzes application quality, security posture, architecture integrity and maintainability using a structured 9-category framework. Must align with project skills, documentation files and pipeline rules.

---

# CODE MATURITY ASSESSOR — SYSTEM INTEGRATION MODE

This skill is NOT an independent agent.

It operates inside the Project Execution Kernel.

It MUST respect:

- /skills pipeline
- fase.md (source of execution state)
- documentacao.md (system truth)
- database.md (data architecture truth)

---

# 1. PURPOSE

Evaluate code maturity across the entire system:

- security
- architecture
- maintainability
- scalability
- testability
- performance
- complexity control
- operational safety

This assessment is mandatory before production readiness.

---

# 2. INPUT SOURCES (MANDATORY)

The assessment must use:

- Source code
- /skills definitions
- fase.md (current project stage)
- documentacao.md (system design decisions)
- database.md (data integrity model)

No evaluation is valid without these references.

---

# 3. ASSESSMENT PHASES

## Phase 1 — Context Loading

- Read project structure
- Read current phase.md
- Identify active pipeline (Lean or Enterprise)
- Identify implemented vs planned features

---

## Phase 2 — Code Analysis

Analyze implementation for:

- architecture consistency
- security gaps
- duplication
- complexity hotspots
- data integrity risks
- performance issues

---

## Phase 3 — Skill Alignment Check

Verify if implementation respects:

- ui-design-system
- dashboard-layout
- responsive-design
- backend/security rules (if applicable)

Any violation must be flagged.

---

## Phase 4 — Database Integrity Check

Using database.md:

- validate schema consistency
- detect missing constraints
- detect unsafe relations
- identify data duplication risks

---

## Phase 5 — Maturity Scoring

Each category is scored:

- 0 = Missing
- 1 = Weak
- 2 = Moderate
- 3 = Satisfactory
- 4 = Strong

---

# 4. THE 9 MATURITY CATEGORIES

## 1. SECURITY & ACCESS CONTROL

- authentication integrity
- authorization enforcement
- exposure risks
- frontend-only security violations

---

## 2. ARCHITECTURE CONSISTENCY

- alignment with pipeline (Lean/Enterprise)
- separation of concerns
- layering correctness

---

## 3. CODE COMPLEXITY

- maintainability
- function size
- coupling
- duplication

---

## 4. DATA INTEGRITY

- database consistency
- schema correctness
- transaction safety
- Supabase/PostgreSQL correctness

---

## 5. UI SYSTEM COMPLIANCE

- ui-design-system adherence
- dashboard-layout adherence
- responsive-design adherence

---

## 6. PERFORMANCE EFFICIENCY

- frontend performance
- backend query efficiency
- unnecessary computation

---

## 7. TESTING & RELIABILITY

- test coverage
- edge case handling
- failure recovery

---

## 8. DOCUMENTATION QUALITY

- documentacao.md consistency
- completeness of system documentation
- clarity of decisions

---

## 9. OPERATIONAL READINESS

- production readiness
- deployment safety
- environment separation
- logging and observability

---

# 5. RULES OF EVALUATION

- No category can be skipped
- No score without evidence
- Every issue must reference file or system layer
- Must respect project pipeline (Lean or Enterprise)

---

# 6. OUTPUT FORMAT

## CODE MATURITY REPORT

1. Project Context
2. Pipeline Type (Lean / Enterprise)
3. Current Phase (from fase.md)

---

1. Maturity Scorecard (9 categories)

---

1. Critical Issues

- security risks
- architecture risks
- data risks

---

1. Improvement Roadmap

- CRITICAL
- HIGH
- MEDIUM

---

1. Production Readiness Decision

- APPROVED
- NOT APPROVED
- REQUIRES FIXES

---

# 7. BLOCKER RULE

Production deployment is BLOCKED if:

- security score is Weak
- data integrity is compromised
- architecture is inconsistent with pipeline
- critical category score < 2

---

# FINAL PRINCIPLE

This system does not "review code".

It enforces engineering maturity before production.
