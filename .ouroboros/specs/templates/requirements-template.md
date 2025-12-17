# Requirements: {{FEATURE_NAME}}

> **Phase**: 2/5 - Requirements  
> **Input**: [research.md](./research.md)  
> **Created**: {{DATE}}  
> **Status**: 🟡 Draft | 🟢 Approved

---

## Introduction

{{Brief description of the feature and the problem it solves}}

**Core Goals:**
1. {{Primary goal}}
2. {{Secondary goal}}
3. {{Tertiary goal}}

---

## Glossary

| Term | Definition |
|------|------------|
| {{Term 1}} | {{Project-specific definition}} |
| {{Term 2}} | {{Definition}} |

---

## Functional Requirements

<!-- 
  ACTION REQUIRED: 
  - Use EARS notation (WHEN/WHILE/IF-THEN/SHALL)
  - Each requirement must have P1/P2/P3 priority
  - Each requirement must have Independent Test
-->

### REQ-001: {{Requirement Title}} (Priority: P1) 🎯

**User Story**: As a {{role}}, I want {{capability}}, so that {{benefit}}.

**Why P1**: {{Explain why this is highest priority — MVP critical}}

**Independent Test**: {{How to verify this requirement works on its own}}

**Acceptance Criteria** (EARS notation):
1. WHEN {{trigger}}, the System SHALL {{behavior}}
2. WHILE {{state}}, the System SHALL {{ongoing behavior}}
3. IF {{error condition}}, THEN the System SHALL {{error handling}}

---

### REQ-002: {{Requirement Title}} (Priority: P1)

**User Story**: As a {{role}}, I want {{capability}}, so that {{benefit}}.

**Why P1**: {{...}}

**Independent Test**: {{...}}

**Acceptance Criteria**:
1. WHEN {{trigger}}, the System SHALL {{behavior}}
2. IF {{condition}}, THEN the System SHALL {{fallback}}

---

### REQ-003: {{Requirement Title}} (Priority: P2)

**User Story**: As a {{role}}, I want {{capability}}, so that {{benefit}}.

**Why P2**: {{Important but not MVP-critical}}

**Independent Test**: {{...}}

**Acceptance Criteria**:
1. WHEN {{trigger}}, the System SHALL {{behavior}}

---

### REQ-004: {{Requirement Title}} (Priority: P3)

**User Story**: As a {{role}}, I want {{capability}}, so that {{benefit}}.

**Why P3**: {{Nice to have if time permits}}

**Independent Test**: {{...}}

**Acceptance Criteria**:
1. WHEN {{trigger}}, the System SHALL {{behavior}}

---

## Edge Cases

<!-- ACTION REQUIRED: Identify boundary conditions and error scenarios -->

| Scenario | Expected Behavior |
|----------|-------------------|
| What if {{empty input}}? | {{System should...}} |
| What if {{network failure}}? | {{System should...}} |
| What if {{concurrent access}}? | {{System should...}} |
| {{[NEEDS CLARIFICATION: ...]}} | {{Awaiting user input}} |

---

## Non-Functional Requirements

| Category | Requirement | Metric |
|----------|-------------|--------|
| Performance | Response time | < {{200ms}} |
| Security | Data handling | {{Encrypted at rest}} |
| Accessibility | Compliance | {{WCAG 2.1 AA}} |
| Scalability | Concurrent users | {{1000+}} |

---

## Out of Scope

<!-- ACTION REQUIRED: Explicitly define boundaries to prevent scope creep -->

- ❌ {{Feature X — will be handled in future iteration}}
- ❌ {{Integration with Y — not part of this spec}}
- ❌ {{Admin features — separate spec needed}}

---

## Open Questions

- [ ] {{[NEEDS CLARIFICATION: Auth method not specified — email/password? OAuth?]}}
- [ ] {{[NEEDS CLARIFICATION: Data retention period?]}}

---

## Requirements Summary

| Priority | Count | Coverage |
|----------|-------|----------|
| P1 (Must) | {{N}} | MVP |
| P2 (Should) | {{N}} | Post-MVP |
| P3 (Could) | {{N}} | Future |

---

## Quality Self-Check

Before marking complete, verify:

- [ ] All requirements have unique IDs (REQ-XXX)
- [ ] All requirements have P1/P2/P3 priority
- [ ] All requirements have Independent Test description
- [ ] All requirements use EARS notation (WHEN/SHALL)
- [ ] Edge cases are identified
- [ ] Out of scope is explicitly defined
- [ ] No ambiguous language ("fast", "easy", "better")

---

## → Next Phase

**Output**: This requirements.md  
**Next**: design.md (Phase 3)  
**Handoff**: Ready for `ouroboros-architect` agent
