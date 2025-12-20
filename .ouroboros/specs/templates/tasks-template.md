# Tasks: {{FEATURE_NAME}}

> **Phase**: 4/5 - Tasks  
> **Input**: [research.md](./research.md), [requirements.md](./requirements.md), [design.md](./design.md)  
> **Created**: {{DATE}}  
> **Status**: ⬜ Not Started | 🔄 In Progress | ✅ Complete

---

## Progress Summary

| Phase | Tasks | Effort | Status |
|-------|-------|--------|--------|
| Phase 1: Setup | 0/{{N}} | {{X}}h | ⬜ |
| Phase 2: Foundational | 0/{{N}} | {{X}}h | ⬜ |
| Phase 3: REQ-001 (P1) | 0/{{N}} | {{X}}h | ⬜ |
| Phase 4: REQ-002 (P1) | 0/{{N}} | {{X}}h | ⬜ |
| Phase 5: REQ-003 (P2) | 0/{{N}} | {{X}}h | ⬜ |
| Phase 6: Integration | 0/{{N}} | {{X}}h | ⬜ |
| Phase 7: Polish | 0/{{N}} | {{X}}h | ⬜ |
| **Total** | **0/{{N}}** | **{{Total}}h** | **0%** |

### Effort Conversion

| Size | Hours | Count | Subtotal |
|------|-------|-------|----------|
| S | 0.5h | {{N}} | {{X}}h |
| M | 1.5h | {{N}} | {{X}}h |
| L | 3h | {{N}} | {{X}}h |
| **Total** | - | **{{N}}** | **{{Total}}h** |

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [ ] **T001** Create project structure per design.md
  - File: `{{path/to/folder}}`
  - Effort: S
  - Done When: Folder structure matches design.md

- [ ] **T002** [P] Initialize dependencies
  - File: `package.json` / `pyproject.toml`
  - Effort: S
  - Done When: `npm install` / `pip install` succeeds

- [ ] **T003** [P] Configure linting/formatting
  - File: `.eslintrc`, `.prettierrc`
  - Effort: S
  - Done When: `npm run lint` passes

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before requirement work

<!-- ACTION REQUIRED: Identify what blocks ALL requirements -->

⚠️ **CRITICAL**: No requirement tasks can begin until this phase is complete

- [ ] **T004** {{Setup shared service/store}}
  - File: `{{path/to/file}}`
  - Effort: M
  - Blocks: All REQ-XXX tasks
  - Done When: {{Service can be imported and instantiated}}
  
- [ ] **T005** [P] {{Setup error handling}}
  - File: `{{path/to/file}}`
  - Effort: S
  - Done When: {{Error boundary catches and displays errors}}

- [ ] **T006** [P] {{Setup logging}}
  - File: `{{path/to/file}}`
  - Effort: S
  - Done When: {{Logs appear in console/file}}

🔍 **CHECKPOINT**: Foundation ready — requirement implementation can begin

---

## Phase 3: REQ-001 — {{Title}} (Priority: P1) 🎯 MVP

**Goal**: {{Brief description from requirements.md}}

**Independent Test**: {{From requirements.md — how to verify}}

**Acceptance Criteria**: 
- AC-001-1: {{From requirements.md}}
- AC-001-2: {{From requirements.md}}

### Implementation

- [ ] **T007** [P] [REQ-001] Create {{model/entity}}
  - File: `{{path/to/model.ts}}`
  - Effort: S
  - Done When: {{Interface/type exported and importable}}
  
- [ ] **T008** [P] [REQ-001] Create {{service}}
  - File: `{{path/to/service.ts}}`
  - Depends: T007
  - Effort: M
  - Done When: {{Service methods return expected data}}

- [ ] **T009** [REQ-001] Implement {{main feature}}
  - File: `{{path/to/component.tsx}}`
  - Depends: T008
  - Effort: M
  - Done When: {{Feature visible and functional in UI}}

- [ ] **T010** [REQ-001] Add error handling
  - File: `{{path/to/component.tsx}}`
  - Effort: S
  - Done When: {{Error states display correctly}}

- [ ] **T011** [REQ-001] Write unit tests
  - File: `tests/{{path}}`
  - Effort: M
  - Done When: {{All tests pass, coverage > 80%}}

🔍 **CHECKPOINT**: REQ-001 complete — verify against acceptance criteria

---

## Phase 4: REQ-002 — {{Title}} (Priority: P1)

**Goal**: {{Brief description}}

**Independent Test**: {{...}}

**Acceptance Criteria**: 
- AC-002-1: {{...}}

### Implementation

- [ ] **T012** [P] [REQ-002] {{Task description}}
  - File: `{{path}}`
  - Effort: S
  - Done When: {{...}}

- [ ] **T013** [REQ-002] {{Task description}}
  - File: `{{path}}`
  - Depends: T012
  - Effort: M
  - Done When: {{...}}

🔍 **CHECKPOINT**: REQ-002 complete — verify against acceptance criteria

---

## Phase 5: REQ-003 — {{Title}} (Priority: P2)

**Goal**: {{Brief description}}

**Independent Test**: {{...}}

**Acceptance Criteria**: 
- AC-003-1: {{...}}

### Implementation

- [ ] **T014** [REQ-003] {{Task description}}
  - File: `{{path}}`
  - Effort: M
  - Done When: {{...}}

🔍 **CHECKPOINT**: REQ-003 complete — verify against acceptance criteria

---

## Phase 6: Integration & Wiring

**Purpose**: Connect the feature to existing system entry points

⚠️ **CRITICAL**: Feature is NOT complete until this phase passes! A feature without integration is INCOMPLETE.

### Route/Entry Point Registration

- [ ] **T0XX** [INTEGRATE] Register in main router/app entry
  - File: `{{src/router/index.ts}}` or `{{src/main.tsx}}`
  - Change: Import component and add route `"/{{feature}}": FeaturePage`
  - Effort: S
  - Done When: Navigating to `/{{feature}}` loads the new page

### Navigation UI

- [ ] **T0XX** [P] [INTEGRATE] Add to navigation menu/sidebar
  - File: `{{src/components/Sidebar.tsx}}` or `{{src/components/Menu.tsx}}`
  - Change: Add menu item with icon and label
  - Effort: S
  - Done When: Menu shows new item, clicking navigates correctly

### Configuration

- [ ] **T0XX** [P] [INTEGRATE] Add feature flag (if applicable)
  - File: `{{src/config/features.ts}}` or `{{src/config/index.ts}}`
  - Change: Add `{{FEATURE_NAME}}: boolean`
  - Effort: S
  - Done When: Feature can be toggled via config

### Type/Module Exports

- [ ] **T0XX** [P] [INTEGRATE] Export types from barrel file
  - File: `{{src/types/index.ts}}`
  - Change: `export * from './{{feature}}'` or `export type { ... }`
  - Effort: S
  - Done When: Types importable from `@/types`

- [ ] **T0XX** [INTEGRATE] Register module/service (if applicable)
  - File: `{{src/services/index.ts}}` or `{{src/modules/index.ts}}`
  - Change: Import and register in service container/registry
  - Effort: S
  - Done When: Service injectable/accessible from other modules

🔍 **CHECKPOINT**: Integration complete — feature accessible from main app entry point

---

## Phase 7: Polish & Cross-Cutting

**Purpose**: Improvements affecting multiple requirements

- [ ] **T015** [P] Documentation updates
  - File: `README.md`, `docs/`
  - Effort: M
  - Done When: {{README reflects new feature}}
  
- [ ] **T016** Code cleanup and refactoring
  - File: Various
  - Effort: S
  - Done When: {{No linting errors, no TODOs}}

- [ ] **T017** Final integration testing
  - File: `tests/e2e/`
  - Effort: M
  - Done When: {{All E2E tests pass}}

🔍 **FINAL CHECKPOINT**: All requirements verified against acceptance criteria

---

## Rollback Plan

<!-- ACTION REQUIRED: Define how to revert if something goes wrong -->

| Phase | Rollback Strategy | Command/Action |
|-------|-------------------|----------------|
| Setup | Delete created files | `git checkout .` |
| Foundational | Revert commits | `git revert HEAD~N` |
| REQ-001 | Feature flag disable | Set `FEATURE_X=false` |
| REQ-002 | Revert commits | `git revert HEAD~N` |
| Full Rollback | Reset to tag | `git reset --hard v{{previous}}` |

---

## Task Legend

| Symbol | Meaning |
|--------|---------|
| `[ ]` | Not started |
| `[/]` | In progress |
| `[x]` | Complete |
| `[-]` | Blocked / Skipped |
| `[P]` | Can run in parallel (different files) |
| `[REQ-XXX]` | Traces to requirement |

### Effort Sizing

| Size | Time | Examples |
|------|------|----------|
| **S** | 0.5h (< 30 min) | Add field, fix typo, simple test |
| **M** | 1.5h (30-120 min) | New component, refactor, API endpoint |
| **L** | 3h (> 120 min) | Major feature, complex integration |

---

## Dependencies & Execution Order

### Critical Path

```mermaid
graph LR
    T001[Setup] --> T004[Foundational]
    T004 --> T007[REQ-001]
    T007 --> T012[REQ-002]
    T012 --> T014[REQ-003]
    T014 --> T015[Polish]
```

### Parallel Opportunities

| Phase | Parallel Tasks | Why Parallel |
|-------|----------------|--------------|
| Setup | T002, T003 | Different files |
| Foundational | T005, T006 | Independent utilities |
| REQ-001 | T007, T008 | Model and service separate |

---

## Implementation Strategy

### MVP First (Recommended)

1. Complete Setup + Foundational
2. Complete all P1 requirements (REQ-001, REQ-002)
3. **STOP and VALIDATE** — Test MVP against acceptance criteria
4. Continue with P2/P3 if time permits

### Estimated Timeline

| Day | Tasks | Hours |
|-----|-------|-------|
| Day 1 | T001-T006 (Setup + Foundation) | {{X}}h |
| Day 2 | T007-T011 (REQ-001) | {{X}}h |
| Day 3 | T012-T013 (REQ-002) | {{X}}h |
| Day 4 | T014-T017 (REQ-003 + Polish) | {{X}}h |

---

## Quality Self-Check

Before marking complete, verify:

- [ ] All tasks have `[REQ-XXX]` traceability
- [ ] All tasks have specific file paths
- [ ] All tasks have `Done When` criteria
- [ ] All tasks have effort estimates (S/M/L)
- [ ] Effort summary table is accurate
- [ ] Dependencies are in correct order
- [ ] Checkpoints exist between phases
- [ ] Parallel tasks marked with `[P]`
- [ ] Rollback plan is defined
- [ ] Critical path diagram is accurate

---

## → Next Phase

**Output**: This tasks.md  
**Next**: validation-report.md (Phase 5)  
**Handoff**: Ready for `ouroboros-validator` agent
