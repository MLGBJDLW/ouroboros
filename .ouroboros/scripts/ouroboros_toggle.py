#!/usr/bin/env python3
"""
ouroboros_toggle.py - Mode Toggle Script

Switches between Default and Enhanced CCL modes by modifying
python -c commands in .github/ files.

Usage:
    python ouroboros_toggle.py                  # Toggle mode (auto-detect current)
    python ouroboros_toggle.py --mode enhanced  # Force enhanced mode
    python ouroboros_toggle.py --mode default   # Force default mode
    python ouroboros_toggle.py --dry-run        # Preview changes without applying
    python ouroboros_toggle.py --status         # Show current mode
"""

import sys
import os
import re
import argparse
from pathlib import Path
from datetime import datetime

# =============================================================================
# CONSTANTS
# =============================================================================

VERSION = "1.0.0"

# Script paths (relative to repo root)
SCRIPT_DIR = Path(".ouroboros/scripts")
INPUT_SCRIPT = SCRIPT_DIR / "ouroboros_input.py"

# Files to search for input commands
SEARCH_DIRS = [
    Path(".github/agents"),
    Path(".github/prompts"),
    Path(".github"),
]

# File patterns to include
FILE_PATTERNS = ["*.md"]

# Backup directory
BACKUP_DIR = SCRIPT_DIR / "backups"

# =============================================================================
# PATTERN DEFINITIONS
# =============================================================================

# Pattern matching for different input types
PATTERNS = {
    # Type A: Standard CCL
    "A": {
        "default": r'python -c "task = input\(\'\\[Ouroboros\\] > \'\)"',
        "enhanced": r"python \.ouroboros/scripts/ouroboros_input\.py",
        "default_template": "python -c \"task = input('[Ouroboros] > ')\"",
        "enhanced_template": "python .ouroboros/scripts/ouroboros_input.py",
    },
    # Type B: Menu selection with print + choice
    "B": {
        "default": r'python -c "print\(\'([^\']*)\'\); choice = input\(\'([^\']*)\'\)"',
        "enhanced": r'python \.ouroboros/scripts/ouroboros_input\.py --header "([^"]*)" --prompt "([^"]*)" --var choice',
        "default_template": "python -c \"print('{header}'); choice = input('{prompt}')\"",
        "enhanced_template": 'python .ouroboros/scripts/ouroboros_input.py --header "{header}" --prompt "{prompt}" --var choice',
    },
    # Type C: Feature/free-form input
    "C": {
        "default": r'python -c "feature = input\(\'([^\']*)\'\)"',
        "enhanced": r'python \.ouroboros/scripts/ouroboros_input\.py --prompt "([^"]*)" --var feature',
        "default_template": "python -c \"feature = input('{prompt}')\"",
        "enhanced_template": 'python .ouroboros/scripts/ouroboros_input.py --prompt "{prompt}" --var feature',
    },
    # Type D: Confirmation (y/n)
    "D": {
        "default": r'python -c "(?:print\(\'([^\']*)\'\); )?confirm = input\(\'\\[y/n\\]: \'\)"',
        "enhanced": r'python \.ouroboros/scripts/ouroboros_input\.py(?:\s+--header "([^"]*)")? --prompt "\\[y/n\\]:" --var confirm --no-ui',
        "default_template": "python -c \"confirm = input('[y/n]: ')\"",
        "default_template_with_print": "python -c \"print('{header}'); confirm = input('[y/n]: ')\"",
        "enhanced_template": 'python .ouroboros/scripts/ouroboros_input.py --prompt "[y/n]:" --var confirm --no-ui',
        "enhanced_template_with_header": 'python .ouroboros/scripts/ouroboros_input.py --header "{header}" --prompt "[y/n]:" --var confirm --no-ui',
    },
    # Type E: Question
    "E": {
        "default": r'python -c "question = input\(\'([^\']*)\'\)"',
        "enhanced": r'python \.ouroboros/scripts/ouroboros_input\.py --prompt "([^"]*)" --var question',
        "default_template": "python -c \"question = input('{prompt}')\"",
        "enhanced_template": 'python .ouroboros/scripts/ouroboros_input.py --prompt "{prompt}" --var question',
    },
}

# =============================================================================
# DETECTION FUNCTIONS
# =============================================================================


def find_repo_root() -> Path:
    """Find the repository root (where .github exists)."""
    current = Path.cwd()

    while current != current.parent:
        if (current / ".github").exists():
            return current
        current = current.parent

    # Fallback to cwd
    return Path.cwd()


def get_all_md_files(repo_root: Path) -> list[Path]:
    """Get all markdown files in search directories."""
    files = []

    for search_dir in SEARCH_DIRS:
        full_dir = repo_root / search_dir
        if full_dir.exists():
            for pattern in FILE_PATTERNS:
                files.extend(full_dir.glob(pattern))

    return sorted(set(files))


def detect_current_mode(repo_root: Path) -> str:
    """Detect whether enhanced or default mode is active."""
    files = get_all_md_files(repo_root)
    enhanced_count = 0
    default_count = 0

    for file in files:
        try:
            content = file.read_text(encoding="utf-8")

            # Check for enhanced mode patterns
            if "python .ouroboros/scripts/ouroboros_input.py" in content:
                enhanced_count += 1

            # Check for default mode patterns
            if "python -c \"task = input('[Ouroboros] > ')\"" in content:
                default_count += 1

        except IOError:
            continue

    if enhanced_count > default_count:
        return "enhanced"
    return "default"


# =============================================================================
# CONVERSION FUNCTIONS
# =============================================================================


def convert_to_enhanced(content: str) -> tuple[str, int]:
    """Convert default mode commands to enhanced mode. Returns (new_content, count)."""
    changes = 0

    # ==========================================================================
    # NEW FORMAT: Question + Options (print('question'); print(); print('[1]...'))
    # Must be processed BEFORE old format patterns to avoid partial matching
    # ==========================================================================

    # Type A+Q: Standard CCL with question
    # Format: print('question'); task = input('[Ouroboros] > ')
    def replace_task_with_question(match):
        question = match.group(1).replace("'", '"')
        return f'python .ouroboros/scripts/ouroboros_input.py --question "{question}"'

    pattern_a_q = (
        r'python -c "print\(\'([^\']*)\'\); task = input\(\'\[Ouroboros\] > \'\)"'
    )
    content, n = re.subn(pattern_a_q, replace_task_with_question, content)
    changes += n

    # Type B with Question: Menu with question + print() + options + choice
    # Format: print('question'); print(); print('[1] A'); print('[2] B'); choice = input('...')
    def replace_menu_with_question(match):
        full_match = match.group(0)
        question_match = re.search(r"print\('([^']*)'\); print\(\)", full_match)
        question = question_match.group(1) if question_match else ""
        print_items = re.findall(r"print\('(\[[^\]]+\][^']*)'\)", full_match)
        prompt_match = re.search(r"choice = input\('([^']*)'\)", full_match)
        prompt = prompt_match.group(1) if prompt_match else "Select:"
        header = "\\n".join(print_items)
        if question:
            return f'python .ouroboros/scripts/ouroboros_input.py --question "{question}" --header "{header}" --prompt "{prompt}" --var choice'
        return f'python .ouroboros/scripts/ouroboros_input.py --header "{header}" --prompt "{prompt}" --var choice'

    pattern_b_question = r'python -c "print\(\'[^\']*\'\); print\(\);(?: print\(\'[^\']*\'\);)+ choice = input\(\'[^\']*\'\)"'
    content, n = re.subn(pattern_b_question, replace_menu_with_question, content)
    changes += n

    # Type C with Question: Feature input with question
    def replace_feature_with_question(match):
        full_match = match.group(0)
        question_match = re.search(r"print\('([^']*)'\); print\(\)", full_match)
        question = question_match.group(1) if question_match else ""
        print_items = re.findall(r"print\('(\[[^\]]+\][^']*)'\)", full_match)
        prompt_match = re.search(r"feature = input\('([^']*)'\)", full_match)
        prompt = prompt_match.group(1) if prompt_match else "Feature:"
        header = "\\n".join(print_items)
        if question:
            return f'python .ouroboros/scripts/ouroboros_input.py --question "{question}" --header "{header}" --prompt "{prompt}" --var feature'
        return f'python .ouroboros/scripts/ouroboros_input.py --header "{header}" --prompt "{prompt}" --var feature'

    pattern_c_question = r'python -c "print\(\'[^\']*\'\); print\(\);(?: print\(\'[^\']*\'\);)+ feature = input\(\'[^\']*\'\)"'
    content, n = re.subn(pattern_c_question, replace_feature_with_question, content)
    changes += n

    # Type D with Question: Confirm with question
    def replace_confirm_with_question(match):
        full_match = match.group(0)
        question_match = re.search(r"print\('([^']*)'\); print\(\)", full_match)
        question = question_match.group(1) if question_match else ""
        print_items = re.findall(r"print\('(\[[^\]]+\][^']*)'\)", full_match)
        prompt_match = re.search(r"confirm = input\('([^']*)'\)", full_match)
        prompt = prompt_match.group(1) if prompt_match else "[y/n]:"
        header = "\\n".join(print_items)
        if question:
            return f'python .ouroboros/scripts/ouroboros_input.py --question "{question}" --header "{header}" --prompt "{prompt}" --var confirm'
        return f'python .ouroboros/scripts/ouroboros_input.py --header "{header}" --prompt "{prompt}" --var confirm'

    pattern_d_question = r'python -c "print\(\'[^\']*\'\); print\(\);(?: print\(\'[^\']*\'\);)+ confirm = input\(\'[^\']*\'\)"'
    content, n = re.subn(pattern_d_question, replace_confirm_with_question, content)
    changes += n

    # ==========================================================================
    # ORIGINAL FORMAT (from working git version)
    # ==========================================================================

    # Type A: Standard CCL - match multiple formats
    # Format 1: python -c "task = input('[Ouroboros] > ')"
    # Format 2: python -c "task = input(\'[Ouroboros] > \')"
    patterns_a = [
        r'python -c "task = input\(\'\[Ouroboros\] > \'\)"',
        r'python -c "task = input\(\\\'\[Ouroboros\] > \\\'\)"',
        r"python -c \"task = input\('[Ouroboros] > '\)\"",
    ]
    replacement_a = "python .ouroboros/scripts/ouroboros_input.py"
    for pattern in patterns_a:
        content, n = re.subn(pattern, replacement_a, content)
        changes += n

    # Type B: Menu with print + choice
    def replace_menu(match):
        header = match.group(1).replace("\\n", "\n").replace("'", '"')
        prompt = match.group(2).replace("'", '"')
        header_escaped = header.replace("\n", "\\n")
        return f'python .ouroboros/scripts/ouroboros_input.py --header "{header_escaped}" --prompt "{prompt}" --var choice'

    pattern_b = (
        r'python -c "print\(\'((?:[^\'\\]|\\.)*)\'\); choice = input\(\'([^\']*)\'\)"'
    )
    content, n = re.subn(pattern_b, replace_menu, content)
    changes += n

    # Type C: Feature input
    def replace_feature(match):
        prompt = match.group(1).replace("'", '"')
        return f'python .ouroboros/scripts/ouroboros_input.py --prompt "{prompt}" --var feature'

    pattern_c = r'python -c "feature = input\(\'([^\']*)\'\)"'
    content, n = re.subn(pattern_c, replace_feature, content)
    changes += n

    # Type D: Confirmation with optional print
    def replace_confirm(match):
        header = match.group(1) if match.group(1) else None
        if header:
            header = header.replace("\\n", "").strip().replace("'", '"')
            return f'python .ouroboros/scripts/ouroboros_input.py --header "{header}" --prompt "[y/n]:" --var confirm --no-ui'
        return 'python .ouroboros/scripts/ouroboros_input.py --prompt "[y/n]:" --var confirm --no-ui'

    pattern_d = (
        r'python -c "(?:print\(\'([^\']*)\'\); )?confirm = input\(\'\\[y/n\\]: \'\)"'
    )
    content, n = re.subn(pattern_d, replace_confirm, content)
    changes += n

    # Type E: Question
    def replace_question(match):
        prompt = match.group(1).replace("'", '"')
        return f'python .ouroboros/scripts/ouroboros_input.py --prompt "{prompt}" --var question'

    pattern_e = r'python -c "question = input\(\'([^\']*)\'\)"'
    content, n = re.subn(pattern_e, replace_question, content)
    changes += n

    # Type C2: Simple feature with question (no menu)
    # Format: print('question'); feature = input('prompt')
    def replace_simple_feature_with_question(match):
        question = match.group(1).replace("'", '"')
        prompt = match.group(2).replace("'", '"')
        return f'python .ouroboros/scripts/ouroboros_input.py --question "{question}" --prompt "{prompt}" --var feature'

    pattern_simple_feature = (
        r'python -c "print\(\'([^\']*)\'\); feature = input\(\'([^\']*)\'\)"'
    )
    content, n = re.subn(
        pattern_simple_feature, replace_simple_feature_with_question, content
    )
    changes += n

    # Type E2: Simple question with question (no menu)
    # Format: print('question'); question = input('prompt')
    def replace_simple_question_with_question(match):
        question = match.group(1).replace("'", '"')
        prompt = match.group(2).replace("'", '"')
        return f'python .ouroboros/scripts/ouroboros_input.py --question "{question}" --prompt "{prompt}" --var question'

    pattern_simple_question = (
        r'python -c "print\(\'([^\']*)\'\); question = input\(\'([^\']*)\'\)"'
    )
    content, n = re.subn(
        pattern_simple_question, replace_simple_question_with_question, content
    )
    changes += n

    return content, changes


def convert_to_default(content: str) -> tuple[str, int]:
    """Convert enhanced mode commands back to default mode. Returns (new_content, count)."""
    changes = 0

    # ==========================================================================
    # NEW FORMAT: Reverse conversion for --question patterns
    # ==========================================================================

    # Type A+Q: Standard CCL with question -> python -c with print
    def replace_task_with_question_reverse(match):
        question = match.group(1).replace('"', "'")
        return f"python -c \"print('{question}'); task = input('[Ouroboros] > ')\""

    pattern_a_q_rev = (
        r'python \.ouroboros/scripts/ouroboros_input\.py --question "([^"]*)"(?!\s+--)'
    )
    content, n = re.subn(pattern_a_q_rev, replace_task_with_question_reverse, content)
    changes += n

    # Type B with Question: Menu with question -> python -c with print statements
    def replace_menu_with_question_reverse(match):
        question = match.group(1).replace('"', "'") if match.group(1) else ""
        header = match.group(2).replace('"', "'") if match.group(2) else ""
        prompt = match.group(3).replace('"', "'") if match.group(3) else "Select:"

        # Convert header to multiple print statements
        options = header.split("\\n")
        print_stmts = "; ".join([f"print('{opt}')" for opt in options])

        if question:
            return f"python -c \"print('{question}'); print(); {print_stmts}; choice = input('{prompt}')\""
        return f"python -c \"print(); {print_stmts}; choice = input('{prompt}')\""

    pattern_b_q_rev = r'python \.ouroboros/scripts/ouroboros_input\.py(?:\s+--question "([^"]*)")?\s+--header "([^"]*)"\s+--prompt "([^"]*)"\s+--var choice'
    content, n = re.subn(pattern_b_q_rev, replace_menu_with_question_reverse, content)
    changes += n

    # Type C with Question: Feature with question -> python -c with print statements
    def replace_feature_with_question_reverse(match):
        question = match.group(1).replace('"', "'") if match.group(1) else ""
        header = match.group(2).replace('"', "'") if match.group(2) else ""
        prompt = match.group(3).replace('"', "'") if match.group(3) else "Feature:"

        options = header.split("\\n")
        print_stmts = "; ".join([f"print('{opt}')" for opt in options])

        if question:
            return f"python -c \"print('{question}'); print(); {print_stmts}; feature = input('{prompt}')\""
        return f"python -c \"print(); {print_stmts}; feature = input('{prompt}')\""

    pattern_c_q_rev = r'python \.ouroboros/scripts/ouroboros_input\.py(?:\s+--question "([^"]*)")?\s+--header "([^"]*)"\s+--prompt "([^"]*)"\s+--var feature'
    content, n = re.subn(
        pattern_c_q_rev, replace_feature_with_question_reverse, content
    )
    changes += n

    # Type D with Question: Confirm with question -> python -c with print statements
    def replace_confirm_with_question_reverse(match):
        question = match.group(1).replace('"', "'") if match.group(1) else ""
        header = match.group(2).replace('"', "'") if match.group(2) else ""
        prompt = match.group(3).replace('"', "'") if match.group(3) else "[y/n]:"

        options = header.split("\\n")
        print_stmts = "; ".join([f"print('{opt}')" for opt in options])

        if question:
            return f"python -c \"print('{question}'); print(); {print_stmts}; confirm = input('{prompt}')\""
        return f"python -c \"print(); {print_stmts}; confirm = input('{prompt}')\""

    pattern_d_q_rev = r'python \.ouroboros/scripts/ouroboros_input\.py(?:\s+--question "([^"]*)")?\s+--header "([^"]*)"\s+--prompt "([^"]*)"\s+--var confirm'
    content, n = re.subn(
        pattern_d_q_rev, replace_confirm_with_question_reverse, content
    )
    changes += n

    # ==========================================================================
    # ORIGINAL FORMAT (from working git version)
    # ==========================================================================

    # Type A: Standard CCL - match standalone calls (no --arguments after)
    # Use negative lookahead to avoid matching calls with arguments
    pattern_a_exact = r"python \.ouroboros/scripts/ouroboros_input\.py(?!\s+--)"
    replacement_a = "python -c \"task = input('[Ouroboros] > ')\""
    content, n = re.subn(pattern_a_exact, replacement_a, content)
    changes += n

    # Type B: Menu with header + prompt
    def replace_menu(match):
        header = match.group(1).replace('"', "'")
        prompt = match.group(2).replace('"', "'")
        return f"python -c \"print('{header}'); choice = input('{prompt}')\""

    pattern_b = r'python \.ouroboros/scripts/ouroboros_input\.py --header "([^"]*)" --prompt "([^"]*)" --var choice'
    content, n = re.subn(pattern_b, replace_menu, content)
    changes += n

    # Type C: Feature input
    def replace_feature(match):
        prompt = match.group(1).replace('"', "'")
        return f"python -c \"feature = input('{prompt}')\""

    pattern_c = r'python \.ouroboros/scripts/ouroboros_input\.py --prompt "([^"]*)" --var feature'
    content, n = re.subn(pattern_c, replace_feature, content)
    changes += n

    # Type D: Confirmation
    def replace_confirm(match):
        header = match.group(1) if match.group(1) else None
        if header:
            header = header.replace('"', "'")
            return f"python -c \"print('{header}'); confirm = input('[y/n]: ')\""
        return "python -c \"confirm = input('[y/n]: ')\""

    pattern_d = r'python \.ouroboros/scripts/ouroboros_input\.py(?:\s+--header "([^"]*)")? --prompt "\[y/n\]:" --var confirm(?:\s+--no-ui)?'
    content, n = re.subn(pattern_d, replace_confirm, content)
    changes += n

    # Type E: Question
    def replace_question(match):
        prompt = match.group(1).replace('"', "'")
        return f"python -c \"question = input('{prompt}')\""

    pattern_e = r'python \.ouroboros/scripts/ouroboros_input\.py --prompt "([^"]*)" --var question'
    content, n = re.subn(pattern_e, replace_question, content)
    changes += n

    # Type C2: Simple feature with question -> python -c
    def replace_simple_feature_reverse(match):
        question = match.group(1).replace('"', "'")
        prompt = match.group(2).replace('"', "'")
        return f"python -c \"print('{question}'); feature = input('{prompt}')\""

    pattern_simple_feature_rev = r'python \.ouroboros/scripts/ouroboros_input\.py --question "([^"]*)" --prompt "([^"]*)" --var feature'
    content, n = re.subn(
        pattern_simple_feature_rev,
        replace_simple_feature_reverse,
        content,
    )
    changes += n

    # Type E2: Simple question with question -> python -c
    def replace_simple_question_reverse(match):
        question = match.group(1).replace('"', "'")
        prompt = match.group(2).replace('"', "'")
        return f"python -c \"print('{question}'); question = input('{prompt}')\""

    pattern_simple_question_rev = r'python \.ouroboros/scripts/ouroboros_input\.py --question "([^"]*)" --prompt "([^"]*)" --var question'
    content, n = re.subn(
        pattern_simple_question_rev,
        replace_simple_question_reverse,
        content,
    )
    changes += n

    return content, changes


# =============================================================================
# BACKUP FUNCTIONS
# =============================================================================


def create_backup(repo_root: Path, files: list[Path]) -> Path:
    """Create backup of files before modification."""
    backup_dir = repo_root / BACKUP_DIR
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = backup_dir / timestamp
    backup_path.mkdir(parents=True, exist_ok=True)

    for file in files:
        try:
            rel_path = file.relative_to(repo_root)
            dest = backup_path / rel_path
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_text(file.read_text(encoding="utf-8"), encoding="utf-8")
        except IOError:
            continue

    return backup_path


# =============================================================================
# MAIN FUNCTIONS
# =============================================================================


def print_status(repo_root: Path) -> None:
    """Print current mode status."""
    mode = detect_current_mode(repo_root)
    files = get_all_md_files(repo_root)

    print(f"\n{'='*50}")
    print(f"  Ouroboros CCL Mode Status")
    print(f"{'='*50}")
    print(f"  Current Mode: {mode.upper()}")
    print(f"  Files Scanned: {len(files)}")
    print(f"{'='*50}\n")


def toggle_mode(repo_root: Path, target_mode: str | None, dry_run: bool) -> None:
    """Toggle or set CCL mode."""
    current_mode = detect_current_mode(repo_root)

    if target_mode is None:
        # Toggle to opposite mode
        target_mode = "enhanced" if current_mode == "default" else "default"

    if current_mode == target_mode:
        print(f"\n✓ Already in {target_mode.upper()} mode. No changes needed.\n")
        return

    files = get_all_md_files(repo_root)

    print(f"\n{'='*50}")
    print(f"  Ouroboros CCL Mode Toggle")
    print(f"{'='*50}")
    print(f"  From: {current_mode.upper()}")
    print(f"  To:   {target_mode.upper()}")
    print(f"  Files to process: {len(files)}")
    print(f"  Dry run: {'Yes' if dry_run else 'No'}")
    print(f"{'='*50}\n")

    if not dry_run:
        # Create backup
        backup_path = create_backup(repo_root, files)
        print(f"📦 Backup created: {backup_path.relative_to(repo_root)}\n")

    total_changes = 0
    files_modified = 0

    for file in files:
        try:
            content = file.read_text(encoding="utf-8")

            if target_mode == "enhanced":
                new_content, changes = convert_to_enhanced(content)
            else:
                new_content, changes = convert_to_default(content)

            if changes > 0:
                rel_path = file.relative_to(repo_root)
                print(f"  ✓ {rel_path}: {changes} command(s)")
                total_changes += changes
                files_modified += 1

                if not dry_run:
                    file.write_text(new_content, encoding="utf-8")

        except IOError as e:
            print(f"  ✗ Error processing {file}: {e}")

    print(f"\n{'='*50}")
    print(f"  Summary")
    print(f"{'='*50}")
    print(f"  Files modified: {files_modified}")
    print(f"  Commands changed: {total_changes}")

    if dry_run:
        print(f"\n  ⚠️  DRY RUN - No files were actually modified")
        print(f"  Run without --dry-run to apply changes\n")
    else:
        print(f"\n  ✓ Mode switched to {target_mode.upper()}\n")


# =============================================================================
# INTERACTIVE MENU (TUI)
# =============================================================================


def clear_screen() -> None:
    """Clear the terminal screen."""
    os.system("cls" if os.name == "nt" else "clear")


def print_header(repo_root: Path) -> None:
    """Print the interactive menu header."""
    mode = detect_current_mode(repo_root)
    mode_display = "🎨 ENHANCED" if mode == "enhanced" else "📝 DEFAULT"

    print("\n" + "=" * 50)
    print("  ♾️  OUROBOROS CCL TOGGLE")
    print("=" * 50)
    print(f"  Project: {repo_root.name}")
    print(f"  Current Mode: {mode_display}")
    print("=" * 50 + "\n")


def interactive_menu(repo_root: Path) -> None:
    """Display interactive menu for double-click users."""
    clear_screen()
    print_header(repo_root)

    current_mode = detect_current_mode(repo_root)
    opposite_mode = "enhanced" if current_mode == "default" else "default"
    opposite_display = "🎨 Enhanced" if opposite_mode == "enhanced" else "📝 Default"

    print("  Choose an option:\n")
    print(f"    [1] Switch to {opposite_display} mode")
    print("    [2] Preview changes (dry run)")
    print("    [3] Show detailed status")
    print("    [0] Exit\n")
    print("-" * 50)

    try:
        choice = input("  Enter choice (0-3): ").strip()
    except EOFError:
        choice = "0"

    print()

    if choice == "1":
        toggle_mode(repo_root, opposite_mode, dry_run=False)
    elif choice == "2":
        toggle_mode(repo_root, opposite_mode, dry_run=True)
    elif choice == "3":
        print_status(repo_root)
    elif choice == "0":
        print("  Goodbye! ♾️\n")
        return
    else:
        print("  ❌ Invalid choice. Please enter 0-3.\n")
        interactive_menu(repo_root)
        return

    # Wait for user to see results
    wait_for_exit()


def wait_for_exit() -> None:
    """Wait for user input before closing (for double-click users)."""
    print("-" * 50)
    try:
        input("  Press Enter to exit...")
    except EOFError:
        pass


def is_double_clicked() -> bool:
    """Check if script was likely double-clicked (no args and stdin is terminal)."""
    return len(sys.argv) == 1 and sys.stdin.isatty()


def parse_args() -> argparse.Namespace:
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(
        description="Toggle between Default and Enhanced CCL modes",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python ouroboros_toggle.py                  # Interactive menu (double-click)
  python ouroboros_toggle.py --mode enhanced  # Switch to enhanced mode
  python ouroboros_toggle.py --mode default   # Switch to default mode
  python ouroboros_toggle.py --dry-run        # Preview changes
  python ouroboros_toggle.py --status         # Show current mode
        """,
    )

    parser.add_argument(
        "--mode",
        "-m",
        choices=["enhanced", "default"],
        default=None,
        help="Target mode (default: toggle to opposite)",
    )
    parser.add_argument(
        "--dry-run",
        "-n",
        action="store_true",
        help="Preview changes without modifying files",
    )
    parser.add_argument(
        "--status", "-s", action="store_true", help="Show current mode status"
    )
    parser.add_argument(
        "--interactive", "-i", action="store_true", help="Force interactive menu mode"
    )
    parser.add_argument(
        "--version", action="version", version=f"ouroboros_toggle.py {VERSION}"
    )

    return parser.parse_args()


def main() -> None:
    """Main entry point."""
    args = parse_args()

    # Find repo root from script location first, then CWD
    script_path = Path(__file__).resolve().parent

    # Try to find from script location (for double-click)
    current = script_path
    repo_root = None
    while current != current.parent:
        if (current / ".github").exists():
            repo_root = current
            break
        current = current.parent

    # Fallback to CWD-based search
    if repo_root is None:
        repo_root = find_repo_root()

    # Check if project structure exists
    if not (repo_root / ".github").exists():
        print("\n❌ Error: Could not find Ouroboros project.")
        print("   Make sure .github/ and .ouroboros/ exist in your project.\n")
        if is_double_clicked():
            wait_for_exit()
        sys.exit(1)

    # Interactive mode for double-click or --interactive flag
    if is_double_clicked() or args.interactive:
        interactive_menu(repo_root)
    elif args.status:
        print_status(repo_root)
    else:
        toggle_mode(repo_root, args.mode, args.dry_run)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n✗ Cancelled\n")
        sys.exit(130)
