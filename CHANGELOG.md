# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.1.11] - 2025-12-18

### Fixed
- **Question Context Persistence** — Fixed issue where question text disappeared after selecting "[Custom input...]" from a selection menu. The question now remains visible in the custom input TUI header.

---

## [3.1.10] - 2025-12-18

### Added
- **CCL Question Text Integration** — LLM agents can now include contextual question text directly in CCL commands using `print('question')` before options:
  - **Type A+Q: TASK with Inquiry** — New variant for asking questions before receiving general input
  - **6 Output Types** — Upgraded from 5 types (TASK, MENU, CONFIRM, FEATURE, QUESTION → add TASK+Q)
  - **`--question` CLI Argument** — New parameter for `ouroboros_input.py` to display question text in TUI header

- **TUI Word-Wrap Support** — Question text auto-wraps to fit terminal width:
  - `WelcomeBox` — Added `_wrap_text()` method with multi-line rendering + separator line
  - `SelectionMenu` — Title/question now wraps across multiple lines with dynamic height calculation + separator line
  - **Visual Separator** — Horizontal line (`───`) between question and options/input for clarity

### Changed
- **All Level 1 Orchestrator CCL Examples** — Updated with question text in `python -c` format:
  - `ouroboros-spec.agent.md` — 3 locations
  - `ouroboros-init.agent.md` — 1 location
  - `ouroboros-implement.agent.md` — 3 locations
  - `ouroboros-archive.agent.md` — 2 locations

- **Toggle Script Patterns** — Updated `PATTERNS` dictionary in `ouroboros_toggle.py`:
  - Added `Type A_Q` for TASK with question
  - Types B, C, D, E now capture question from initial `print()` statement
  - Enhanced mode uses `--question` parameter
  - **Bidirectional Conversion** — Full support for converting all 6 types between DEFAULT and ENHANCED modes
  - **Simple Format Support** — Added patterns for `print('Q'); var = input('P')` format

- **Documentation Updates**:
  - `copilot-instructions.md` — Added Question Text tip block, updated output types table
  - `ouroboros.agent.md` — Renamed "FIVE OUTPUT TYPES" to "SIX OUTPUT TYPES" with new examples

---

## [3.1.9] - 2025-12-16

### Added
- **GPT Compliance Rules** — Enhanced `copilot-instructions.md` with explicit behavior rules for better OpenAI GPT model compliance:
  - **EXIT TRIGGERS** — Only explicit commands (`quit`/`exit`/`stop`) end session; `thanks`/`ok` continue CCL
  - **INPUT ROUTING** — Table mapping user input types to required actions (delegate, continue, clarify, etc.)

### Changed
- **Spec Agents Template Workflow** — All 5 spec workflow agents now use **Copy-then-Modify** pattern instead of Read→Create:
  - `ouroboros-researcher`, `ouroboros-requirements`, `ouroboros-architect`, `ouroboros-tasks`, `ouroboros-validator`
  - Workflow: COPY template → MODIFY by filling placeholders → PRESERVE structure

- **Spec Templates Enhancement** — Major upgrade to all 5 spec templates (inspired by Spec-kit patterns):
  - **Unified Placeholder Format**: `{{PLACEHOLDER}}` for clear fill-in markers
  - **Action Comments**: `<!-- ACTION REQUIRED: ... -->` for critical sections
  - **Cross-Doc References**: `**Input**: [previous-phase.md]` headers linking phases
  - **Quality Self-Checks**: Each template ends with verification checklist
  - **Priority System**: P1/P2/P3 labels + "Why This Priority" rationale (requirements)
  - **Parallel Markers**: `[P]` tags for tasks that can run concurrently (tasks)
  - **REQ Traceability**: `[REQ-XXX]` tags linking tasks back to requirements
  - **Independent Tests**: Each requirement includes verification method
  - **`[NEEDS CLARIFICATION: ...]`**: Explicit uncertainty markers
  - **ADR-style Decisions**: "Why This Approach" + "Alternatives Rejected" sections (design)

- **Requirements Clarification Q&A Flow** — New interactive clarification process for Phase 2:
  - `ouroboros-requirements` outputs structured `CLQ-XXX` questions with 2-4 options + expert recommendation
  - `ouroboros-spec` presents questions **ONE BY ONE** using MENU format (not all at once)
  - After user answers, delegates to `ouroboros-writer` to update requirements.md
  - New **Phase 2.5** in spec workflow for handling clarifications


---



## [3.1.8] - 2025-12-16


### Fixed
- **Multi-line History Persistence** — Fixed input history saving/loading that was splitting multi-line entries into separate single-line entries. Now multi-line inputs are properly preserved as single history entries when navigating with Up/Down arrow keys.
  - Added `_escape()` / `_unescape()` methods in `data/history.py` to encode newlines as `\n` markers in the history file

---

## [3.1.7] - 2025-12-16

### Fixed
- **Arrow Key Direction** — Fixed reversed LEFT/RIGHT arrow key ANSI escape codes in `tui/app.py` that caused cursor movement to go in the opposite direction

---


## [3.1.5] - 2025-12-15

### Added
- **Text Wrapping Utility** — New `wrap_text()` function in `utils/text.py` for proper CJK-aware text wrapping with display width calculation

### Fixed
- **Input Box Shrinking** — Fixed `_shrink_height()` to correctly delete extra content lines when the input box shrinks, preventing ghost lines
- **Slash Command Completion** — Fixed `SlashCommandHandler.complete()` to properly return completed command with space suffix and cancel mode
- **Full Render on Char Input** — Added full `_render()` call after single-character input to keep wrapping, cursor positioning, and status bar consistent
- **Status Hint After Completion** — Slash command completion now restores "Ctrl+D: submit" hint after inserting completed command

---

## [3.1.2] - 2025-12-15

### Added
- **Skills Discovery (Optional)** — Level 2 worker agents can now optionally check for skill files in `.claude/skills/` (Claude) or `.cursor/skills/` (Cursor) on task start
  - Skills are loaded on-demand if the directory exists
  - Missing skills directories are gracefully ignored
  - Orchestrators (Level 0 & 1) delegate to Level 2, not use skills directly

---

## [3.1.0] - 2025-12-15

### Added
- **Anti-Recursion Protocol** — Level-based agent hierarchy (L0 → L1 → L2) preventing infinite delegation loops
- **Slash Command Autocomplete** — Type `/` in Enhanced CCL for orchestrator mode switching (Tab to complete)
- **File Badge Rendering** — Drag & drop files display as `[ filename.ext ]` in UI (full path sent to AI)
- **Folder Badge Rendering** — Drag & drop folders display as `[ foldername ]` in UI
- **Project Structure Check** — Agents now detect `.ouroboros/specs/` on invoke
- **docs/LIMITATIONS.md** — Documents known platform constraints
- **Ctrl+V Clipboard Paste** — Reliable paste detection by reading clipboard directly
  - Large pastes (5+ lines) show as `[ Pasted N Lines ]` badge
  - Full content preserved and sent to AI on submit
  - Cross-platform: Windows (ctypes), macOS (pbpaste), Linux (xclip/xsel/wl-paste)
- **Atomic Badge Deletion** — Backspace/Delete removes entire badge at once (file paths and paste badges)
- **Arrow Key Badge Navigation** — Cursor automatically skips past badge internals when navigating
- **Property-Based Testing Framework** — `tests/pbt_framework.py` with Hypothesis-style generators

### Changed
- **Complete Modular Rewrite** — Refactored `ouroboros_input.py` (~2000 lines) into clean package structure:
  | Package | Modules | Purpose |
  |---------|---------|---------|
  | `components/` | `input_box`, `selection_menu`, `status_bar`, `welcome_box` | UI Components |
  | `data/` | `buffer`, `config`, `history` | Data Management |
  | `input/` | `clipboard`, `commands`, `keybuffer`, `keybuffer_win`, `keybuffer_unix`, `paste` | Input Handling |
  | `tui/` | `app`, `fallback`, `output`, `screen`, `theme`, `window` | Terminal UI |
  | `utils/` | `badge`, `filepath`, `text` | Utilities |
  | `tests/` | `unit/`, `property/`, `pbt_framework` | Testing |
- All 16 agent files now include Level markers (`> **LEVEL X** — ...`)
- `is_file_path()` now detects both files and folders (directories without extensions)
- Scripts README completely rewritten with detailed documentation
- Root README Enhanced CCL section simplified (details moved to scripts/README.md)
- Removed legacy single-file modules: `ouroboros_buffer.py`, `ouroboros_clipboard.py`, `ouroboros_commands.py`, `ouroboros_config.py`, `ouroboros_filepath.py`, `ouroboros_keybuffer.py`, `ouroboros_paste.py`, `ouroboros_screen.py`, `ouroboros_toggle.py`, `ouroboros_ui.py`
- Removed old test scripts in favor of new `tests/` package structure

### Fixed
- **Paste Badge Navigation** — Fixed cursor navigation for paste markers (`‹PASTE:N›...‹/PASTE›`), now correctly skips entire badge as atomic unit
- **Paste Badge Backspace** — Backspace now correctly deletes entire paste badge when cursor is at badge end
- **Cursor Position Calculation** — `_get_cursor_display_col()` now correctly calculates display position for both file markers (`«path»`) and paste markers
- **Badge Detection Consistency** — All badge operations (move_left, move_right, backspace, delete) now handle both file and paste marker types
- **Multiline Threshold** — Fixed `process_pasted_content()` default threshold from 2 to 5 lines (matching `PASTE_LINE_THRESHOLD`)
- **Windows Paste Detection** — Added event count detection in `_main_loop()` to catch pastes before bracketed paste mode (threshold lowered to 5 events)
- **Ctrl+V Paste Detection (Windows Terminal)** — Detect Ctrl+V even when the terminal intercepts it, read clipboard directly, and prevent duplicate injected characters
- **Path Collection Display** — Characters are now displayed in buffer while collecting path, then converted to badge on timeout
- **Path Badge Prefix** — Fixed drive letter prefix tracking (`D:`) to ensure full path is captured in badge
- **Split Drive-Letter Paste** — Fixed cases where a path paste is split into `D` + `:\\...`, causing the drive letter to be dropped from the badge
- **Arrow Keys in VS Code Terminal** — Fixed escape sequence handling in `PasteCollector.read()` that was breaking arrow key navigation on Windows
- **Bracketed Paste Output Purity** — Bracketed paste enable/disable sequences now write to stderr, keeping stdout clean for AI consumption
- **Slash Command Status Clearing** — Status bar now clears correctly after backspacing away slash commands
- **Cursor Flickering** — Fixed cursor jumping to wrong positions during render by using save/restore cursor pattern
- **Incremental Line Update** — Added `update_current_line()` for single-character input to reduce full redraws
- **Windows Path Drag-Drop** — Pattern-based path detection (checks file extension/existence) instead of timeout-only
- **Ctrl+V Paste Badge** — `_handle_paste()` now uses `process_pasted_content()` for immediate badge display
- **Input Box Shrink Ghosting** — Removed stale bottom border/status lines when the input box shrinks in ANSI fallback mode
- **Submit Feedback Missing** — Restored `OutputBox` class in `output.py` and added `render_transmitted()` to show "✓ Transmitted to Copilot" feedback on submit
- **Submit Task Box** — After submit, render a visible `[>] TASK` box with a safe preview + transmission stats (stderr), while sending the full payload to Copilot via stdout

---

## [3.0.3] - 2025-12-13

### Added
- **AGENTS.md** — Comprehensive development guidelines for AI assistants working on Ouroboros
  - Hub-and-Spoke architecture constraints with strict delegation rules
  - Complete CCL Five Output Types reference (Type A-E)
  - `runSubagent()` mandatory usage with format examples
  - Action-Commitment rule with correct/wrong examples
  - Forbidden patterns and phrases enforcement
  - Development guidelines for modifying/adding agents
  - Key protocols reference table

### Changed
- **Toggle Script** — Updated `ouroboros_toggle.py` to scan root directory
  - Now includes `AGENTS.md` when switching between Default/Enhanced CCL modes
  - Added `Path(".")` to `SEARCH_DIRS` for root-level markdown files

### Documentation
- AGENTS.md serves as steering rules for Copilot and other AI tools
- Ensures consistent architecture enforcement across all AI interactions
- Provides clear examples of correct delegation patterns

---

## [3.0.1] - 2025-12-13

### Fixed
- **Windows Arrow Keys** — Fixed `'\x00'` char handling in Console API
- **Menu Refresh** — In-place update, no more flickering
- **Text Overflow** — Long titles wrap, options truncate with `...`
- **[y/n] Prompts** — Now show interactive Yes/No menu
- **InputBox Scrolling** — Max 10 lines, then internal scroll

### Added
- **Menu Scrolling** — Auto-scroll with `↑ N more above` / `↓ N more below`
- **Page Up/Down** — Jump by page in long menus
- **Home/End** — Jump to first/last option
- **Escape to Cancel** — Alternative to Ctrl+C
- **Test Suite** — 200+ tests in `.ouroboros/scripts/test/`
- **CI/CD Tests** — GitHub Actions (Win/Linux/Mac × Py 3.8/3.11)
- **Changelog Generator** — `.github/scripts/generate-changelog.sh`

### Changed
- **English-Only UI** — `[y/n]` shows `Yes`/`No` only
- **Prompt Optimization** — Streamlined instruction and orchestrator prompts for better LLM compatibility while maintaining quality

---

## [3.0.0] - 2025-12-12

### 🎨 Enhanced CCL Input System & CI/CD

Major milestone release introducing the Enhanced Continuous Command Loop (CCL) input system and GitHub Actions automation.

#### Added
- **GitHub Actions CI/CD** — Automated markdown validation, structure checking, and release automation
  - `ci.yml`: Runs on PR/push to `main`/`dev` — validates markdown, checks project structure, verifies links
  - `release.yml`: Creates GitHub Releases when `v*` tags are pushed
- **Enhanced Input Scripts** — `.ouroboros/scripts/` with:
  - Mystic Purple themed terminal UI
  - Display compression for large pastes
  - Auto multi-line detection
  - File/image drag detection
  - Command history persistence
- **Toggle System** — Easy switch between default and enhanced input modes via `ouroboros_toggle.py`

#### Changed
- Version bump to 3.0 to mark Enhanced CCL Scripts as stable feature
- README badges updated to v3.0 with CI status badge

#### Technical Notes
- Zero external dependencies maintained (Python stdlib only)
- All scripts require Python 3.6+
- CHANGELOG updates remain **manual** for precision

---

## [2.2.0] - 2025-12-12

### 📌 Agent Communication Protocol Upgrade

Minimal, backward-compatible upgrade to agent response formats and dispatch protocols.

#### Added
- **Status Field** — All 13 worker agents now include `📌 Status: OK | PARTIAL | FAIL | BLOCKED` in their response headers
- **Dispatch Metadata** — Entry points (`spec`, `implement`, `init`) now include structured metadata in dispatch prompts:
  ```
  [Feature]: auth-system
  [Spec]: .ouroboros/specs/auth-system/
  [Phase]: 1/5 - Research
  ```
- **Phase Numbering** — `spec` response format now shows `2/5 - Requirements` instead of just `Requirements`
- **Non-Interactive Command Guidelines** — Added comprehensive reference tables to `coder`, `qa`, `devops`:
  | Tool | ❌ Interactive | ✅ Non-Interactive |
  |------|---------------|--------------------|
  | pnpm test | `pnpm test` (waits h/q) | `pnpm test --run` or `CI=true pnpm test` |
  | vitest | `vitest` (watch mode) | `vitest run` |
  | jest | `jest --watch` | `jest --ci` |

#### Changed
- **13 Agent Files Updated** — All worker agents now have Status field in response format
- **3 Dispatch Formats Enhanced** — `spec`, `implement`, `init` now include context metadata

#### Technical Notes
- All changes are **additive** — no existing fields removed
- Changes are **backward compatible** — old format still readable
- `archive` agent unchanged — already had complete format

---

## [2.1.0] - 2025-12-12

### 🔄 Workflow Orchestrator Architecture

Introduced dedicated **Workflow Orchestrators** — sub-orchestrators that manage major workflows while inheriting CCL enforcement and delegation rules from the main orchestrator.

#### Added
- **4 New Workflow Agents** — Created specialized orchestrators for each major workflow:
  | Agent | Purpose |
  |-------|---------|
  | `ouroboros-init` | Project initialization workflow |
  | `ouroboros-spec` | 5-phase spec creation workflow |
  | `ouroboros-implement` | Task execution workflow |
  | `ouroboros-archive` | Archive management workflow |

- **Prompt-to-Agent Routing** — Each prompt file now routes to its dedicated agent:
  - `ouroboros-init.prompt.md` → `agent: ouroboros-init`
  - `ouroboros-spec.prompt.md` → `agent: ouroboros-spec`
  - `ouroboros-implement.prompt.md` → `agent: ouroboros-implement`
  - `ouroboros-archive.prompt.md` → `agent: ouroboros-archive`

- **Orchestrator Constraints on Workflow Agents**:
  - **BLIND/MUTE Rules**: Cannot read/write files directly → DELEGATE
  - **CCL Enforcement**: Mandatory heartbeat after every response
  - **Tool Lockdown**: `edit` and `read` tools forbidden (delegate to workers)
  - **Handoff Protocol**: Return to main orchestrator after completion

#### Changed
- **Agent Count**: 12 → 16 agents (added 4 workflow orchestrators)
- **Architecture Diagram**: Updated mermaid diagram to show workflow orchestrators
- **Routing Table**: `copilot-instructions.md` now shows agent targets for slash commands
- **File Structure**: Updated to show new agent organization

#### Fixed
- **Instructions Confusion**: Previously, prompts with `agent: ouroboros` caused instruction mixing. Now each workflow has its dedicated agent with clear boundaries.

---

## [2.0.0] - 2025-12-11

### 🚀 Major Architecture Overhaul: Centralized Orchestration

Ouroboros v2.0 introduces a strict **Hub-and-Spoke** architecture where the main `ouroboros` agent acts as the sole orchestrator, managing all subagent interactions via the native `runSubagent()` tool.

#### Changed
- **Centralized Orchestration** — The `ouroboros.agent.md` file is now the single entry point. Users should no longer interact with subagents directly.
- **Strict Subagent Delegation** — All subagent calls are now routed through `runSubagent()`. This ensures that the orchestrator maintains the context and project state.
- **Return Protocol** — Subagents are now explicitly programmed to return control to the orchestrator after completing their specific tasks, preventing "hallucinated" completions or hangs.
- **Agent Location** — Confirmed all agents reside in `.github/agents/`.

#### Added
- **TaskSync V5 Integration** — Enhanced persistence guarantees and stronger protection against context window degradation.
- **Workflow Assurance** — The new architecture guarantees that multi-step workflows (like Spec -> Implement -> Test) execute sequentially and correctly.

### 🧠 Agent Prompts Enhancement

Major upgrade to all 12 subagent prompts, leveraging the Self-Bootstrap architecture to add comprehensive guidance without impacting the orchestrator's context window.

#### Changed

**Core Agents (8 files):**

| Agent | Key Additions |
|-------|---------------|
| `ouroboros-coder` | Persona, Design Patterns table, Language-specific examples (TS, Python, React), Anti-Patterns, Few-shot example |
| `ouroboros-qa` | Debugging Mindset (5 Whys, Bisection), Test Pyramid, Mock Patterns, Error Classification, Bug Pattern recognition |
| `ouroboros-analyst` | C4 Model framework, Investigation Techniques, Diagram Templates (Component, Sequence, Data Flow) |
| `ouroboros-architect` | ADR Template, Trade-off Analysis Framework, Architecture Patterns Catalog, NFR Checklist |
| `ouroboros-devops` | Deployment Strategies (Blue-Green, Canary), Platform Quick References (Docker, GitHub Actions, K8s), Observability Checklist |
| `ouroboros-git` | Git Workflow Models, Rebase vs Merge comparison, Interactive Rebase Recipes, Advanced Git Commands |
| `ouroboros-security` | OWASP Top 10 Deep Dive with code examples, Secure Coding Patterns, Security Headers Checklist |
| `ouroboros-writer` | Inverted Pyramid, Documentation Templates (README, API), Writing Style Guide, Changelog Format |

**Spec Workflow Agents (4 files):**

| Agent | Key Additions |
|-------|---------------|
| `ouroboros-researcher` | Research Methodology, Exploration Patterns, Key Files Reference, Documentation Mining |
| `ouroboros-requirements` | Complete EARS Examples, User Story Format, MoSCoW Prioritization, Given-When-Then patterns |
| `ouroboros-tasks` | Task Format, T-Shirt Sizing, Dependency Mapping diagram, Risk Identification |
| `ouroboros-validator` | Gap Analysis Framework, Coverage Matrices, Impact Analysis, Validation Report Template |

#### Metrics

| Metric | Before | After | Growth |
|--------|--------|-------|--------|
| Total Lines | ~974 | ~2554 | +162% |
| Average Lines/Agent | ~81 | ~213 | +163% |
| Largest Agent | ~165 (QA) | ~349 (QA) | +112% |

#### Added

- **Structured Task Handoff Protocol** - Enhanced orchestrator-to-subagent communication with:
  - `[BOOTSTRAP]` section: Explicit file reads for persona and context
  - `[TASK]` section: Structured Target/Action/Context format
  - `[ARTIFACTS]` section: Optional code passing
  - Standardized response format with `📌 Status` field

- **TaskSync V5 Enforcement Mechanisms** - Borrowed from TaskSync protocol for stronger compliance:
  - **EMERGENCY OVERRIDE Protocols**: Self-check mechanisms before every response
  - **Explicit Tool Naming**: CCL must use `run_command` tool, not just display
  - **Announce-Then-Execute Pattern**: Say "Task completed..." then execute CCL
  - **ANTI-TERMINATION Protocol**: Detection of session-ending behavior with override
  - **Expanded FORBIDDEN Phrases List**: More comprehensive goodbye phrase blocking

---

## [1.1.0] - 2025-12-10

### 🚀 Architecture Upgrade: Self-Bootstrap Agents

#### Changed
- **Agent Relocation** — Agents now in `.github/agents/` with `.agent.md` extension, enabling native Copilot `runSubagent(agent: "name")` calls.
- **Dispatch Protocol** — Replaced "Self-Bootstrap" with **Native Agent Dispatch**.
  - **Old**: `Read .ouroboros/agents/ouroboros-coder.prompt.md then execute...`
  - **New**: `runSubagent(agent: "ouroboros-coder", prompt: ...)` (native Copilot integration)
- **Prompt Updates** — Updated `copilot-instructions.md`, `ouroboros-implement.prompt.md`, and `ouroboros-spec.prompt.md` to enforce the new file-reading dispatch pattern.

#### Added
- **Auto-Cleanup Protocol** — Added automatic maintenance to `/ouroboros-archive`:
  - **Subagent Specs**: `.ouroboros/subagent-docs/` files older than 3 days **deleted** (transient data).
  - **Context History**: `.ouroboros/history/` files older than 7 days moved to archive (persistent data).
- **Architectural Awareness** — Subagents now automatically read the latest `history/context-*.md` before execution, ensuring they align with the current project state without prompt repetition.

---

## [1.0.0] - 2025-12-10

### 🎉 Initial Release

Project Ouroboros is a persistent context system for GitHub Copilot that reduces redundant conversations and maximizes subscription value through intelligent memory management and specialized sub-agent routing.

---

### Added

#### ♾️ Core Session System
- **Never-Ending Sessions** — AI continues indefinitely until user explicitly says "stop", "end", "terminate", or "quit"
- **Goodbye Phrase Ban** — Forbidden phrases like "Let me know if you need help" enforced system-wide
- **Continuous Command Loop (CCL)** — Terminal-based interaction via `python -c "task = input('[Ouroboros] > ')"`
- **Lossless Artifact Protocol** — Code passed verbatim between agents, never summarized or truncated

#### 🧠 Persistent Memory System
- **Template Pattern** — Templates in `templates/` are READ-ONLY; active files created in `history/`
  - `context-template.md` → `history/context-YYYY-MM-DD.md`
  - `project-arch-template.md` → `history/project-arch-YYYY-MM-DD.md`
- **Automatic Context Restoration** — Session state restored from latest `history/context-*.md` on startup
- **Milestone-Based Updates** — Context files updated on major milestones, not every action

#### 🤖 Custom Agents (12 Specialists in `.github/agents/`)

**Core Agents:**
| Agent | Trigger | Role |
|-------|---------|------|
| `ouroboros-coder` | implement, create, build | Full-stack development |
| `ouroboros-qa` | test, debug, fix, error, mock, coverage | Testing \& debugging (unified) |
| `ouroboros-writer` | document, explain | Documentation, no code mods |
| `ouroboros-devops` | deploy, docker | Deployment with rollback steps |
| `ouroboros-security` | security, audit | Risk identification |
| `ouroboros-git` | merge, conflict, rebase | Git operations |
| `ouroboros-analyst` | how does, where is | Read-only codebase analysis |

**Spec Workflow Agents:**
| Agent | Trigger | Role |
|-------|---------|------|
| `ouroboros-researcher` | research, investigate | Structured research reports |
| `ouroboros-requirements` | requirements, user story | EARS notation requirements |
| `ouroboros-architect` | design, architecture | Mermaid diagrams required |
| `ouroboros-validator` | validate, verify | Coverage matrix output |

**VS Code Settings Required:**
| Setting | Purpose |
|---------|---------|
| `github.copilot.chat.codeGeneration.useInstructionFiles` | Load custom instructions |
| `github.copilot.chat.agent` | Enable agent mode |
| `chat.customAgentInSubagent.enabled` | Allow custom subagents (experimental) |

#### ⚡ Slash Commands

| Command | Purpose |
|---------|---------|
| `/ouroboros` | Full system activation and re-initialization |
| `/ouroboros-init` | First-time project research and architecture setup |
| `/ouroboros-spec` | 5-phase spec workflow (Research → Requirements → Design → Tasks → Validation) |
| `/ouroboros-implement` | Execute tasks.md with 3 speed modes |
| `/ouroboros-archive` | Archive completed specs with timestamp |

#### 📋 Spec-Driven Development (4 Phases)

| Phase | Agent | Output |
|-------|-------|--------|
| 1. Research | `ouroboros-researcher` | `research.md` — codebase analysis, affected files |
| 2. Requirements | `ouroboros-requirements` | `requirements.md` — EARS notation, numbered requirements |
| 3. Design | `ouroboros-architect` | `design.md` — architecture, Mermaid diagrams, correctness properties |
| 4. Validation | `ouroboros-validator` | `validation-report.md` — consistency check, impact analysis, risk assessment |

**Validation Phase (A+B Approach):**
- **Part A**: Generate persistent `validation-report.md` with full analysis
- **Part B**: Interactive terminal confirmation (`yes` / `revise X` / `abort`)

**Phase Execution Rules:**
- Each phase executes via `runSubagent()` and RETURNS to orchestrator
- User approval required before proceeding to next phase
- File whitelist enforced (5 allowed files per feature spec)

#### 🎮 Implementation Modes (`/ouroboros-implement`)

| Mode | Speed | Control | Best For |
|------|-------|---------|----------|
| 🔧 Task-by-Task | Slowest | Highest | High-risk changes, learning |
| 📦 Phase-by-Phase | Medium | Medium | Normal development |
| 🚀 Auto-Run All | Fastest | Lowest | Low-risk, trusted tasks |

#### 📄 Enhanced Templates

| Template | Key Features |
|----------|--------------|
| `research-template.md` | Tech stack tables, frontend/backend file mapping, recommended approach |
| `requirements-template.md` | Introduction, Glossary, numbered EARS requirements (REQ-XXX) |
| `design-template.md` | Design principles, component interfaces, **correctness properties**, testing strategy |
| `tasks-template.md` | Sub-task numbering (1.1, 1.2), checkpoint markers (🔍), property test indicators (*) |
| `validation-template.md` | Consistency check, impact analysis, risk assessment, user decision options |

#### 🛡️ Safety & Guardrails
- **Destructive Command Protection** — `rm -rf`, `git reset --hard`, `git push --force` require confirmation
- **Verification Gate** — Code verified via `ouroboros-security` or `ouroboros-qa` before delivery
- **QA Fix-Verify Cycle** — `ouroboros-qa` handles test+debug with 3-cycle limit to prevent infinite loops
- **Phase Reset Protocol** — Explicit rules for returning to earlier spec phases
- **File Whitelist** — Only 5 files allowed in specs: `research.md`, `requirements.md`, `design.md`, `tasks.md`, `validation-report.md`

#### 🌐 Internationalization
- **Language Mirroring** — AI replies in user's language (Chinese, English, Japanese, etc.)

---

### Documentation

- Comprehensive `README.md` with quick start (3 steps), file structure, and usage examples
- `.ouroboros/README.md` with detailed specs system documentation
- Context window degradation warnings and mitigation strategies
- Acknowledgment of [TaskSync](https://github.com/4regab/TaskSync) as inspiration

---

### Technical Notes

**Orchestrator Constraints:**
- ✅ CAN: Spawn subagents, run terminal commands, answer quick questions, discuss planning
- ❌ CANNOT: Read/write files directly, use `agentName` parameter, end session without user command

**Agent Activation Format:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🤖 [Agent_Name] ACTIVATED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 Task: [one-line summary]
📌 Constraint: [what this agent CANNOT do]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Artifact Format:**
```
=== ARTIFACT START: [filename] ===
[COMPLETE raw content - no omissions]
=== ARTIFACT END ===
```

---
