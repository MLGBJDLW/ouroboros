# Validation Report: [Feature Name]

> **Generated**: YYYY-MM-DD
> **Validated by**: `ouroboros-validator`
> **Status**: 🟡 Pending Review | 🟢 Approved | 🔴 Revisions Needed

---

## 📊 Executive Summary

[One paragraph summarizing what this feature will do and its scope]

---

## 🔍 Consistency Check

### Cross-Document Traceability

| Source | Target | Status | Notes |
|--------|--------|--------|-------|
| Research → Requirements | ✅ / ⚠️ / ❌ | [All affected files covered in requirements] |
| Requirements → Design | ✅ / ⚠️ / ❌ | [All REQ-XXX have design coverage] |
| Design → Tasks | ✅ / ⚠️ / ❌ | [All components have implementation tasks] |
| Tasks → Requirements | ✅ / ⚠️ / ❌ | [All tasks trace back to requirements] |

### Unresolved Items

| Document | Issue | Severity | Suggested Action |
|----------|-------|----------|------------------|
| [e.g., design.md] | REQ-003 not addressed | 🟡 Medium | Add component for auth |

---

## 📁 Impact Analysis

### Files to CREATE (X new files)

| File Path | Purpose | Estimated Size |
|-----------|---------|----------------|
| `src/components/NewFeature.tsx` | [Main component] | ~100 lines |

### Files to MODIFY (Y existing files)

| File Path | Changes | Risk Level |
|-----------|---------|------------|
| `src/routes.ts` | Add new route (line ~25) | 🟢 Low |
| `src/api/handlers.py` | New endpoint handler | 🟡 Medium |

### Files to DELETE (if any)

| File Path | Reason |
|-----------|--------|
| [None expected] | - |

---

## ⚠️ Risk Assessment

| Risk | Level | Impact | Mitigation |
|------|-------|--------|------------|
| [e.g., Breaking API change] | 🔴 High / 🟡 Medium / 🟢 Low | [Who/what is affected] | [How to mitigate] |
| [e.g., Performance regression] | 🟡 Medium | [Potential slowdown] | [Benchmark before/after] |

---

## 📋 Implementation Readiness

### Prerequisites Checklist

- [ ] All requirements have unique IDs (REQ-XXX)
- [ ] All design components have corresponding tasks
- [ ] All tasks have file paths specified
- [ ] No unresolved open questions in research.md
- [ ] Risk mitigations documented

### Recommended Execution Mode

| Mode | Recommended When |
|------|------------------|
| 🔧 Task-by-Task | High-risk changes identified above |
| 📦 Phase-by-Phase | Normal development (DEFAULT) |
| 🚀 Auto-Run All | No risks identified, trusted changes |

**Suggested Mode**: [Phase-by-Phase / Task-by-Task / Auto-Run based on risk assessment]

---

## ✅ User Decision

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 Spec: [feature-name]
📊 Status: Validation Complete
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Options:
  [yes]           → Proceed to /ouroboros-implement
  [revise X]      → Return to Phase X (1=Research, 2=Req, 3=Design, 4=Tasks)
  [abort]         → Cancel this spec
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 📝 Approval Log

| Date | Reviewer | Decision | Notes |
|------|----------|----------|-------|
| YYYY-MM-DD | [User] | Pending | Initial validation |
