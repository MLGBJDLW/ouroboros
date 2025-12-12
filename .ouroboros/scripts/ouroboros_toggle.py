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
    'A': {
        'default': r'python -c "task = input\(\'\\[Ouroboros\\] > \'\)"',
        'enhanced': r'python \.ouroboros/scripts/ouroboros_input\.py',
        'default_template': 'python -c "task = input(\'[Ouroboros] > \')"',
        'enhanced_template': 'python .ouroboros/scripts/ouroboros_input.py',
    },
    
    # Type B: Menu selection with print + choice
    'B': {
        'default': r'python -c "print\(\'([^\']*)\'\); choice = input\(\'([^\']*)\'\)"',
        'enhanced': r'python \.ouroboros/scripts/ouroboros_input\.py --header "([^"]*)" --prompt "([^"]*)" --var choice',
        'default_template': 'python -c "print(\'{header}\'); choice = input(\'{prompt}\')"',
        'enhanced_template': 'python .ouroboros/scripts/ouroboros_input.py --header "{header}" --prompt "{prompt}" --var choice',
    },
    
    # Type C: Feature/free-form input
    'C': {
        'default': r'python -c "feature = input\(\'([^\']*)\'\)"',
        'enhanced': r'python \.ouroboros/scripts/ouroboros_input\.py --prompt "([^"]*)" --var feature',
        'default_template': 'python -c "feature = input(\'{prompt}\')"',
        'enhanced_template': 'python .ouroboros/scripts/ouroboros_input.py --prompt "{prompt}" --var feature',
    },
    
    # Type D: Confirmation (y/n)
    'D': {
        'default': r'python -c "(?:print\(\'([^\']*)\'\); )?confirm = input\(\'\\[y/n\\]: \'\)"',
        'enhanced': r'python \.ouroboros/scripts/ouroboros_input\.py(?:\s+--header "([^"]*)")? --prompt "\\[y/n\\]:" --var confirm --no-ui',
        'default_template': 'python -c "confirm = input(\'[y/n]: \')"',
        'default_template_with_print': 'python -c "print(\'{header}\'); confirm = input(\'[y/n]: \')"',
        'enhanced_template': 'python .ouroboros/scripts/ouroboros_input.py --prompt "[y/n]:" --var confirm --no-ui',
        'enhanced_template_with_header': 'python .ouroboros/scripts/ouroboros_input.py --header "{header}" --prompt "[y/n]:" --var confirm --no-ui',
    },
    
    # Type E: Question
    'E': {
        'default': r'python -c "question = input\(\'([^\']*)\'\)"',
        'enhanced': r'python \.ouroboros/scripts/ouroboros_input\.py --prompt "([^"]*)" --var question',
        'default_template': 'python -c "question = input(\'{prompt}\')"',
        'enhanced_template': 'python .ouroboros/scripts/ouroboros_input.py --prompt "{prompt}" --var question',
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
            content = file.read_text(encoding='utf-8')
            
            # Check for enhanced mode patterns
            if 'python .ouroboros/scripts/ouroboros_input.py' in content:
                enhanced_count += 1
            
            # Check for default mode patterns
            if 'python -c "task = input(\'[Ouroboros] > \')"' in content:
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
    
    # Type A: Standard CCL
    pattern_a = r'python -c "task = input\(\'\\[Ouroboros\\] > \'\)"'
    replacement_a = 'python .ouroboros/scripts/ouroboros_input.py'
    content, n = re.subn(pattern_a, replacement_a, content)
    changes += n
    
    # Type B: Menu with print + choice
    def replace_menu(match):
        header = match.group(1).replace('\\n', '\n').replace("'", '"')
        prompt = match.group(2).replace("'", '"')
        header_escaped = header.replace('\n', '\\n')
        return f'python .ouroboros/scripts/ouroboros_input.py --header "{header_escaped}" --prompt "{prompt}" --var choice'
    
    pattern_b = r'python -c "print\(\'((?:[^\'\\]|\\.)*)\'\); choice = input\(\'([^\']*)\'\)"'
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
            header = header.replace('\\n', '').strip().replace("'", '"')
            return f'python .ouroboros/scripts/ouroboros_input.py --header "{header}" --prompt "[y/n]:" --var confirm --no-ui'
        return 'python .ouroboros/scripts/ouroboros_input.py --prompt "[y/n]:" --var confirm --no-ui'
    
    pattern_d = r'python -c "(?:print\(\'([^\']*)\'\); )?confirm = input\(\'\\[y/n\\]: \'\)"'
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
    
    # Type A: Standard CCL
    pattern_a = r'python \.ouroboros/scripts/ouroboros_input\.py(?:\s|$)'
    # Need to be careful not to match with arguments
    def replace_ccl(match):
        return 'python -c "task = input(\'[Ouroboros] > \')"'
    
    # Match only the basic call without arguments
    pattern_a_exact = r'python \.ouroboros/scripts/ouroboros_input\.py(?=\s*$|\s*\n|\s*```)'
    content, n = re.subn(pattern_a_exact, replace_ccl, content, flags=re.MULTILINE)
    changes += n
    
    # Type B: Menu with header + prompt
    def replace_menu(match):
        header = match.group(1).replace('\\n', '\\\\n').replace('"', "'")
        prompt = match.group(2).replace('"', "'")
        return f'python -c "print(\'{header}\'); choice = input(\'{prompt}\')"'
    
    pattern_b = r'python \.ouroboros/scripts/ouroboros_input\.py --header "([^"]*)" --prompt "([^"]*)" --var choice'
    content, n = re.subn(pattern_b, replace_menu, content)
    changes += n
    
    # Type C: Feature input
    def replace_feature(match):
        prompt = match.group(1).replace('"', "'")
        return f'python -c "feature = input(\'{prompt}\')"'
    
    pattern_c = r'python \.ouroboros/scripts/ouroboros_input\.py --prompt "([^"]*)" --var feature'
    content, n = re.subn(pattern_c, replace_feature, content)
    changes += n
    
    # Type D: Confirmation
    def replace_confirm(match):
        header = match.group(1) if match.group(1) else None
        if header:
            header = header.replace('"', "'")
            return f'python -c "print(\'{header}\'); confirm = input(\'[y/n]: \')"'
        return 'python -c "confirm = input(\'[y/n]: \')"'
    
    pattern_d = r'python \.ouroboros/scripts/ouroboros_input\.py(?:\s+--header "([^"]*)")? --prompt "\[y/n\]:" --var confirm(?:\s+--no-ui)?'
    content, n = re.subn(pattern_d, replace_confirm, content)
    changes += n
    
    # Type E: Question
    def replace_question(match):
        prompt = match.group(1).replace('"', "'")
        return f'python -c "question = input(\'{prompt}\')"'
    
    pattern_e = r'python \.ouroboros/scripts/ouroboros_input\.py --prompt "([^"]*)" --var question'
    content, n = re.subn(pattern_e, replace_question, content)
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
            dest.write_text(file.read_text(encoding='utf-8'), encoding='utf-8')
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
            content = file.read_text(encoding='utf-8')
            
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
                    file.write_text(new_content, encoding='utf-8')
                    
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

def parse_args() -> argparse.Namespace:
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(
        description="Toggle between Default and Enhanced CCL modes",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python ouroboros_toggle.py                  # Auto-toggle mode
  python ouroboros_toggle.py --mode enhanced  # Switch to enhanced mode
  python ouroboros_toggle.py --mode default   # Switch to default mode
  python ouroboros_toggle.py --dry-run        # Preview changes
  python ouroboros_toggle.py --status         # Show current mode
        """
    )
    
    parser.add_argument(
        '--mode', '-m',
        choices=['enhanced', 'default'],
        default=None,
        help='Target mode (default: toggle to opposite)'
    )
    parser.add_argument(
        '--dry-run', '-n',
        action='store_true',
        help='Preview changes without modifying files'
    )
    parser.add_argument(
        '--status', '-s',
        action='store_true',
        help='Show current mode status'
    )
    parser.add_argument(
        '--version',
        action='version',
        version=f'ouroboros_toggle.py {VERSION}'
    )
    
    return parser.parse_args()

def main() -> None:
    """Main entry point."""
    args = parse_args()
    repo_root = find_repo_root()
    
    if args.status:
        print_status(repo_root)
    else:
        toggle_mode(repo_root, args.mode, args.dry_run)

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n✗ Cancelled\n")
        sys.exit(130)
