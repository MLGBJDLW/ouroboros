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

| Layer | Technology | Version | Config File |
|-------|------------|---------|-------------|
| Language | {{e.g., TypeScript}} | {{5.3.0}} | `tsconfig.json` |
| Frontend | {{e.g., React}} | {{18.2.0}} | `package.json` |
| Backend | {{e.g., FastAPI}} | {{0.100.0}} | `pyproject.toml` |
| Database | {{e.g., PostgreSQL}} | {{15.0}} | `docker-compose.yml` |
| Build | {{e.g., Vite}} | {{5.0.0}} | `vite.config.ts` |
| Test | {{e.g., Vitest}} | {{1.0.0}} | `vitest.config.ts` |

### Key Dependencies

| Package | Version | Purpose | Used In |
|---------|---------|---------|---------|
| {{package1}} | {{version}} | {{why needed}} | `{{file.ts}}` |
| {{package2}} | {{version}} | {{why needed}} | `{{file.ts}}` |

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

## Existing Tests

<!-- ACTION REQUIRED: Document current test coverage and patterns -->

| Test Type | Framework | Location | Coverage |
|-----------|-----------|----------|----------|
| Unit | {{Vitest/Jest}} | `tests/unit/` | {{~80%}} |
| Integration | {{Playwright/Cypress}} | `tests/e2e/` | {{~50%}} |
| API | {{Supertest}} | `tests/api/` | {{~70%}} |

### Test Commands

```bash
# Run all tests
{{npm test / pytest}}

# Run with coverage
{{npm run test:coverage / pytest --cov}}
```

---

## API & External Integrations

<!-- ACTION REQUIRED: Document existing APIs this feature will interact with -->

### Internal APIs

| Endpoint | Method | Purpose | Auth |
|----------|--------|---------|------|
| `{{/api/users}}` | GET | {{List users}} | {{Bearer token}} |
| `{{/api/items}}` | POST | {{Create item}} | {{API key}} |

### External Services

| Service | Purpose | SDK/Client | Docs |
|---------|---------|------------|------|
| {{Stripe}} | {{Payments}} | `stripe-js` | {{URL}} |
| {{Auth0}} | {{Authentication}} | `@auth0/auth0-spa-js` | {{URL}} |

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

## Integration Entry Points

<!-- ACTION REQUIRED: Identify HOW this feature will be wired into the existing system -->

### System Entry Points

| Entry Point Type | Current Location | How to Integrate | Evidence |
|------------------|------------------|------------------|----------|
| Main App Entry | `{{src/main.tsx}}` | {{Import and initialize}} | Line {{N}} |
| Router/Navigation | `{{src/router/index.ts}}` | {{Add new route}} | Route config |
| Config Registry | `{{src/config/features.ts}}` | {{Add feature flag}} | Features object |
| Navigation UI | `{{src/components/Sidebar.tsx}}` | {{Add nav item}} | Menu array |

### Existing Patterns for Integration

<!-- Look for how other features are integrated and follow the same pattern -->

| Similar Feature | Integration Pattern | Files Involved |
|-----------------|--------------------|--------------------|
| {{Auth}} | {{Registered in router, added to menu}} | `router.ts`, `Menu.tsx` |
| {{Settings}} | {{Config-driven, lazy loaded}} | `config.ts`, `routes.ts` |

### Integration Constraints

- [ ] {{Must follow existing routing pattern}}
- [ ] {{Must use existing auth context}}
- [ ] {{Must register in feature flag system}}

---

## Performance Baseline

<!-- ACTION REQUIRED: Document current performance metrics if relevant -->

| Metric | Current Value | Target | Measurement |
|--------|---------------|--------|-------------|
| Page Load | {{1.2s}} | {{< 1s}} | Lighthouse |
| API Response | {{200ms}} | {{< 150ms}} | Network tab |
| Bundle Size | {{450KB}} | {{< 500KB}} | Build output |

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
- [ ] Existing tests documented with coverage
- [ ] API endpoints listed (if applicable)
- [ ] Performance baseline recorded (if applicable)
- [ ] Constraints are project-specific (not generic)
- [ ] Recommended approach has clear rationale
- [ ] Risks are identified with mitigations

---

## → Next Phase

**Output**: This research.md  
**Next**: requirements.md (Phase 2)  
**Handoff**: Ready for `ouroboros-requirements` agent
