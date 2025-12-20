# Validation Report: {{FEATURE_NAME}}

> **Phase**: 5/5 - Validation  
> **Input**: All previous docs (research.md, requirements.md, design.md, tasks.md)  
> **Generated**: {{DATE}}  
> **Status**: 🟡 Pending Review | 🟢 Approved | 🔴 Revisions Needed

---

## Executive Summary

{{One paragraph summarizing the feature scope and readiness for implementation}}

**Verdict**: ✅ **PASS** | ❌ **FAIL**

**Confidence Level**: 🟢 High | 🟡 Medium | 🔴 Low

---

## Document Checklist

| Document | Exists | Complete | Quality | Notes |
|----------|--------|----------|---------|-------|
| research.md | ✅/❌ | ✅/⚠️/❌ | ✅/⚠️/❌ | {{Notes}} |
| requirements.md | ✅/❌ | ✅/⚠️/❌ | ✅/⚠️/❌ | {{Notes}} |
| design.md | ✅/❌ | ✅/⚠️/❌ | ✅/⚠️/❌ | {{Notes}} |
| tasks.md | ✅/❌ | ✅/⚠️/❌ | ✅/⚠️/❌ | {{Notes}} |

---

## Automated Checks

<!-- ACTION REQUIRED: Verify these programmatically checkable items -->

| Check | Status | Details |
|-------|--------|---------|
| REQ IDs follow format (REQ-XXX) | ✅/❌ | {{Found N valid, M invalid}} |
| All REQs have priority (P1/P2/P3) | ✅/❌ | {{N/N have priority}} |
| All REQs have acceptance criteria | ✅/❌ | {{N/N have AC}} |
| All tasks have file paths | ✅/❌ | {{N/N have paths}} |
| All tasks have effort estimates | ✅/❌ | {{N/N have S/M/L}} |
| All tasks have Done When criteria | ✅/❌ | {{N/N have criteria}} |
| File paths in tasks exist or are new | ✅/❌ | {{N exist, M to create}} |
| Mermaid diagrams render | ✅/❌ | {{N/N render correctly}} |

---

## Traceability Matrix

<!-- ACTION REQUIRED: Every REQ must have Design AND Task coverage -->

| REQ ID | Priority | Requirement | Design Coverage | Task Coverage | Test Coverage | Status |
|--------|----------|-------------|-----------------|---------------|---------------|--------|
| REQ-001 | P1 | {{Title}} | ✅ {{Component}} | ✅ T007-T011 | ✅ T011 | COVERED |
| REQ-002 | P1 | {{Title}} | ✅ {{Component}} | ✅ T012-T013 | ⚠️ Partial | COVERED |
| REQ-003 | P2 | {{Title}} | ⚠️ Partial | ❌ Missing | ❌ Missing | **GAP** |

### Coverage Summary

| Metric | Count | Percentage |
|--------|-------|------------|
| Total Requirements | {{N}} | 100% |
| Fully Covered (Design + Task + Test) | {{N}} | {{X%}} |
| Partially Covered | {{N}} | {{Y%}} |
| No Coverage | {{N}} | {{Z%}} |

### P1 Requirements Status

| REQ ID | Design | Tasks | Tests | Ready for MVP |
|--------|--------|-------|-------|---------------|
| REQ-001 | ✅ | ✅ | ✅ | ✅ Yes |
| REQ-002 | ✅ | ✅ | ⚠️ | ⚠️ Partial |

---

## Issues Found

### Blocker Issues (Must Fix Before Implementation)

<!-- If none, write: "None — ready for implementation" -->

| ID | Severity | Document | Section | Issue | Suggested Fix |
|----|----------|----------|---------|-------|---------------|
| CRT-001 | 🔴 CRITICAL | {{doc}} | {{section}} | {{Issue description}} | {{How to fix}} |

### Warning Issues (Should Fix)

| ID | Severity | Document | Section | Issue | Suggested Fix |
|----|----------|----------|---------|-------|---------------|
| WRN-001 | 🟡 WARNING | {{doc}} | {{section}} | {{Issue description}} | {{How to fix}} |

### Minor Issues (Can Fix Later)

| ID | Severity | Document | Section | Issue | Suggested Fix |
|----|----------|----------|---------|-------|---------------|
| INF-001 | 🟢 INFO | {{doc}} | {{section}} | {{Improvement suggestion}} | {{Optional}} |

---

## Cross-Document Consistency

| Check | Status | Evidence |
|-------|--------|----------|
| Terminology consistent | ✅/⚠️/❌ | {{Same terms used: "user", "account"}} |
| File paths match across docs | ✅/⚠️/❌ | {{research → design → tasks}} |
| REQ IDs consistent | ✅/⚠️/❌ | {{Same numbering in all docs}} |
| Priority alignment | ✅/⚠️/❌ | {{P1 in reqs = P1 in tasks}} |
| Component names match | ✅/⚠️/❌ | {{design → tasks use same names}} |
| API endpoints match | ✅/⚠️/❌ | {{design → tasks use same endpoints}} |
| Effort estimates realistic | ✅/⚠️/❌ | {{Total {{X}}h for {{N}} tasks}} |

---

## Dependency Validation

<!-- ACTION REQUIRED: Verify requirement and task dependencies are correct -->

### Requirement Dependencies

| REQ ID | Declared Depends On | Actual Dependencies | Status |
|--------|---------------------|---------------------|--------|
| REQ-001 | None | None | ✅ Correct |
| REQ-002 | REQ-001 | REQ-001 | ✅ Correct |
| REQ-003 | REQ-001, REQ-002 | REQ-001 only | ⚠️ Over-specified |

### Task Dependencies

| Task ID | Declared Depends On | Actual Dependencies | Status |
|---------|---------------------|---------------------|--------|
| T007 | None | None | ✅ Correct |
| T008 | T007 | T007 | ✅ Correct |
| T009 | T008 | T007, T008 | ⚠️ Missing T007 |

---

## Risk Assessment

| Risk | Level | Impact | Likelihood | Mitigation | Owner |
|------|-------|--------|------------|------------|-------|
| {{Breaking change}} | 🔴 High | {{Who/what affected}} | {{High/Med/Low}} | {{How to mitigate}} | {{Role}} |
| {{Performance}} | 🟡 Medium | {{Potential slowdown}} | {{High/Med/Low}} | {{Benchmark}} | {{Role}} |
| {{Scope creep}} | 🟢 Low | {{Minor delay}} | {{High/Med/Low}} | {{Out of scope defined}} | {{Role}} |

### Risk Score

| Level | Count | Weighted Score |
|-------|-------|----------------|
| 🔴 High | {{N}} | {{N × 3}} |
| 🟡 Medium | {{N}} | {{N × 2}} |
| 🟢 Low | {{N}} | {{N × 1}} |
| **Total** | **{{N}}** | **{{Score}}** |

---

## Implementation Readiness

### Prerequisites Checklist

- [ ] All P1 requirements have full coverage (Design + Task + Test)
- [ ] All design components have corresponding tasks
- [ ] All tasks have file paths specified
- [ ] All tasks have "Done When" criteria
- [ ] No unresolved `[NEEDS CLARIFICATION]` items
- [ ] Risk mitigations documented
- [ ] No CRITICAL issues remaining
- [ ] Rollback plan defined in tasks.md
- [ ] Effort estimates total is realistic

### Estimated Implementation Time

| Phase | Tasks | Effort | Calendar Days |
|-------|-------|--------|---------------|
| Setup | {{N}} | {{X}}h | {{Y}} |
| Foundational | {{N}} | {{X}}h | {{Y}} |
| P1 Requirements | {{N}} | {{X}}h | {{Y}} |
| P2 Requirements | {{N}} | {{X}}h | {{Y}} |
| Polish | {{N}} | {{X}}h | {{Y}} |
| **Total** | **{{N}}** | **{{X}}h** | **{{Y}} days** |

### Recommended Execution Mode

| Mode | When to Use |
|------|-------------|
| 🔧 Task-by-Task | High-risk changes, learning codebase |
| 📦 Phase-by-Phase | Normal development (**DEFAULT**) |
| 🚀 Auto-Run All | Low-risk, well-understood changes |

**Suggested Mode**: {{Based on risk assessment}}

**Rationale**: {{Why this mode is recommended}}

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

- [ ] All 4 input documents were read completely
- [ ] Automated checks performed
- [ ] Traceability matrix is complete (every REQ mapped)
- [ ] All issues are classified by severity with suggested fixes
- [ ] Cross-document consistency verified
- [ ] Dependency validation performed
- [ ] Risk assessment includes likelihood and owner
- [ ] Implementation time estimate provided
- [ ] Verdict is clearly stated (PASS/FAIL)
- [ ] Confidence level stated (High/Medium/Low)
- [ ] Recommended execution mode provided with rationale
