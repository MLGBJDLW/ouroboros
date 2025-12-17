# Research: {{FEATURE_NAME}}

> **Phase**: 1/5 - Research  
> **Input**: User request  
> **Created**: {{DATE}}  
> **Status**: 🟡 Draft | 🟢 Approved

---

## Executive Summary

<!-- ACTION REQUIRED: 2-3 sentence summary of what this feature is and why it's needed -->

{{Brief description of the feature and its value}}

---

## Project Context

### Tech Stack

<!-- ACTION REQUIRED: Fill with actual versions from package.json, requirements.txt, etc. -->

| Layer | Technology | Version | Why This Tech |
|-------|------------|---------|---------------|
| Frontend | {{e.g., React}} | {{18.2.0}} | {{Existing stack / User preference / Performance}} |
| Backend | {{e.g., FastAPI}} | {{0.100.0}} | {{...}} |
| Database | {{e.g., PostgreSQL}} | {{15.0}} | {{...}} |
| Build | {{e.g., Vite}} | {{5.0.0}} | {{...}} |

### Key Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| {{package1}} | {{version}} | {{why needed}} |
| {{package2}} | {{version}} | {{why needed}} |

---

## Existing Architecture

### Relevant Patterns

<!-- ACTION REQUIRED: Identify patterns with file evidence -->

| Pattern | Location | Evidence |
|---------|----------|----------|
| {{State Management}} | `src/stores/` | {{Found Zustand stores}} |
| {{API Layer}} | `src/api/` | {{RESTful endpoints}} |
| {{Component Structure}} | `src/components/` | {{Atomic design pattern}} |

### Code Structure

```
src/
├── components/     # {{Description}}
├── services/       # {{Description}}
├── stores/         # {{Description}}
└── api/            # {{Description}}
```

---

## Affected Files Analysis

### Files to CREATE

| File | Purpose | Estimated Size |
|------|---------|----------------|
| `{{path/to/new.tsx}}` | {{What it does}} | {{~100 lines}} |

### Files to MODIFY

| File | Changes | Risk |
|------|---------|------|
| `{{path/to/existing.ts}}` | {{What changes}} | 🟢 Low / 🟡 Medium / 🔴 High |

### Files to DELETE (if any)

| File | Reason |
|------|--------|
| {{None expected}} | - |

---

## Technical Constraints

<!-- ACTION REQUIRED: List actual constraints discovered -->

- [ ] {{Constraint 1: e.g., Must maintain backward compatibility with v2 API}}
- [ ] {{Constraint 2: e.g., No new dependencies without approval}}
- [ ] {{Constraint 3: e.g., Must support existing auth tokens}}
- [ ] {{Constraint 4: [NEEDS CLARIFICATION: ...] — if any}}

---

## Recommended Approach

### Strategy

{{Brief description of the recommended implementation approach}}

### Why This Approach

<!-- ACTION REQUIRED: Justify with evidence from codebase analysis -->

| Factor | Reasoning |
|--------|-----------|
| Fits existing patterns | {{Matches current component structure in X}} |
| Minimal disruption | {{Only modifies N files}} |
| Scalable | {{Can extend to support future Y}} |

### Alternatives Considered

| Alternative | Rejected Because |
|-------------|------------------|
| {{Option B}} | {{Reason}} |
| {{Option C}} | {{Reason}} |

### Risks & Mitigations

| Risk | Level | Mitigation |
|------|-------|------------|
| {{Risk 1}} | 🟡 Medium | {{How to handle}} |

---

## Open Questions

<!-- ACTION REQUIRED: List anything needing user clarification -->

- [ ] {{Question 1: [NEEDS CLARIFICATION: ...]}}
- [ ] {{Question 2: Technical decision pending}}

---

## Quality Self-Check

Before marking complete, verify:

- [ ] Tech stack has actual version numbers (not placeholders)
- [ ] All patterns cited have file evidence
- [ ] Affected files include specific paths
- [ ] Constraints are project-specific (not generic)
- [ ] Recommended approach has clear rationale
- [ ] Risks are identified with mitigations

---

## → Next Phase

**Output**: This research.md  
**Next**: requirements.md (Phase 2)  
**Handoff**: Ready for `ouroboros-requirements` agent
