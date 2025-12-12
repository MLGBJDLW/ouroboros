#!/usr/bin/env python3
"""
ouroboros_input.py - Enhanced CCL Input Handler

Part of the Ouroboros system. Provides enhanced terminal input with:
- Mystic Purple theme
- Display compression for large pastes
- Auto multi-line detection
- File path detection
- Config caching for fast startup

Output separation:
- stderr: UI decorations (user sees)
- stdout: Clean formatted output (Copilot reads)

Usage:
    python ouroboros_input.py                                    # Type A: CCL
    python ouroboros_input.py --header "MENU" --prompt "Choice:" # Type B: Menu
    python ouroboros_input.py --prompt "Name:" --var feature     # Type C: Free-form
    python ouroboros_input.py --prompt "[y/n]:" --var confirm    # Type D: Confirm
    python ouroboros_input.py --prompt "Question:" --var question # Type E: Question
"""

import sys
import os
import time
import json
import argparse
from pathlib import Path

# =============================================================================
# CONSTANTS
# =============================================================================

VERSION = "1.1.0"
CONFIG_PATH = Path(__file__).parent / "ouroboros.config.json"
HISTORY_PATH = Path(__file__).parent / "ouroboros.history"
MAX_HISTORY_SIZE = 100  # Keep last N commands

# Mystic Purple Theme (ANSI codes)
COLORS = {
    'border':  '\033[95m',   # Magenta - brand identity
    'prompt':  '\033[96m',   # Cyan - modern, clean
    'success': '\033[92m',   # Green - confirmation
    'warning': '\033[93m',   # Yellow - hints
    'error':   '\033[91m',   # Red - errors
    'info':    '\033[94m',   # Blue - informational
    'bold':    '\033[1m',    # Bold
    'reset':   '\033[0m',    # Reset
}

# Unicode box drawing characters
BOX_UNICODE = {
    'tl': '╔', 'tr': '╗', 'bl': '╚', 'br': '╝',
    'h': '═', 'v': '║', 'lj': '╠', 'rj': '╣',
    'prompt': '❯', 'line': '│',
}

# ASCII fallback
BOX_ASCII = {
    'tl': '+', 'tr': '+', 'bl': '+', 'br': '+',
    'h': '-', 'v': '|', 'lj': '+', 'rj': '+',
    'prompt': '>', 'line': '|',
}

# File type categories
IMAGE_EXTS = {'.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.ico'}
VIDEO_EXTS = {'.mp4', '.mov', '.avi', '.webm', '.mkv'}
CODE_EXTS = {'.py', '.js', '.ts', '.jsx', '.tsx', '.java', '.c', '.cpp', '.h',
             '.cs', '.go', '.rs', '.rb', '.php', '.swift', '.kt', '.md', '.txt',
             '.json', '.yaml', '.yml', '.xml', '.html', '.css'}

# Detection thresholds
PASTE_SPEED_THRESHOLD = 50      # chars/sec to consider as paste
MIN_PASTE_LENGTH = 20           # minimum chars for paste detection
COMPRESS_THRESHOLD_LINES = 10   # compress if > N lines
COMPRESS_THRESHOLD_CHARS = 500  # compress if > N chars
PREVIEW_LINES_HEAD = 2          # show first N lines in preview
PREVIEW_LINES_TAIL = 2          # show last N lines in preview
LINE_TRUNCATE_WIDTH = 40        # truncate long lines in preview

# =============================================================================
# HISTORY MANAGEMENT
# =============================================================================

def load_history() -> list[str]:
    """Load command history from file."""
    if HISTORY_PATH.exists():
        try:
            with open(HISTORY_PATH, 'r', encoding='utf-8') as f:
                return [line.strip() for line in f.readlines() if line.strip()]
        except IOError:
            pass
    return []

def save_to_history(command: str) -> None:
    """Save command to history file."""
    if not command.strip():
        return
    
    try:
        history = load_history()
        # Avoid duplicating last command
        if history and history[-1] == command:
            return
        
        history.append(command)
        # Keep only last N commands
        history = history[-MAX_HISTORY_SIZE:]
        
        HISTORY_PATH.parent.mkdir(parents=True, exist_ok=True)
        with open(HISTORY_PATH, 'w', encoding='utf-8') as f:
            f.write('\n'.join(history) + '\n')
    except IOError:
        pass  # Silent fail

def setup_readline_history() -> bool:
    """Setup readline with history if available."""
    try:
        import readline
        # Load history into readline
        history = load_history()
        for cmd in history:
            readline.add_history(cmd)
        return True
    except ImportError:
        return False  # readline not available (Windows)

# =============================================================================
# CONFIG MANAGEMENT
# =============================================================================

def get_default_config() -> dict:
    """Get default configuration based on environment detection."""
    return {
        "platform": "windows" if os.name == 'nt' else "unix",
        "ansi_colors": detect_ansi_support(),
        "unicode_box": detect_unicode_support(),
        "theme": "mystic_purple",
        "auto_multiline": True,
        "compress_threshold": COMPRESS_THRESHOLD_LINES,
    }

def detect_ansi_support() -> bool:
    """Detect if terminal supports ANSI colors."""
    # Windows 10+ supports ANSI in most terminals
    if os.name == 'nt':
        try:
            version = sys.getwindowsversion()
            return version.major >= 10
        except AttributeError:
            return False
    # Unix/Linux/Mac generally support ANSI
    return True

def detect_unicode_support() -> bool:
    """Detect if terminal supports Unicode box drawing."""
    if os.name == 'nt':
        try:
            version = sys.getwindowsversion()
            return version.major >= 10
        except AttributeError:
            return False
    return True

def load_config() -> dict:
    """Load config from file, or create default if missing."""
    if CONFIG_PATH.exists():
        try:
            with open(CONFIG_PATH, 'r', encoding='utf-8') as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            pass  # Config corrupted, recreate
    
    # Create default config
    config = get_default_config()
    save_config(config)
    return config

def save_config(config: dict) -> None:
    """Save config to file."""
    try:
        CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
        with open(CONFIG_PATH, 'w', encoding='utf-8') as f:
            json.dump(config, f, indent=2)
    except IOError:
        pass  # Silent fail, config is optional

# =============================================================================
# UI FUNCTIONS (OUTPUT TO STDERR)
# =============================================================================

def ui_print(text: str = "", end: str = "\n") -> None:
    """Print to stderr (user sees, Copilot ignores)."""
    print(text, file=sys.stderr, end=end, flush=True)

def get_box_chars(config: dict, args) -> dict:
    """Get appropriate box characters based on config and args."""
    if args.ascii or not config.get('unicode_box', True):
        return BOX_ASCII
    return BOX_UNICODE

def get_colors(config: dict, args) -> dict:
    """Get colors (or empty strings if disabled)."""
    if args.no_color or not config.get('ansi_colors', True):
        return {k: '' for k in COLORS}
    return COLORS

def print_header_box(header: str, config: dict, args) -> None:
    """Print the header/menu box."""
    if args.no_ui:
        # Simple header without box
        if header:
            ui_print(header)
        return
    
    box = get_box_chars(config, args)
    colors = get_colors(config, args)
    
    # Parse header lines
    lines = header.split('\\n') if '\\n' in header else header.split('\n')
    width = max(len(line) for line in lines) + 4
    width = max(width, 40)  # minimum width
    
    # Top border
    ui_print(f"{colors['border']}{box['tl']}{box['h'] * width}{box['tr']}{colors['reset']}")
    
    # Content lines
    for line in lines:
        padded = line.ljust(width)
        ui_print(f"{colors['border']}{box['v']}{colors['reset']}  {padded}{colors['border']}{box['v']}{colors['reset']}")
    
    # Bottom border
    ui_print(f"{colors['border']}{box['bl']}{box['h'] * width}{box['br']}{colors['reset']}")

def print_welcome_box(config: dict, args) -> None:
    """Print the welcome box for Type A (CCL)."""
    if args.no_ui:
        return
    
    box = get_box_chars(config, args)
    colors = get_colors(config, args)
    width = 50
    
    ui_print()
    ui_print(f"{colors['border']}{box['tl']}{box['h'] * width}{box['tr']}{colors['reset']}")
    ui_print(f"{colors['border']}{box['v']}{colors['reset']}  ♾️  Ouroboros - Awaiting Command{' ' * 15}{colors['border']}{box['v']}{colors['reset']}")
    ui_print(f"{colors['border']}{box['lj']}{box['h'] * width}{box['rj']}{colors['reset']}")
    ui_print(f"{colors['border']}{box['v']}{colors['reset']}  ⌨️  Shortcuts:{' ' * 33}{colors['border']}{box['v']}{colors['reset']}")
    ui_print(f"{colors['border']}{box['v']}{colors['reset']}  • Multi-line: paste or <<<, end with >>>{' ' * 7}{colors['border']}{box['v']}{colors['reset']}")
    ui_print(f"{colors['border']}{box['v']}{colors['reset']}  • Submit: Enter | Cancel: Ctrl+C{' ' * 14}{colors['border']}{box['v']}{colors['reset']}")
    ui_print(f"{colors['border']}{box['bl']}{box['h'] * width}{box['br']}{colors['reset']}")
    ui_print()

def print_compression_box(content: str, config: dict, args) -> None:
    """Print compressed preview for large content."""
    if args.no_ui:
        return
    
    box = get_box_chars(config, args)
    colors = get_colors(config, args)
    
    lines = content.split('\n')
    line_count = len(lines)
    char_count = len(content)
    content_type = detect_content_type(content)
    
    ui_print()
    ui_print(f"{colors['border']}╭─────────────────────────────────────╮{colors['reset']}")
    ui_print(f"{colors['border']}│{colors['reset']} 📋 Content Received{' ' * 17}{colors['border']}│{colors['reset']}")
    ui_print(f"{colors['border']}│{colors['reset']}    Lines: {str(line_count):<25}{colors['border']}│{colors['reset']}")
    ui_print(f"{colors['border']}│{colors['reset']}    Size: {format_size(char_count):<26}{colors['border']}│{colors['reset']}")
    ui_print(f"{colors['border']}│{colors['reset']}    Type: {content_type:<26}{colors['border']}│{colors['reset']}")
    ui_print(f"{colors['border']}│{colors['reset']}{' ' * 37}{colors['border']}│{colors['reset']}")
    ui_print(f"{colors['border']}│{colors['reset']} ┌─ Preview ───────────────────────┐ {colors['border']}│{colors['reset']}")
    
    # Head lines
    for i in range(min(PREVIEW_LINES_HEAD, line_count)):
        truncated = truncate_line(lines[i], LINE_TRUNCATE_WIDTH)
        ui_print(f"{colors['border']}│{colors['reset']} │ {truncated:<34}│ {colors['border']}│{colors['reset']}")
    
    # Hidden count
    if line_count > PREVIEW_LINES_HEAD + PREVIEW_LINES_TAIL:
        hidden = line_count - PREVIEW_LINES_HEAD - PREVIEW_LINES_TAIL
        ui_print(f"{colors['border']}│{colors['reset']} │ {colors['warning']}... ({hidden} lines hidden) ...{colors['reset']}{' ' * 7}│ {colors['border']}│{colors['reset']}")
    
    # Tail lines
    for i in range(max(0, line_count - PREVIEW_LINES_TAIL), line_count):
        if i >= PREVIEW_LINES_HEAD:
            truncated = truncate_line(lines[i], LINE_TRUNCATE_WIDTH)
            ui_print(f"{colors['border']}│{colors['reset']} │ {truncated:<34}│ {colors['border']}│{colors['reset']}")
    
    ui_print(f"{colors['border']}│{colors['reset']} └─────────────────────────────────┘ {colors['border']}│{colors['reset']}")
    ui_print(f"{colors['border']}╰─────────────────────────────────────╯{colors['reset']}")
    ui_print()
    ui_print(f"{colors['success']}→ Full {line_count} lines sent to Copilot ✓{colors['reset']}")

def print_file_detected(file_info: dict, config: dict, args) -> None:
    """Print file detection info."""
    if args.no_ui:
        return
    
    colors = get_colors(config, args)
    
    icons = {'IMAGE': '📷', 'VIDEO': '🎬', 'FILE': '📄'}
    icon = icons.get(file_info['type'], '📄')
    
    ui_print()
    ui_print(f"  {icon} [{file_info['name']}] ({file_info['size']})")
    ui_print(f"  {colors['info']}ℹ️  {file_info['note']}{colors['reset']}")
    ui_print()

# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def detect_content_type(content: str) -> str:
    """Detect the type of pasted content."""
    content_lower = content.lower()
    
    if any(kw in content_lower for kw in ['error:', 'warn:', 'info:', 'debug:']):
        return "Log data"
    if content.strip().startswith('{') or content.strip().startswith('['):
        return "JSON data"
    if any(kw in content for kw in ['def ', 'function ', 'class ', 'import ', 'const ', 'let ']):
        return "Code"
    if 'Traceback' in content or ('at ' in content and '(' in content):
        return "Stack trace"
    return "Text"

def truncate_line(line: str, max_width: int) -> str:
    """Truncate a line to fit display width."""
    if len(line) <= max_width:
        return line
    return line[:max_width - 3] + "..."

def format_size(chars: int) -> str:
    """Format character count as human-readable size."""
    if chars < 1024:
        return f"{chars} chars"
    elif chars < 1024 * 1024:
        return f"{chars / 1024:.1f} KB"
    else:
        return f"{chars / (1024 * 1024):.1f} MB"

def format_file_size(bytes_count: int) -> str:
    """Format bytes as human-readable."""
    for unit in ['B', 'KB', 'MB', 'GB']:
        if bytes_count < 1024:
            return f"{bytes_count:.1f} {unit}"
        bytes_count /= 1024
    return f"{bytes_count:.1f} TB"

def detect_file_path(input_text: str) -> dict | None:
    """Detect and categorize file paths in input."""
    # Clean path (Windows drag adds quotes)
    cleaned = input_text.strip().strip('"').strip("'")
    
    # Check if it's a valid file path
    try:
        if not os.path.isfile(cleaned):
            return None
    except (OSError, ValueError):
        return None
    
    path = Path(cleaned)
    try:
        size = path.stat().st_size
    except OSError:
        size = 0
    
    ext = path.suffix.lower()
    size_str = format_file_size(size)
    
    if ext in IMAGE_EXTS:
        return {
            'type': 'IMAGE',
            'path': str(path.absolute()),
            'name': path.name,
            'size': size_str,
            'note': 'Attach in Chat UI for visual analysis'
        }
    elif ext in VIDEO_EXTS:
        return {
            'type': 'VIDEO',
            'path': str(path.absolute()),
            'name': path.name,
            'size': size_str,
            'note': 'Video path provided for reference'
        }
    elif ext in CODE_EXTS:
        return {
            'type': 'FILE',
            'path': str(path.absolute()),
            'name': path.name,
            'size': size_str,
            'note': 'Agent can read this file'
        }
    else:
        return {
            'type': 'FILE',
            'path': str(path.absolute()),
            'name': path.name,
            'size': size_str,
            'note': 'Unknown file type'
        }

def normalize_line_endings(text: str) -> str:
    """Normalize all line endings to \n."""
    return text.replace('\r\n', '\n').replace('\r', '\n')

# =============================================================================
# INPUT FUNCTIONS
# =============================================================================

def get_prompt_string(args, config: dict) -> str:
    """Build the prompt string with colors."""
    colors = get_colors(config, args)
    box = get_box_chars(config, args)
    
    if args.prompt:
        return f"{colors['prompt']}{box['prompt']}{colors['reset']} "
    else:
        return f"{colors['prompt']}{box['prompt']}{colors['reset']} "

def is_paste(line: str, elapsed: float) -> bool:
    """Detect if input was pasted (very fast typing)."""
    if elapsed <= 0 or len(line) < MIN_PASTE_LENGTH:
        return False
    chars_per_sec = len(line) / elapsed
    return chars_per_sec > PASTE_SPEED_THRESHOLD

def is_incomplete_syntax(line: str) -> bool:
    """Check if line looks like incomplete multi-line syntax."""
    stripped = line.rstrip()
    incomplete_markers = (':', '{', '[', '(', '"""', "'''", '`')
    return any(stripped.endswith(m) for m in incomplete_markers)

def get_multiline_input(first_line: str, config: dict, args) -> str:
    """Continue collecting multi-line input after detection."""
    colors = get_colors(config, args)
    box = get_box_chars(config, args)
    
    ui_print(f"  {colors['info']}↳ Multi-line detected. Double-Enter to submit:{colors['reset']}")
    
    lines = [first_line]
    empty_count = 0
    
    while True:
        try:
            line = input(f"  {box['line']} ")
            
            if line == "":
                empty_count += 1
                if empty_count >= 2:
                    break
                lines.append("")
            else:
                empty_count = 0
                if line.strip() == ">>>":
                    break
                lines.append(line)
                
        except EOFError:
            break
        except KeyboardInterrupt:
            ui_print(f"\n  {colors['error']}✗ Cancelled{colors['reset']}")
            sys.exit(130)
    
    return '\n'.join(lines).rstrip()

def get_input(args, config: dict) -> str:
    """Get user input with all enhancements."""
    colors = get_colors(config, args)
    box = get_box_chars(config, args)
    
    prompt_text = args.prompt if args.prompt else f"[Ouroboros] > "
    
    # Display prompt to stderr (so it doesn't go to Copilot)
    if args.prompt and args.prompt != "[Ouroboros] > ":
        ui_print(f"{prompt_text}", end=" ")
    else:
        ui_print(f"{colors['prompt']}{box['prompt']}{colors['reset']} ", end="")
    
    try:
        start_time = time.time()
        # Use empty string for input() - prompt already printed to stderr
        first_line = input()
        elapsed = time.time() - start_time
    except EOFError:
        return ""
    except KeyboardInterrupt:
        ui_print(f"\n{colors['error']}✗ Cancelled{colors['reset']}")
        sys.exit(130)
    
    # Normalize line endings
    first_line = normalize_line_endings(first_line)
    
    # Check for manual multi-line trigger
    if first_line.strip() == "<<<":
        ui_print(f"  {colors['info']}Multi-line mode. Type >>> or double-Enter to submit:{colors['reset']}")
        return get_multiline_input("", config, args)
    
    # Check for embedded newlines (some terminals preserve them in paste)
    if '\n' in first_line:
        content = first_line
        return content
    
    # Auto-detect multi-line need
    if config.get('auto_multiline', True):
        if is_paste(first_line, elapsed) or is_incomplete_syntax(first_line):
            return get_multiline_input(first_line, config, args)
    
    return first_line

# =============================================================================
# OUTPUT FUNCTIONS (TO STDOUT FOR COPILOT)
# =============================================================================

def format_output(var_name: str, content: str, file_info: dict | None = None) -> None:
    """Output formatted content to stdout for Copilot to parse."""
    marker_name = var_name.upper()
    
    if file_info:
        # File detected - use file type prefix
        print(f"=== {marker_name} START ===")
        print(f"[{file_info['type']}] {file_info['path']}")
        print(f"=== {marker_name} END ===")
    else:
        # Regular content
        print(f"=== {marker_name} START ===")
        print(content)
        print(f"=== {marker_name} END ===")

# =============================================================================
# MAIN
# =============================================================================

def parse_args() -> argparse.Namespace:
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(
        description="Ouroboros Enhanced Input Handler",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    
    parser.add_argument(
        '--prompt', '-p',
        type=str,
        default=None,
        help='Custom prompt text'
    )
    parser.add_argument(
        '--header', '-H',
        type=str,
        default=None,
        help='Header/menu text to display before prompt'
    )
    parser.add_argument(
        '--var', '-v',
        type=str,
        default='task',
        help='Variable name for output markers (default: task)'
    )
    parser.add_argument(
        '--no-ui',
        action='store_true',
        help='Disable fancy border/box UI'
    )
    parser.add_argument(
        '--no-color',
        action='store_true',
        help='Disable ANSI colors'
    )
    parser.add_argument(
        '--ascii',
        action='store_true',
        help='Use ASCII instead of Unicode box characters'
    )
    parser.add_argument(
        '--reset-config',
        action='store_true',
        help='Force re-detect environment and reset config'
    )
    parser.add_argument(
        '--version',
        action='version',
        version=f'ouroboros_input.py {VERSION}'
    )
    
    return parser.parse_args()

def main() -> None:
    """Main entry point."""
    args = parse_args()
    
    # Load or reset config
    if args.reset_config:
        config = get_default_config()
        save_config(config)
    else:
        config = load_config()
    
    # Setup command history (readline if available)
    has_readline = setup_readline_history()
    
    colors = get_colors(config, args)
    
    # Display header/menu if provided
    if args.header:
        print_header_box(args.header, config, args)
    elif not args.no_ui and not args.prompt:
        # Type A: Show welcome box for standard CCL
        print_welcome_box(config, args)
    
    # Get user input
    content = get_input(args, config)
    
    # Save to history (for recall next time)
    if content and not content.startswith('<<<'):
        save_to_history(content.split('\n')[0][:200])  # Save first line, max 200 chars
    
    # Check if input is empty
    if not content:
        format_output(args.var, "")
        return
    
    # Check for file path
    file_info = detect_file_path(content)
    
    if file_info:
        print_file_detected(file_info, config, args)
        format_output(args.var, content, file_info)
    else:
        # Check if we need to show compression
        lines = content.split('\n')
        if len(lines) > COMPRESS_THRESHOLD_LINES or len(content) > COMPRESS_THRESHOLD_CHARS:
            print_compression_box(content, config, args)
        
        format_output(args.var, content)

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        ui_print("\n\033[91m✗ Cancelled\033[0m")
        sys.exit(130)
    except BrokenPipeError:
        sys.exit(0)
