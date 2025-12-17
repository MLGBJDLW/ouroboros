# Validation Report: {{FEATURE_NAME}}

> **Phase**: 5/5 - Validation  
> **Input**: All previous docs (research.md, requirements.md, design.md, tasks.md)  
> **Generated**: {{DATE}}  
> **Status**: 🟡 Pending Review | 🟢 Approved | 🔴 Revisions Needed

---

## Executive Summary

{{One paragraph summarizing the feature scope and readiness for implementation}}

**Verdict**: ✅ **PASS** | ❌ **FAIL**

---

## Document Checklist

| Document | Exists | Complete | Notes |
|----------|--------|----------|-------|
| research.md | ✅/❌ | ✅/⚠️/❌ | {{Notes}} |
| requirements.md | ✅/❌ | ✅/⚠️/❌ | {{Notes}} |
| design.md | ✅/❌ | ✅/⚠️/❌ | {{Notes}} |
| tasks.md | ✅/❌ | ✅/⚠️/❌ | {{Notes}} |

---

## Traceability Matrix

<!-- ACTION REQUIRED: Every REQ must have Design AND Task coverage -->

| REQ ID | Priority | Requirement | Design Coverage | Task Coverage | Status |
|--------|----------|-------------|-----------------|---------------|--------|
| REQ-001 | P1 | {{Title}} | ✅ {{Component}} | ✅ T007-T011 | COVERED |
| REQ-002 | P1 | {{Title}} | ✅ {{Component}} | ✅ T012-T013 | COVERED |
| REQ-003 | P2 | {{Title}} | ⚠️ Partial | ❌ Missing | **GAP** |

### Coverage Summary

| Metric | Count | Percentage |
|--------|-------|------------|
| Total Requirements | {{N}} | 100% |
| Fully Covered | {{N}} | {{X%}} |
| Partially Covered | {{N}} | {{Y%}} |
| No Coverage | {{N}} | {{Z%}} |

---

## Issues Found

### Blocker Issues (Must Fix Before Implementation)

<!-- If none, write: "None — ready for implementation" -->

| ID | Severity | Document | Issue | Suggested Fix |
|----|----------|----------|-------|---------------|
| CRT-001 | 🔴 CRITICAL | {{doc}} | {{Issue description}} | {{How to fix}} |

### Warning Issues (Should Fix)

| ID | Severity | Document | Issue | Suggested Fix |
|----|----------|----------|-------|---------------|
| WRN-001 | 🟡 WARNING | {{doc}} | {{Issue description}} | {{How to fix}} |

### Minor Issues (Can Fix Later)

| ID | Severity | Document | Issue | Suggested Fix |
|----|----------|----------|-------|---------------|
| INF-001 | 🟢 INFO | {{doc}} | {{Improvement suggestion}} | {{Optional}} |

---

## Cross-Document Consistency

| Check | Status | Notes |
|-------|--------|-------|
| Terminology consistent | ✅/⚠️/❌ | {{Same terms used across docs}} |
| File paths match | ✅/⚠️/❌ | {{research → design → tasks}} |
| REQ IDs consistent | ✅/⚠️/❌ | {{Same numbering}} |
| Priority alignment | ✅/⚠️/❌ | {{P1 in reqs = P1 in tasks}} |

---

## Risk Assessment

| Risk | Level | Impact | Mitigation |
|------|-------|--------|------------|
| {{Breaking change}} | 🔴 High | {{Who/what affected}} | {{How to mitigate}} |
| {{Performance}} | 🟡 Medium | {{Potential slowdown}} | {{Benchmark}} |
| {{Scope creep}} | 🟢 Low | {{Minor delay}} | {{Out of scope defined}} |

---

## Implementation Readiness

### Prerequisites Checklist

- [ ] All P1 requirements have full coverage
- [ ] All design components have corresponding tasks
- [ ] All tasks have file paths specified
- [ ] No unresolved `[NEEDS CLARIFICATION]` items
- [ ] Risk mitigations documented
- [ ] No CRITICAL issues remaining

### Recommended Execution Mode

| Mode | When to Use |
|------|-------------|
| 🔧 Task-by-Task | High-risk changes, learning codebase |
| 📦 Phase-by-Phase | Normal development (**DEFAULT**) |
| 🚀 Auto-Run All | Low-risk, well-understood changes |

**Suggested Mode**: {{Based on risk assessment}}

---

## User Decision

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 Spec: {{FEATURE_NAME}}
📊 Status: Validation Complete
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Options:
  [yes]      → Proceed to /ouroboros-implement
  [revise X] → Return to Phase X (1=Research, 2=Req, 3=Design, 4=Tasks)
  [abort]    → Cancel this spec
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Approval Log

| Date | Reviewer | Decision | Notes |
|------|----------|----------|-------|
| {{DATE}} | {{User}} | Pending | Initial validation |

---

## Quality Self-Check

Before marking complete, verify:

- [ ] All 4 input documents were read
- [ ] Traceability matrix is complete (every REQ mapped)
- [ ] All issues are classified by severity
- [ ] Consistency checks performed
- [ ] Verdict is clearly stated (PASS/FAIL)
- [ ] Recommended execution mode provided
