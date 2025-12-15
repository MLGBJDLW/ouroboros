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
import shutil
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
    Path("."),  # Root directory for AGENTS.md
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
    # Type C: Feature/free-form input (with optional menu)
    "C": {
        "default": r'python -c "feature = input\(\'([^\']*)\'\)"',
        "default_menu": r'python -c "print\(\);(?: print\(\'[^\']*\'\);)+ feature = input\(\'([^\']*)\'\)"',
        "enhanced": r'python \.ouroboros/scripts/ouroboros_input\.py(?:\s+--header "([^"]*)")? --prompt "([^"]*)" --var feature',
        "default_template": "python -c \"feature = input('{prompt}')\"",
        "enhanced_template": 'python .ouroboros/scripts/ouroboros_input.py --prompt "{prompt}" --var feature',
        "enhanced_template_with_header": 'python .ouroboros/scripts/ouroboros_input.py --header "{header}" --prompt "{prompt}" --var feature',
    },
    # Type D: Confirmation (y/n) with menu
    "D": {
        "default": r'python -c "confirm = input\(\'[^\']*\'\)"',
        "default_menu": r'python -c "print\(\);(?: print\(\'[^\']*\'\);)+ confirm = input\(\'([^\']*)\'\)"',
        "enhanced": r'python \.ouroboros/scripts/ouroboros_input\.py(?:\s+--header "([^"]*)")? --prompt "([^"]*)" --var confirm(?:\s+--no-ui)?',
        "default_template": "python -c \"confirm = input('[y/n]: ')\"",
        "default_template_menu": "python -c \"print(); print('[y] Yes'); print('[n] No'); confirm = input('{prompt}')\"",
        "enhanced_template": 'python .ouroboros/scripts/ouroboros_input.py --prompt "[y/n]:" --var confirm --no-ui',
        "enhanced_template_with_header": 'python .ouroboros/scripts/ouroboros_input.py --header "{header}" --prompt "{prompt}" --var confirm --no-ui',
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

    # Type B: Menu with multiple print() calls + choice
    # New format: print(); print('[1] A'); print('[2] B'); choice = input('...')
    def replace_menu_new(match):
        # Extract all the print statements and the prompt
        full_match = match.group(0)
        # Find all print('[x] ...') patterns
        print_items = re.findall(r"print\('(\[[^\]]+\][^']*)'\)", full_match)
        prompt_match = re.search(r"choice = input\('([^']*)'\)", full_match)
        prompt = prompt_match.group(1) if prompt_match else "Select:"

        # Build header from print items
        header = "\\n".join(print_items)
        return f'python .ouroboros/scripts/ouroboros_input.py --header "{header}" --prompt "{prompt}" --var choice'

    # Match: print(); print('[1] ...'); print('[2] ...'); ... choice = input('...')
    pattern_b_new = r'python -c "print\(\);(?: print\(\'\[[^\]]+\][^\']*\'\);)+ choice = input\(\'[^\']*\'\)"'
    content, n = re.subn(pattern_b_new, replace_menu_new, content)
    changes += n

    # Also match old format for backwards compatibility: print('\\n[1]...\\n[2]...'); choice = input('...')
    def replace_menu_old(match):
        header = match.group(1).replace("\\n", "\n").replace("'", '"')
        prompt = match.group(2).replace("'", '"')
        header_escaped = header.replace("\n", "\\n")
        return f'python .ouroboros/scripts/ouroboros_input.py --header "{header_escaped}" --prompt "{prompt}" --var choice'

    pattern_b_old = (
        r'python -c "print\(\'((?:[^\'\\]|\\.)*)\'\); choice = input\(\'([^\']*)\'\)"'
    )
    content, n = re.subn(pattern_b_old, replace_menu_old, content)
    changes += n

    # Type C: Feature input with menu (new format: print(); print('[1]...'); feature = input('...'))
    def replace_feature_menu(match):
        full_match = match.group(0)
        print_items = re.findall(r"print\('(\[[^\]]+\][^']*)'\)", full_match)
        prompt_match = re.search(r"feature = input\('([^']*)'\)", full_match)
        prompt = prompt_match.group(1) if prompt_match else "Feature:"
        header = "\\n".join(print_items)
        return f'python .ouroboros/scripts/ouroboros_input.py --header "{header}" --prompt "{prompt}" --var feature'

    pattern_c_menu = r'python -c "print\(\);(?: print\(\'\[[^\]]+\][^\']*\'\);)+ feature = input\(\'[^\']*\'\)"'
    content, n = re.subn(pattern_c_menu, replace_feature_menu, content)
    changes += n

    # Type C: Feature input simple (old format)
    def replace_feature(match):
        prompt = match.group(1).replace("'", '"')
        return f'python .ouroboros/scripts/ouroboros_input.py --prompt "{prompt}" --var feature'

    pattern_c = r'python -c "feature = input\(\'([^\']*)\'\)"'
    content, n = re.subn(pattern_c, replace_feature, content)
    changes += n

    # Type D: Confirmation with menu (new format: print(); print('[y]...'); confirm = input('...'))
    def replace_confirm_menu(match):
        full_match = match.group(0)
        print_items = re.findall(r"print\('(\[[^\]]+\][^']*)'\)", full_match)
        prompt_match = re.search(r"confirm = input\('([^']*)'\)", full_match)
        prompt = prompt_match.group(1) if prompt_match else "[y/n]:"
        header = "\\n".join(print_items)
        return f'python .ouroboros/scripts/ouroboros_input.py --header "{header}" --prompt "{prompt}" --var confirm --no-ui'

    pattern_d_menu = r'python -c "print\(\);(?: print\(\'\[[^\]]+\][^\']*\'\);)+ confirm = input\(\'[^\']*\'\)"'
    content, n = re.subn(pattern_d_menu, replace_confirm_menu, content)
    changes += n

    # Type D: Confirmation simple (old format)
    def replace_confirm(match):
        prompt = match.group(1) if match.group(1) else "[y/n]:"
        return f'python .ouroboros/scripts/ouroboros_input.py --prompt "{prompt}" --var confirm --no-ui'

    pattern_d = r'python -c "confirm = input\(\'([^\']*)\'\)"'
    content, n = re.subn(pattern_d, replace_confirm, content)
    changes += n

    # Type E: Question
    def replace_question(match):
        prompt = match.group(1).replace("'", '"')
        return f'python .ouroboros/scripts/ouroboros_input.py --prompt "{prompt}" --var question'

    pattern_e = r'python -c "question = input\(\'([^\']*)\'\)"'
    content, n = re.subn(pattern_e, replace_question, content)
    changes += n

    return content, changes


def convert_to_default(content: str) -> tuple[str, int]:
    """Convert enhanced mode commands back to default mode. Returns (new_content, count)."""
    changes = 0

    # Type A: Standard CCL - match standalone calls (no --arguments after)
    # Use negative lookahead to avoid matching calls with arguments
    pattern_a_exact = r"python \.ouroboros/scripts/ouroboros_input\.py(?!\s+--)"
    replacement_a = "python -c \"task = input('[Ouroboros] > ')\""
    content, n = re.subn(pattern_a_exact, replacement_a, content)
    changes += n

    # Type B: Menu with header + prompt -> convert to multiple print() calls
    def replace_menu(match):
        header = match.group(1)  # e.g., "[1] Option A\\n[2] Option B"
        prompt = match.group(2).replace('"', "'")

        # Split header by \\n and create multiple print() calls
        items = header.split("\\n")
        print_calls = "; ".join([f"print('{item}')" for item in items if item.strip()])

        return f"python -c \"print(); {print_calls}; choice = input('{prompt}')\""

    pattern_b = r'python \.ouroboros/scripts/ouroboros_input\.py --header "([^"]*)" --prompt "([^"]*)" --var choice'
    content, n = re.subn(pattern_b, replace_menu, content)
    changes += n

    # Type C: Feature input with header -> convert to multiple print() calls
    def replace_feature_with_header(match):
        header = match.group(1)
        prompt = match.group(2).replace('"', "'")
        items = header.split("\\n")
        print_calls = "; ".join([f"print('{item}')" for item in items if item.strip()])
        return f"python -c \"print(); {print_calls}; feature = input('{prompt}')\""

    pattern_c_header = r'python \.ouroboros/scripts/ouroboros_input\.py --header "([^"]*)" --prompt "([^"]*)" --var feature'
    content, n = re.subn(pattern_c_header, replace_feature_with_header, content)
    changes += n

    # Type C: Feature input simple (no header)
    def replace_feature(match):
        prompt = match.group(1).replace('"', "'")
        return f"python -c \"feature = input('{prompt}')\""

    pattern_c = r'python \.ouroboros/scripts/ouroboros_input\.py --prompt "([^"]*)" --var feature'
    content, n = re.subn(pattern_c, replace_feature, content)
    changes += n

    # Type D: Confirmation with header -> convert to multiple print() calls
    def replace_confirm_with_header(match):
        header = match.group(1)
        prompt = match.group(2).replace('"', "'")
        items = header.split("\\n")
        print_calls = "; ".join([f"print('{item}')" for item in items if item.strip()])
        return f"python -c \"print(); {print_calls}; confirm = input('{prompt}')\""

    pattern_d_header = r'python \.ouroboros/scripts/ouroboros_input\.py --header "([^"]*)" --prompt "([^"]*)" --var confirm(?:\s+--no-ui)?'
    content, n = re.subn(pattern_d_header, replace_confirm_with_header, content)
    changes += n

    # Type D: Confirmation simple (no header)
    def replace_confirm(match):
        prompt = match.group(1).replace('"', "'")
        return f"python -c \"confirm = input('{prompt}')\""

    pattern_d = r'python \.ouroboros/scripts/ouroboros_input\.py --prompt "([^"]*)" --var confirm(?:\s+--no-ui)?'
    content, n = re.subn(pattern_d, replace_confirm, content)
    changes += n

    # Type E: Question
    def replace_question(match):
        prompt = match.group(1).replace('"', "'")
        return f"python -c \"question = input('{prompt}')\""

    pattern_e = r'python \.ouroboros/scripts/ouroboros_input\.py --prompt "([^"]*)" --var question'
    content, n = re.subn(pattern_e, replace_question, content)
    changes += n

    return content, changes


# =============================================================================
# BACKUP FUNCTIONS
# =============================================================================


def cleanup_old_backups(backup_dir: Path, keep_count: int = 5) -> int:
    """
    Clean up old backup folders, keeping only the most recent ones.

    Args:
        backup_dir: Path to the backup directory
        keep_count: Number of most recent backups to keep (default: 5)

    Returns:
        Number of backup folders deleted
    """
    if not backup_dir.exists():
        return 0

    # Get all backup folders (they should be named with timestamps)
    backup_folders = [
        d
        for d in backup_dir.iterdir()
        if d.is_dir() and re.match(r"\d{8}_\d{6}", d.name)
    ]

    # Sort by name (timestamp format ensures chronological order)
    backup_folders.sort(reverse=True)

    # Delete old backups beyond keep_count
    deleted_count = 0
    for old_backup in backup_folders[keep_count:]:
        try:
            shutil.rmtree(old_backup)
            deleted_count += 1
        except Exception as e:
            print(f"  ⚠️  Could not delete old backup {old_backup.name}: {e}")

    return deleted_count


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

    # Clean up old backups after creating new one
    deleted = cleanup_old_backups(backup_dir, keep_count=5)
    if deleted > 0:
        print(f"  🧹 Cleaned up {deleted} old backup(s)")

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
