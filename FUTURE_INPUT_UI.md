# 🎨 Enhanced CCL System - Complete Implementation Plan

> **Status**: 📋 Planning Complete - Ready for Implementation
> **Priority**: Medium
> **Last Updated**: 2025-12-12
> **Document Version**: 4.0 (Added Subagent Permission & Input Standardization)

---

## Table of Contents

1. [Problem Statement](#-problem-statement)
2. [Solution Overview](#-solution-overview)
3. [Dependency Analysis](#-dependency-analysis)
4. [Architecture Design](#-architecture-design)
5. [Input Command Standardization](#-input-command-standardization)
6. [Edge Cases & Solutions](#-edge-cases--solutions)
7. [File Detection Feature](#-file-detection-feature)
8. [UI Design Specification](#-ui-design-specification)
9. [Implementation Plan](#-implementation-plan)
10. [File Inventory](#-file-inventory)
11. [Toggle Script Design](#-toggle-script-design)
12. [Risk Assessment](#-risk-assessment)
13. [Testing Plan](#-testing-plan)

---

## 📋 Problem Statement

### Current Limitations

The current CCL (Continuous Command Loop) uses:
```python
python -c "task = input('[Ouroboros] > ')"
```

**Limitations:**
- Single line input only
- No multi-line support
- No command history
- No visual feedback
- No file drag-and-drop support
- Basic terminal experience

### Goal

Create an **optional enhanced mode** that provides:
- Multi-line input support
- Visual beautification (colors, borders)
- Command history (where available)
- File path detection and formatting
- Shortcut key hints
- Consistent experience across all input types
- **Zero breaking changes** to default behavior

---

## 🎯 Solution Overview

### Dual-Mode System

| Mode | Command | Features |
|------|---------|----------|
| **Default** | `python -c "..."` | Simple, stable, universal |
| **Enhanced** | `python .ouroboros/scripts/ccl.py ...` | Colors, multi-line, history, file detection |

### Toggle Mechanism

Users can switch between modes using:
```bash
python .ouroboros/scripts/toggle-enhanced.py
```

This script will:
1. Scan all `.github/*.md` files
2. Replace all standardized input commands
3. Toggle between Default ↔ Enhanced mode

---

## 🔬 Dependency Analysis

### Critical Question: What Libraries Do We Use?

#### Python Standard Library Only

| Module | Purpose | Availability |
|--------|---------|--------------|
| `sys` | System functions | ✅ Always available |
| `argparse` | Command line parsing | ✅ Python 2.7+, 3.2+ |
| `pathlib` | Path operations | ✅ Python 3.4+ |
| `re` | Regular expressions | ✅ Always available |
| `os` | OS operations, file detection | ✅ Always available |

#### Optional Enhancement (Graceful Fallback)

| Module | Purpose | Availability | Fallback |
|--------|---------|--------------|----------|
| `readline` | History, line editing | ⚠️ See below | No history, still works |

### readline Availability by Platform

| Platform | readline Status | Notes |
|----------|----------------|-------|
| **Linux** | ✅ Built-in | Part of Python |
| **macOS** | ✅ Built-in | Part of Python |
| **Windows** | ❌ Not included | Needs `pyreadline3` |

### Windows readline Solution

```python
# In ccl.py
try:
    import readline
except ImportError:
    try:
        import pyreadline3 as readline  # Windows alternative
    except ImportError:
        pass  # No readline, but still works
```

**Important**: We do NOT require users to install `pyreadline3`. The script works without it - readline is purely optional enhancement.

### ANSI Color Support

| Platform | Terminal | ANSI Support |
|----------|----------|--------------|
| Windows 10+ | Windows Terminal | ✅ |
| Windows 10+ | cmd.exe | ✅ (after Win10 1511) |
| Windows < 10 | cmd.exe | ❌ Degraded |
| macOS | Terminal.app | ✅ |
| Linux | Most terminals | ✅ |

**Fallback for old Windows**: Colors just don't show, but script still works.

### Unicode Box Drawing Support

| Platform | Support |
|----------|---------|
| Windows 10+ | ✅ With UTF-8 codepage |
| macOS | ✅ |
| Linux | ✅ |

**Solution for old Windows**: ASCII fallback mode:
```python
if os.name == 'nt' and sys.getwindowsversion().major < 10:
    BOX_TL, BOX_TR, BOX_BL, BOX_BR = '+', '+', '+', '+'
    BOX_H, BOX_V = '-', '|'
else:
    BOX_TL, BOX_TR, BOX_BL, BOX_BR = '╔', '╗', '╚', '╝'
    BOX_H, BOX_V = '═', '║'
```

---

## 🏗️ Architecture Design

### File Structure

```
.ouroboros/
├── scripts/
│   ├── ccl.py              # Enhanced CCL script
│   └── toggle-enhanced.py   # Mode toggle script
└── ...

.github/
├── copilot-instructions.md  # Contains CCL commands
├── agents/
│   ├── ouroboros.agent.md   # Contains CCL commands
│   ├── ouroboros-*.agent.md # Contain CCL commands
│   └── ...
└── prompts/
    ├── ouroboros.prompt.md  # Contains CCL commands
    └── ...
```

### CCL Script Features

```
┌─────────────────────────────────────────────────────┐
│  ccl.py                                             │
├─────────────────────────────────────────────────────┤
│  Arguments:                                         │
│  --prompt "text"    Custom prompt text              │
│  --header "text"    Pre-input display text          │
│  --var "name"       Variable name for output marker │
│  --no-ui            Disable fancy border            │
│  --no-color         Disable ANSI colors             │
│  --ascii            Use ASCII instead of Unicode    │
├─────────────────────────────────────────────────────┤
│  Features:                                          │
│  - Multi-line input (<<< or empty line confirm)     │
│  - Command history (if readline available)          │
│  - ANSI colors (if terminal supports)               │
│  - Unicode box drawing (with ASCII fallback)        │
│  - File path detection ([FILE], [IMAGE], [VIDEO])   │
│  - Shortcut key hints in UI                         │
│  - Clear output markers for Copilot parsing         │
└─────────────────────────────────────────────────────┘
```

---

## 📐 Input Command Standardization

### Current Input Commands Found

From grep search of `.github/`:

#### Type A: Standard CCL (17 occurrences)
```python
python -c "task = input('[Ouroboros] > ')"
```

#### Type B: Menu Selection (5 occurrences)
```python
python -c "print('\\n[1] Option1 [2] Option2'); choice = input('Choice: ')"
```

#### Type C: Feature/Name Input (3 occurrences)
```python
python -c "feature = input('What feature are you building? ...: ')"
```

#### Type D: Confirmation (2 occurrences)
```python
python -c "choice = input('[y/n]: ')"
```

#### Type E: Question Input (1 occurrence)
```python
python -c "question = input('How can i help you? ')"
```

### Standardization Rules

All input commands MUST follow one of these patterns:

| Type | Variable | Default Prompt | Purpose |
|------|----------|----------------|---------|
| A | `task` | `[Ouroboros] >` | Standard task input |
| B | `choice` | `Choice:` | Menu selection |
| C | `feature` | `Feature name:` | Feature naming |
| D | `confirm` | `[y/n]:` | Yes/No confirmation |
| E | `question` | `Question:` | Free-form question |

### Enhanced Mode Mappings

| Type | Default Mode | Enhanced Mode |
|------|--------------|---------------|
| A | `python -c "task = input('[Ouroboros] > ')"` | `python .ouroboros/scripts/ccl.py` |
| B | `python -c "print('MENU'); choice = input('Choice: ')"` | `python .ouroboros/scripts/ccl.py --header "MENU" --prompt "Choice:" --var choice` |
| C | `python -c "feature = input('Feature name: ')"` | `python .ouroboros/scripts/ccl.py --prompt "Feature name:" --var feature` |
| D | `python -c "confirm = input('[y/n]: ')"` | `python .ouroboros/scripts/ccl.py --prompt "[y/n]:" --var confirm --no-ui` |
| E | `python -c "question = input('Question: ')"` | `python .ouroboros/scripts/ccl.py --prompt "Question:" --var question` |

---

## ⚠️ Edge Cases & Solutions

### 1. Input Box Dynamic Expansion

**Problem**: Can the visual box expand as user types newlines?

**Answer**: ❌ NOT POSSIBLE with Python `input()`

**Reason**: 
- `input()` captures one line at a time
- No control over terminal display during input
- Would require `curses` or similar library

**Accepted Limitation**: Border is decoration only, does not dynamically resize.

---

### 2. Multi-line Mode End Detection

| Problem | Scenario | Solution |
|---------|----------|----------|
| User forgets `>>>` | Stuck waiting | Support Ctrl+D (EOF) as alternative |
| Text contains `>>>` | Premature end | Use more unique marker OR empty-line-confirm |
| Accidental `<<<` | Unwanted mode | Empty line + Enter to quickly exit |

**Improved Algorithm**:
```python
def get_multiline_input():
    """Robust multi-line input with multiple exit methods"""
    print("  (Multi-line mode. End with: empty line+Enter, or Ctrl+D)")
    lines = []
    empty_count = 0
    
    while True:
        try:
            line = input("  │ ")
            
            if line == "":
                empty_count += 1
                if empty_count >= 2:
                    # Two consecutive empty lines = submit
                    break
                # First empty line - add it and continue
                lines.append("")
            else:
                empty_count = 0
                if line.strip() == ">>>":
                    break
                lines.append(line)
                
        except EOFError:
            # Ctrl+D pressed
            break
    
    return "\n".join(lines).rstrip()
```

---

### 3. Pasting Multi-line Content

**Problem**: User pastes multi-line text in single-line mode

**What happens**:
```
User pastes:
def hello():
    print("world")

Captured: only "def hello():"  ← Other lines LOST!
```

**Solutions**:

1. **Detection + Warning**:
```python
# If input looks truncated (common code patterns)
if first_line.rstrip().endswith((':' , '{', '[')):
    print("  ⚠️  Looks like multi-line code. Type '<<<' first, then paste.")
```

2. **Documentation**: Clear instruction in UI

3. **Auto-detect paste** (advanced):
```python
# Check if input arrived very fast (paste detection)
import time
start = time.time()
line = input()
elapsed = time.time() - start
if elapsed < 0.1 and len(line) > 50:
    print("  ⚠️  Long input detected. For multi-line, use '<<<' mode.")
```

---

### 4. Windows vs Unix Line Endings

| System | Line Ending | Handling |
|--------|-------------|----------|
| Windows | `\r\n` | Python auto-handles |
| Unix | `\n` | OK |
| Mixed (paste) | Both | Normalize |

**Solution**:
```python
# Normalize all line endings
task = task.replace('\r\n', '\n').replace('\r', '\n')
```

---

### 5. Special Characters in Input

| Character | Risk | Mitigation |
|-----------|------|------------|
| `<<<` / `>>>` | Mode triggers | Only trigger at line start |
| ANSI codes | Display issues | Strip on output |
| Unicode | Encoding | Use UTF-8 everywhere |

---

## � File Detection Feature

### Purpose

When users drag files into terminal, detect and format the path for Copilot.

### Implementation

```python
import os
from pathlib import Path

# File type categories
IMAGE_EXTS = {'.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.ico'}
VIDEO_EXTS = {'.mp4', '.mov', '.avi', '.webm', '.mkv'}
CODE_EXTS = {'.py', '.js', '.ts', '.jsx', '.tsx', '.java', '.c', '.cpp', '.h', 
             '.cs', '.go', '.rs', '.rb', '.php', '.swift', '.kt'}
DOC_EXTS = {'.md', '.txt', '.json', '.yaml', '.yml', '.xml', '.html', '.css'}

def detect_file_input(input_text):
    """Detect and format file paths in input"""
    # Clean path (Windows drag adds quotes)
    cleaned = input_text.strip().strip('"').strip("'")
    
    # Check if it's a valid file path
    if not os.path.isfile(cleaned):
        return None  # Not a file
    
    path = Path(cleaned)
    ext = path.suffix.lower()
    size = path.stat().st_size
    size_str = format_size(size)
    
    # Categorize
    if ext in IMAGE_EXTS:
        return {
            'type': 'IMAGE',
            'path': str(path.absolute()),
            'name': path.name,
            'size': size_str,
            'note': 'Copilot cannot view image content from path. Attach in Chat UI for visual analysis.'
        }
    elif ext in VIDEO_EXTS:
        return {
            'type': 'VIDEO',
            'path': str(path.absolute()),
            'name': path.name,
            'size': size_str,
            'note': 'Video file detected. Path provided for reference.'
        }
    elif ext in CODE_EXTS or ext in DOC_EXTS:
        return {
            'type': 'FILE',
            'path': str(path.absolute()),
            'name': path.name,
            'size': size_str,
            'note': 'Agent can read this file content.'
        }
    else:
        return {
            'type': 'FILE',
            'path': str(path.absolute()),
            'name': path.name,
            'size': size_str,
            'note': 'Unknown file type.'
        }

def format_size(bytes):
    """Format file size for display"""
    for unit in ['B', 'KB', 'MB', 'GB']:
        if bytes < 1024:
            return f"{bytes:.1f} {unit}"
        bytes /= 1024
    return f"{bytes:.1f} TB"
```

### Output Format

When file is detected:
```
❯ "C:\Users\me\screenshot.png"

📁 File Detected:
   Type: IMAGE
   Name: screenshot.png
   Size: 245.3 KB
   Note: Copilot cannot view image content from path. Attach in Chat UI for visual analysis.

=== TASK START ===
[IMAGE] C:\Users\me\screenshot.png
=== TASK END ===
```

When code file is detected:
```
❯ "D:\project\src\main.py"

📁 File Detected:
   Type: FILE
   Name: main.py
   Size: 4.2 KB
   Note: Agent can read this file content.

=== TASK START ===
[FILE] D:\project\src\main.py
=== TASK END ===
```

### Agent Response Guidelines

Add to `copilot-instructions.md`:

```markdown
## File Input Handling

When task starts with `[FILE]`, `[IMAGE]`, or `[VIDEO]`:

| Prefix | Action |
|--------|--------|
| `[FILE] path` | Use `ouroboros-analyst` to read file content |
| `[IMAGE] path` | Acknowledge path. Inform user to attach in Chat UI for visual analysis |
| `[VIDEO] path` | Acknowledge path. Video content cannot be analyzed |
```

---

## 🎨 UI Design Specification

### Enhanced Mode Display

```
╔═══════════════════════════════════════════════════════╗
║  ♾️  Ouroboros - Awaiting Command                     ║
╠═══════════════════════════════════════════════════════╣
║  ⌨️  Shortcuts:                                       ║
║  • Multi-line: Type '<<<' or paste, end with '>>>'    ║
║  • Submit: Enter (single) | Empty line x2 (multi)     ║
║  • Cancel: Ctrl+C                                     ║
╚═══════════════════════════════════════════════════════╝

❯ _
```

### ASCII Fallback Mode

```
+-------------------------------------------------------+
|  Ouroboros - Awaiting Command                         |
+-------------------------------------------------------+
|  Shortcuts:                                           |
|  * Multi-line: Type '<<<' or paste, end with '>>>'    |
|  * Submit: Enter (single) | Empty line x2 (multi)     |
|  * Cancel: Ctrl+C                                     |
+-------------------------------------------------------+

> _
```

### Color Scheme

| Element | Color | ANSI Code |
|---------|-------|-----------|
| Border | Cyan | `\033[96m` |
| Prompt arrow | Green | `\033[92m` |
| Hints/Notes | Yellow | `\033[93m` |
| Errors | Red | `\033[91m` |
| Bold | Bold | `\033[1m` |
| Reset | - | `\033[0m` |

---

## �📝 Implementation Plan

### Phase 1: Core Scripts (Priority: High)

- [ ] **Task 1.1**: Create `.ouroboros/scripts/ccl.py`
  - All argument parsing (`--prompt`, `--header`, `--var`, `--no-ui`, `--no-color`, `--ascii`)
  - Multi-line support with robust exit detection
  - Color/Unicode with fallbacks
  - File path detection and formatting
  - Shortcut key hints in UI
  - Clear output markers

- [ ] **Task 1.2**: Create `.ouroboros/scripts/toggle-enhanced.py`
  - Scan all `.github/*.md` files
  - Pattern matching for all input types (A-E)
  - Bidirectional toggle
  - Dry-run mode
  - Backup before changes

### Phase 2: Standardization (Priority: High)

- [ ] **Task 2.1**: Audit all agent files
  - List every input command
  - Categorize by type (A-E)
  - Note any non-standard formats

- [ ] **Task 2.2**: Update non-standard commands
  - Convert to standard format
  - Test each file

### Phase 3: Documentation (Priority: Medium)

- [ ] **Task 3.1**: Update README.md
  - Add "Optional Enhanced Mode" section
  - Platform compatibility notes
  - How to enable/disable

- [ ] **Task 3.2**: Update copilot-instructions.md
  - Add file input handling guidelines
  - Document `[FILE]`, `[IMAGE]`, `[VIDEO]` prefixes

- [ ] **Task 3.3**: Create INPUT_STANDARDS.md
  - Document all input types
  - Examples for contributors
  - Rules for new agents

### Phase 4: Testing (Priority: High)

- [ ] **Task 4.1**: Test on Windows 10+
- [ ] **Task 4.2**: Test on macOS
- [ ] **Task 4.3**: Test on Linux
- [ ] **Task 4.4**: Test on Windows < 10 (if available)
- [ ] **Task 4.5**: Verify Copilot correctly parses output markers
- [ ] **Task 4.6**: Test file drag-and-drop
- [ ] **Task 4.7**: Test multi-line paste scenarios

---

## 📁 File Inventory

### Files Containing Input Commands

| File | Input Types | Count |
|------|-------------|-------|
| `.github/copilot-instructions.md` | A | 3 |
| `.github/agents/ouroboros.agent.md` | A | 8 |
| `.github/prompts/ouroboros.prompt.md` | A, E | 7 |
| `.github/agents/ouroboros-init.agent.md` | A, D | 4 |
| `.github/agents/ouroboros-spec.agent.md` | A, B, C | 5 |
| `.github/agents/ouroboros-implement.agent.md` | A, B, C | 5 |
| `.github/agents/ouroboros-archive.agent.md` | A, B, D | 5 |
| `.github/agents/ouroboros-requirements.agent.md` | A, C | 2 |
| Other agent files | A (fallback only) | ~10 |

**Total estimated replacements**: ~50 input commands

---

## 🔄 Toggle Script Design

### Algorithm

```python
def toggle():
    # 1. Detect current mode
    sample_file = Path(".github/copilot-instructions.md")
    content = sample_file.read_text()
    current_mode = "enhanced" if "ccl.py" in content else "default"
    
    # 2. Define mappings
    mappings = get_mappings(current_mode)
    
    # 3. Backup files
    create_backup()
    
    # 4. Process all files
    for file in Path(".github").rglob("*.md"):
        update_file(file, mappings)
    
    # 5. Report
    new_mode = "default" if current_mode == "enhanced" else "enhanced"
    print(f"✅ Switched from {current_mode} to {new_mode}")
    print(f"   Updated X files with Y replacements")
```

### CLI Options

```bash
# Toggle mode
python .ouroboros/scripts/toggle-enhanced.py

# Dry run (preview changes)
python .ouroboros/scripts/toggle-enhanced.py --dry-run

# Force specific mode
python .ouroboros/scripts/toggle-enhanced.py --mode enhanced
python .ouroboros/scripts/toggle-enhanced.py --mode default

# Restore from backup
python .ouroboros/scripts/toggle-enhanced.py --restore
```

---

## ⚠️ Risk Assessment

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Copilot fails to parse new format | High | Low | Clear `=== TASK START/END ===` markers |
| Windows < 10 display issues | Medium | Low | ASCII fallback mode |
| readline not available | Low | Medium | Graceful fallback, still works |
| Regex misses some patterns | Medium | Medium | Manual audit of all files |
| Toggle breaks a file | High | Low | Backup before toggle, dry-run mode |
| Multi-line paste lost | Medium | Medium | Documentation, warning messages |
| File path with spaces | Medium | Medium | Quote handling in detection |

---

## 🧪 Testing Plan

### Unit Tests for ccl.py

1. **Single-line input**: Standard task entry
2. **Multi-line input**: `<<<` / `>>>`, empty line confirm, Ctrl+D
3. **All argument combinations**: `--prompt`, `--header`, `--var`, etc.
4. **Fallback modes**: `--no-color`, `--ascii`, `--no-ui`
5. **Output format**: Verify `=== TASK START/END ===` markers
6. **File detection**: Various file types and paths
7. **Edge cases**: Paths with spaces, unicode filenames

### Integration Tests

1. **Toggle script**: Run toggle, verify all files updated correctly
2. **Copilot parsing**: Ensure Copilot extracts correct task from markers
3. **CCL loop**: Verify Agent continues loop after input
4. **File handling**: Drag file, verify agent receives formatted path

### Platform Tests

| Platform | Test Items |
|----------|------------|
| Windows 10+ | Full features, file paths with backslashes |
| Windows < 10 | ASCII fallback, no color |
| macOS | Full features, file paths with forward slashes |
| Linux | Full features |

### Manual Test Scenarios

1. **Basic flow**: Start session → type task → verify loop continues
2. **Multi-line**: Enter multi-line code block → verify complete capture
3. **Paste test**: Paste 10-line code → verify all lines captured (after `<<<`)
4. **File drag**: Drag .py file → verify `[FILE]` output
5. **Image drag**: Drag .png → verify `[IMAGE]` output with warning
6. **Cancel**: Type partial input → Ctrl+C → verify clean exit
7. **Toggle**: Switch modes → verify all commands updated

---

## ✅ Summary

### What We're Building

1. **ccl.py**: Universal enhanced input script
   - Multi-line support with robust exit detection
   - Colors, borders, Unicode (with fallbacks)
   - Shortcut hints in UI
   - File path detection and formatting
   - Command history (where available)

2. **toggle-enhanced.py**: One-click mode switcher
   - Scans all `.github/*.md` files
   - Pattern-based replacement
   - Backup and restore

3. **Standardized input formats**: Consistent patterns across all agents

4. **Documentation**: README, copilot-instructions, INPUT_STANDARDS

### Dependencies

| Required | Optional |
|----------|----------|
| Python 3.6+ | `readline` (auto on Linux/macOS) |
| `sys`, `argparse`, `pathlib`, `re`, `os` | `pyreadline3` (Windows, not required) |

### Compatibility

| Platform | Status |
|----------|--------|
| Windows 10+ | ✅ Full support |
| Windows < 10 | ⚠️ Degraded (ASCII, no color) |
| macOS | ✅ Full support |
| Linux | ✅ Full support |

### Feature Matrix

| Feature | Default Mode | Enhanced Mode |
|---------|--------------|---------------|
| Single-line input | ✅ | ✅ |
| Multi-line input | ❌ | ✅ |
| Command history | ❌ | ⚠️ (platform) |
| Colors/Borders | ❌ | ✅ |
| Shortcut hints | ❌ | ✅ |
| File detection | ❌ | ✅ |
| Zero dependencies | ✅ | ✅ |

---

## 🚀 CI/CD & Version Control

### Why CI/CD for Ouroboros?

| Purpose | Necessity | Benefit |
|---------|-----------|---------|
| Python syntax validation | ⭐⭐ Medium | Catch errors before merge |
| Markdown link checking | ⭐ Low | Maintain documentation quality |
| Automated release packaging | ⭐⭐⭐ High | Easy distribution |
| Version management | ⭐⭐ Medium | Track changes |
| Cross-platform testing | ⭐⭐⭐ High | Ensure ccl.py works everywhere |

### Proposed Workflow Files

#### 1. Validation Workflow (on PR/Push)

```yaml
# .github/workflows/validate.yml
name: Validate

on:
  push:
    branches: [main, dev]
  pull_request:
    branches: [main]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.x'
      
      - name: Check Python syntax
        run: |
          python -m py_compile .ouroboros/scripts/*.py
          echo "✅ Python syntax OK"
      
      - name: Check markdown links
        uses: gaurav-nelson/github-action-markdown-link-check@v1
        with:
          folder-path: '.'
        continue-on-error: true
```

#### 2. Release Workflow (on Tag)

```yaml
# .github/workflows/release.yml
name: Release

on:
  push:
    tags: ['v*']

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Get version
        id: version
        run: echo "VERSION=${GITHUB_REF#refs/tags/}" >> $GITHUB_OUTPUT
      
      - name: Create release package
        run: |
          mkdir -p dist
          zip -r dist/ouroboros-${{ steps.version.outputs.VERSION }}.zip \
            .github/ .ouroboros/ README.md CHANGELOG.md LICENSE \
            -x "*.git*" -x "*workflow*"
      
      - name: Create Release
        uses: softprops/action-gh-release@v1
        with:
          files: dist/*.zip
          generate_release_notes: true
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

#### 3. Cross-Platform Test Workflow

```yaml
# .github/workflows/test-ccl.yml
name: Test CCL Script

on:
  push:
    paths: ['.ouroboros/scripts/**']
  pull_request:
    paths: ['.ouroboros/scripts/**']

jobs:
  test:
    strategy:
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]
        python: ['3.8', '3.10', '3.12']
    
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: ${{ matrix.python }}
      - run: python -m py_compile .ouroboros/scripts/ccl.py
      - run: python .ouroboros/scripts/ccl.py --help
```

### Version Control Strategy

#### Semantic Versioning
```
MAJOR.MINOR.PATCH
MAJOR: Breaking changes
MINOR: New features (like Enhanced CCL)
PATCH: Bug fixes
```

#### Release Process
1. Update `CHANGELOG.md`
2. Create tag: `git tag v2.1.0 && git push origin v2.1.0`
3. GitHub Actions creates release with zip

### Package Contents

```
ouroboros-v2.1.0.zip
├── .github/
│   ├── copilot-instructions.md
│   ├── agents/*.agent.md
│   └── prompts/*.prompt.md
├── .ouroboros/
│   ├── scripts/ccl.py, toggle-enhanced.py
│   ├── templates/
│   └── specs/
├── README.md, CHANGELOG.md, LICENSE
```

---

## 🔐 Subagent Terminal Permission Decision

### Question: Should subagents have permission to use `python -c` to ask users?

### Decision: ❌ **NO** — Subagents should NOT have independent terminal input permission.

### Rationale

| Concern | Problem if Allowed | Solution |
|---------|-------------------|----------|
| **控制流混乱** | 用户不知道谁在问什么 | 所有交互由 Orchestrator 统一处理 |
| **Context 碎片化** | Subagent 的问答无法被有效追踪 | Subagent 返回"需要确认"状态给 Orchestrator |
| **架构一致性** | 违背 Ouroboros 的委托设计 | 保持清晰的层级结构 |

### Correct Pattern

```
用户 → Orchestrator (CCL) → Subagent (执行任务)
                ↑                    ↓
                ╰─── 需要用户输入时 ←──┘
                  Subagent 返回给 Orchestrator
                  Orchestrator 收集问题后统一询问用户
```

### What Subagents SHOULD Do

When a subagent needs user input:

1. **STOP** execution
2. **RETURN** to orchestrator with status:
   ```
   [NEED_USER_INPUT]
   Question: [具体问题]
   Options: [如果是选择题，列出选项]
   Context: [为什么需要这个信息]
   ```
3. **WAIT** for orchestrator to collect user input via CCL
4. **RECEIVE** input from orchestrator in next dispatch

### Implementation Location

This rule should be added to:
- `copilot-instructions.md` (Section: Subagent Behavior)
- All subagent files under "FORBIDDEN BEHAVIORS"

---

## 📐 Terminal Input Standardization Specification

> [!IMPORTANT]
> **强约束规范** - 必须写入每个 agent 文件以确保遵守

### Purpose

Standardize all `python -c` input commands to enable:
1. Reliable toggle script replacement
2. Future UI layer parsing and enhancement
3. Consistent user experience across all agents

### Input Type Classification

| Type | Variable | Pattern | Purpose |
|------|----------|---------|---------|
| **A** | `task` | `input('[Ouroboros] > ')` | Standard task input |
| **B** | `choice` | `print('[1] X [2] Y'); input('Choice: ')` | Menu selection |
| **C** | `feature` | `input('Feature name: ')` | Free-form naming |
| **D** | `confirm` | `input('[y/n]: ')` | Yes/No confirmation |
| **E** | `question` | `input('Question: ')` | Free-form question |

### Menu Selection Standardization (Type B) — **STRICT FORMAT**

> [!CAUTION]
> **菜单选择必须使用以下格式，不允许自由发挥！**

#### Required Format

```python
# 二选项
python -c "print('\\n[1] 选项A\\n[2] 选项B'); choice = input('选择 (1/2): ')"

# 三选项
python -c "print('\\n[1] 选项A\\n[2] 选项B\\n[3] 选项C'); choice = input('选择 (1-3): ')"

# 多选项
python -c "print('\\n[1] 选项A\\n[2] 选项B\\n[3] 选项C\\n[4] 选项D'); choice = input('选择 (1-4): ')"
```

#### Forbidden Formats

```python
# ❌ WRONG: 使用字母
python -c "print('[a] X [b] Y'); choice = input('Choice: ')"

# ❌ WRONG: 非方括号格式
python -c "print('1) Option 1\\n2) Option 2'); ..."

# ❌ WRONG: 使用破折号
python -c "print('- Option 1\\n- Option 2'); ..."

# ❌ WRONG: 无编号
python -c "print('Option A\\nOption B'); ..."
```

#### Why Numbers, Not Letters?

| Reason | Explanation |
|--------|-------------|
| **键盘效率** | 数字在键盘顶行，单手可达 |
| **通用性** | 数字在所有语言中一致 |
| **UI 解析** | `[1]`, `[2]`, `[3]` 易于正则匹配 |
| **未来扩展** | 数字可以支持更多选项 (1-9+) |

### Confirmation Standardization (Type D)

```python
# Standard confirmation
python -c "confirm = input('确认执行? [y/n]: ')"

# With context
python -c "print('将删除所有测试数据'); confirm = input('[y/n]: ')"
```

**Accepted inputs**: `y`, `Y`, `yes`, `Yes`, `n`, `N`, `no`, `No`

### UI Layer Parsing Rules

Future `ccl.py` or advanced UI can parse these patterns:

```python
# Detect menu options
pattern = r'\[(\d+)\]\s*([^\[]+)'  # Matches [1] Label

# Detect confirmation
pattern = r'\[y/n\]'

# Detect standard CCL
pattern = r"\[Ouroboros\] >"
```

**UI Transformation Examples:**

| Terminal Command | UI Can Transform To |
|-----------------|---------------------|
| `[1] Deploy [2] Cancel` | 两个按钮 |
| `[y/n]:` | Yes/No 按钮 |
| `[1] [2] [3] [4]` | 下拉选择器或按钮组 |

---

## 📝 Agent-Level Enforcement Template

> [!IMPORTANT]
> **以下规范应添加到每个 agent 文件中**

### Template to Add to ALL Agent Files

```markdown
## 🚨 TERMINAL INPUT STANDARDIZATION (MANDATORY)

> [!CAUTION]
> **所有终端输入必须遵循标准格式。违反 = 系统错误。**

### Menu Selection Format

When presenting choices to user via CCL, MUST use:

\`\`\`python
python -c "print('\\n[1] Option1\\n[2] Option2\\n[3] Option3'); choice = input('选择 (1-3): ')"
\`\`\`

**Rules:**
- Use `[1]`, `[2]`, `[3]` numbering ONLY (no letters, no other formats)
- Each option on its own line with `\\n`
- Prompt ends with `选择 (1-N):` or `Choice (1-N):`

### Confirmation Format

\`\`\`python
python -c "confirm = input('[y/n]: ')"
\`\`\`

### ❌ FORBIDDEN

- ❌ Using letters `[a]`, `[b]`, `[c]`
- ❌ Using dashes `- Option`
- ❌ Using parentheses `1)`, `2)`
- ❌ Free-form option formats
- ❌ Asking user questions directly without returning to orchestrator
```

### Files to Update

| File | Has Menu Selection? | Priority |
|------|---------------------|----------|
| `copilot-instructions.md` | N/A (global rules) | ⭐⭐⭐ High |
| `ouroboros.agent.md` | ✅ Yes (CCL) | ⭐⭐⭐ High |
| `ouroboros-spec.agent.md` | ✅ Yes (phase menu) | ⭐⭐⭐ High |
| `ouroboros-implement.agent.md` | ✅ Yes (mode menu) | ⭐⭐⭐ High |
| `ouroboros-archive.agent.md` | ✅ Yes (action menu) | ⭐⭐ Medium |
| `ouroboros-init.agent.md` | ⚠️ Possibly | ⭐⭐ Medium |
| All other agents | ⚠️ Fallback CCL only | ⭐ Low |

---

## 📋 Implementation Checklist (Input Standardization)

### Phase A: Document Rules (This Document) ✅
- [x] Define subagent permission decision
- [x] Define standardization format
- [x] Create enforcement template

### Phase B: Update Agent Files (TODO)
- [ ] **B.1**: Add standardization section to `copilot-instructions.md`
- [ ] **B.2**: Update `ouroboros.agent.md`
- [ ] **B.3**: Update `ouroboros-spec.agent.md`
- [ ] **B.4**: Update `ouroboros-implement.agent.md`
- [ ] **B.5**: Update `ouroboros-archive.agent.md`
- [ ] **B.6**: Update `ouroboros-init.agent.md`
- [ ] **B.7**: Audit all other agents for non-standard patterns

### Phase C: Verify Existing Commands (TODO)
- [ ] **C.1**: Grep all `python -c` in `.github/`
- [ ] **C.2**: Identify non-standard patterns
- [ ] **C.3**: Fix non-compliant commands

---

## ✅ Summary

### What We're Building

1. **ccl.py**: Enhanced input with multi-line, colors, file detection
2. **toggle-enhanced.py**: One-click mode switcher
3. **Standardized input formats**: Consistent patterns
4. **Documentation**: README, INPUT_STANDARDS
5. **CI/CD**: GitHub Actions for validation, testing, releases

### Dependencies

| Required | Optional |
|----------|----------|
| Python 3.6+ | `readline` (Linux/macOS) |
| `sys`, `argparse`, `pathlib`, `re`, `os` | `pyreadline3` (Windows) |

### Compatibility

| Platform | Status |
|----------|--------|
| Windows 10+ | ✅ Full support |
| Windows < 10 | ⚠️ Degraded |
| macOS | ✅ Full support |
| Linux | ✅ Full support |

### Feature Matrix

| Feature | Default | Enhanced |
|---------|---------|----------|
| Single-line | ✅ | ✅ |
| Multi-line | ❌ | ✅ |
| History | ❌ | ⚠️ |
| Colors | ❌ | ✅ |
| File detection | ❌ | ✅ |

---

*Plan documented 2025-12-12 v3.1. Ready for implementation upon approval.*

