# Tasks: {{FEATURE_NAME}}

> **Phase**: 4/5 - Tasks  
> **Input**: [research.md](./research.md), [requirements.md](./requirements.md), [design.md](./design.md)  
> **Created**: {{DATE}}  
> **Status**: ⬜ Not Started | 🔄 In Progress | ✅ Complete

---

## Progress Summary

| Phase | Tasks | Status |
|-------|-------|--------|
| Phase 1: Setup | 0/{{N}} | ⬜ |
| Phase 2: Foundational | 0/{{N}} | ⬜ |
| Phase 3: REQ-001 (P1) | 0/{{N}} | ⬜ |
| Phase 4: REQ-002 (P1) | 0/{{N}} | ⬜ |
| Phase 5: REQ-003 (P2) | 0/{{N}} | ⬜ |
| Phase 6: Polish | 0/{{N}} | ⬜ |
| **Total** | **0/{{N}}** | **0%** |

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [ ] **T001** Create project structure per design.md
- [ ] **T002** [P] Initialize dependencies
- [ ] **T003** [P] Configure linting/formatting

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before requirement work

<!-- ACTION REQUIRED: Identify what blocks ALL requirements -->

⚠️ **CRITICAL**: No requirement tasks can begin until this phase is complete

- [ ] **T004** {{Setup shared service/store}}
  - File: `{{path/to/file}}`
  - Blocks: All REQ-XXX tasks
  
- [ ] **T005** [P] {{Setup error handling}}
  - File: `{{path/to/file}}`

- [ ] **T006** [P] {{Setup logging}}
  - File: `{{path/to/file}}`

🔍 **CHECKPOINT**: Foundation ready — requirement implementation can begin

---

## Phase 3: REQ-001 — {{Title}} (Priority: P1) 🎯 MVP

**Goal**: {{Brief description from requirements.md}}

**Independent Test**: {{From requirements.md — how to verify}}

### Implementation

- [ ] **T007** [P] [REQ-001] Create {{model/entity}}
  - File: `{{path/to/model.ts}}`
  - Effort: S
  
- [ ] **T008** [P] [REQ-001] Create {{service}}
  - File: `{{path/to/service.ts}}`
  - Depends: T007
  - Effort: M

- [ ] **T009** [REQ-001] Implement {{main feature}}
  - File: `{{path/to/component.tsx}}`
  - Depends: T008
  - Effort: M

- [ ] **T010** [REQ-001] Add error handling
  - File: `{{path/to/component.tsx}}`
  - Effort: S

- [ ] **T011** [REQ-001] Write unit tests
  - File: `tests/{{path}}`
  - Effort: M

🔍 **CHECKPOINT**: REQ-001 complete — can be tested independently

---

## Phase 4: REQ-002 — {{Title}} (Priority: P1)

**Goal**: {{Brief description}}

**Independent Test**: {{...}}

### Implementation

- [ ] **T012** [P] [REQ-002] {{Task description}}
  - File: `{{path}}`
  - Effort: S

- [ ] **T013** [REQ-002] {{Task description}}
  - File: `{{path}}`
  - Depends: T012
  - Effort: M

🔍 **CHECKPOINT**: REQ-002 complete

---

## Phase 5: REQ-003 — {{Title}} (Priority: P2)

**Goal**: {{Brief description}}

**Independent Test**: {{...}}

### Implementation

- [ ] **T014** [REQ-003] {{Task description}}
  - File: `{{path}}`
  - Effort: M

🔍 **CHECKPOINT**: REQ-003 complete

---

## Phase 6: Polish & Cross-Cutting

**Purpose**: Improvements affecting multiple requirements

- [ ] **T015** [P] Documentation updates
  - File: `README.md`, `docs/`
  
- [ ] **T016** Code cleanup and refactoring

- [ ] **T017** Final integration testing

🔍 **FINAL CHECKPOINT**: All requirements verified

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
| **S** | < 30 min | Add field, fix typo, simple test |
| **M** | 30-120 min | New component, refactor, API endpoint |
| **L** | > 120 min | Major feature, complex integration |

---

## Dependencies & Execution Order

### Critical Path

```
Setup → Foundational → REQ-001 (P1) → REQ-002 (P1) → REQ-003 (P2) → Polish
```

### Parallel Opportunities

- All `[P]` tasks can run simultaneously
- After Foundational: P1 requirements can start in parallel
- P2/P3 requirements can wait or run in parallel based on capacity

---

## Implementation Strategy

### MVP First (Recommended)

1. Complete Setup + Foundational
2. Complete all P1 requirements
3. **STOP and VALIDATE** — Test MVP independently
4. Continue with P2/P3 if time permits

---

## Quality Self-Check

Before marking complete, verify:

- [ ] All tasks have `[REQ-XXX]` traceability
- [ ] All tasks have specific file paths
- [ ] Dependencies are in correct order
- [ ] Checkpoints exist between phases
- [ ] Parallel tasks marked with `[P]`
- [ ] Effort estimates provided

---

## → Next Phase

**Output**: This tasks.md  
**Next**: validation-report.md (Phase 5)  
**Handoff**: Ready for `ouroboros-validator` agent
