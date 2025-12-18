#!/usr/bin/env python3
"""
ouroboros_input.py - Enhanced CCL Input Handler v3.1

Part of the Ouroboros system. Provides enhanced terminal input with:
- Real-time character input with dynamic TUI
- Pre-reserved input box with visible borders
- Mystic Purple theme
- Multi-line support (Enter for newline, Ctrl+D to submit)
- Auto paste detection
- File path detection
- Slash command autocomplete

Output separation:
- stderr: UI decorations (user sees)
- stdout: Clean formatted output (Copilot reads)

Usage:
    python ouroboros_input.py                                    # Type A: CCL
    python ouroboros_input.py --header "MENU" --prompt "Choice:" # Type B: Menu
    python ouroboros_input.py --prompt "Name:" --var feature     # Type C: Free-form
    python ouroboros_input.py --options "opt1" "opt2" "opt3"     # Selection menu

Dependencies: Python 3.9+ standard library only (msvcrt/tty/termios)


"""

import sys
import os
import argparse
import re
import time
import atexit

# Version
VERSION = "3.1.0"

# Add script directory to path for imports
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
if SCRIPT_DIR not in sys.path:
    sys.path.insert(0, SCRIPT_DIR)


# =============================================================================
# THEME (Fallback)
# =============================================================================

THEME = {
    "border": "\033[95m",
    "prompt": "\033[96m",
    "success": "\033[92m",
    "warning": "\033[93m",
    "error": "\033[91m",
    "info": "\033[94m",
    "accent": "\033[95m\033[1m",
    "dim": "\033[2m",
    "reset": "\033[0m",
}


# =============================================================================
# UTILITY FUNCTIONS
# =============================================================================


def write(text: str) -> None:
    """Write text to stderr (UI output)."""
    sys.stderr.write(text)
    sys.stderr.flush()


def writeln(text: str = "") -> None:
    """Write line to stderr (UI output)."""
    write(text + "\n")


def is_pipe_input() -> bool:
    """
    Check if stdin is a pipe (not a TTY).


    """
    return not sys.stdin.isatty()


# =============================================================================
# GRACEFUL EXIT HANDLING
# =============================================================================

# Terminal state restoration flag
_terminal_restored = False


def restore_terminal() -> None:
    """
    Restore terminal state on exit.


    """
    global _terminal_restored
    if _terminal_restored:
        return
    _terminal_restored = True

    # Exit alternate screen buffer
    sys.stderr.write("\033[?1049l")
    # Show cursor
    sys.stderr.write("\033[?25h")
    # Reset attributes
    sys.stderr.write("\033[0m")
    sys.stderr.flush()


# Register atexit handler for terminal restoration
atexit.register(restore_terminal)


def show_goodbye_animation() -> None:
    """
    Display goodbye animation on Ctrl+C.


    """
    goodbye_frames = [
        f"{THEME['dim']}♾️  Goodbye...{THEME['reset']}",
        f"{THEME['accent']}♾️  See you soon~{THEME['reset']}",
        f"{THEME['border']}🐍 The serpent rests...{THEME['reset']}",
    ]
    for frame in goodbye_frames:
        write(f"\r{' ' * 40}\r{frame}")
        time.sleep(0.15)
    writeln("")


def graceful_exit(exit_code: int = 130) -> None:
    """
    Exit gracefully with animation and terminal restoration.


    """
    show_goodbye_animation()
    restore_terminal()
    sys.exit(exit_code)


# =============================================================================
# MENU OPTION PARSING
# =============================================================================


def detect_yes_no(prompt: str) -> bool:
    """
    Detect if prompt is a yes/no question.


    """
    return bool(re.search(r"\[y/n\]", prompt, re.IGNORECASE))


def parse_numbered_options(text: str) -> list:
    """
    Parse numbered options from text.

    Looks for patterns like:
    1. Option one
    2. Option two


    """
    options = []
    pattern = r"^\s*(\d+)[.)\]]\s*(.+)$"

    for line in text.split("\n"):
        match = re.match(pattern, line.strip())
        if match:
            options.append(match.group(2).strip())

    return options


def parse_menu_options(header: str, prompt: str = "") -> tuple:
    """
    Parse menu options from header text.

    Returns:
        Tuple of (title, options_list) if menu detected, (None, None) otherwise.


    """
    # Check for [y/n] confirmation pattern in prompt
    if prompt and detect_yes_no(prompt):
        title = header.replace("\\n", " ").strip() if header else "Confirm"
        return (title, ["Yes", "No"])

    # Support both actual newlines and escaped \n from command line
    if "\\n" in header:
        lines = header.split("\\n")
    else:
        lines = header.split("\n")

    if len(lines) < 2:
        return (None, None)

    title = None
    options = []

    for line in lines:
        line = line.strip()
        if not line:
            continue

        # Try to match numbered option patterns
        match = re.match(r"^\s*[\[\(]?(\d+)[\.\)\]:\s]\s*(.+)$", line)

        if match:
            options.append(match.group(2).strip())
        elif not options:
            # First non-option line before options = title
            title = line

    # Only return if we found at least 2 options
    if len(options) >= 2:
        return (title or "Select an option:", options)

    return (None, None)


# =============================================================================
# INPUT FUNCTIONS
# =============================================================================


def get_pipe_input() -> str:
    """
    Read input from pipe/stdin.


    """
    return sys.stdin.read().strip()


def get_simple_input(prompt: str = "") -> str:
    """
    Simple input for basic prompts.
    """
    if prompt:
        write(prompt + " ")
    try:
        return input()
    except EOFError:
        return ""
    except KeyboardInterrupt:
        graceful_exit(130)
        return ""  # Never reached


def get_fallback_input(show_ui: bool = True) -> str:
    """
    Fallback input using standard input() when TUI modules not available.
    """
    if show_ui:
        writeln()
        writeln(f"{THEME['border']}╔{'═' * 50}╗{THEME['reset']}")
        writeln(
            f"{THEME['border']}║{THEME['reset']}  [*]  Ouroboros - Awaiting Command{' ' * 15}{THEME['border']}║{THEME['reset']}"
        )
        writeln(f"{THEME['border']}╚{'═' * 50}╝{THEME['reset']}")
        writeln()

    write(f"{THEME['prompt']}>{THEME['reset']} ")

    try:
        line = input()
        if line.strip() == "<<<":
            # Multiline mode
            writeln(
                f"  {THEME['info']}Multi-line mode. Type >>> to submit:{THEME['reset']}"
            )
            lines = []
            while True:
                try:
                    next_line = input("  │ ")
                    if next_line.strip() == ">>>":
                        break
                    lines.append(next_line)
                except EOFError:
                    break
            return "\n".join(lines)
        return line
    except EOFError:
        return ""
    except KeyboardInterrupt:
        graceful_exit(130)
        return ""  # Never reached


# =============================================================================
# TUI INTEGRATION
# =============================================================================

# Try to import TUI modules
TUI_AVAILABLE = False
try:
    from tui import TUIApp, run_tui, format_output, write_output
    from components.selection_menu import SelectionMenu
    from input.keybuffer import KeyBuffer, Keys
    from input.commands import prepend_instruction

    TUI_AVAILABLE = True
except ImportError:
    pass


def get_tui_input(
    header: str = "", prompt: str = "", skip_welcome: bool = False
) -> str:
    """
    Get input using the new TUI system.


    """
    if not TUI_AVAILABLE:
        return get_fallback_input(show_ui=True)

    try:
        result = run_tui(
            header=header,
            prompt=prompt,
            skip_welcome=skip_welcome,
            show_line_numbers=True,
        )
        return result if result else ""
    except KeyboardInterrupt:
        graceful_exit(130)
        return ""  # Never reached


def get_selection_input(
    options: list, title: str = "Select an option:", allow_custom: bool = True
) -> str:
    """
    Interactive selection menu with arrow key navigation.


    """
    if not TUI_AVAILABLE:
        # Fallback to numbered selection
        writeln(title)
        for i, opt in enumerate(options):
            writeln(f"  {i+1}. {opt}")
        if allow_custom:
            writeln(f"  {len(options)+1}. [Custom input...]")
        choice = get_simple_input("Enter number: ")
        try:
            idx = int(choice) - 1
            if 0 <= idx < len(options):
                return options[idx]
            elif allow_custom and idx == len(options):
                return get_simple_input("Enter custom input: ")
        except ValueError:
            pass
        return choice  # Return as-is if invalid

    # Use TUI SelectionMenu
    try:
        from tui.screen import ScreenManager
        from tui.theme import ThemeManager

        with ScreenManager(use_alt_screen=True) as screen:
            theme = ThemeManager(screen)
            if screen.is_curses:
                theme.init_colors()

            menu = SelectionMenu(
                screen=screen,
                theme=theme,
                options=options,
                title=title,
                allow_custom=allow_custom,
            )

            cols, rows = screen.get_size()
            menu.render(y=2, width=cols)

            kb = KeyBuffer()
            kb.__enter__()

            try:
                while True:
                    key = kb.getch()

                    # Cancel
                    if key == Keys.CTRL_C or key == Keys.ESCAPE:
                        kb.__exit__(None, None, None)
                        graceful_exit(130)

                    # Navigation
                    if key == Keys.UP:
                        menu.move_up()
                        menu.render(y=2, width=cols)
                        continue

                    if key == Keys.DOWN:
                        menu.move_down()
                        menu.render(y=2, width=cols)
                        continue

                    if key in (Keys.PAGE_UP, "\033[5~"):
                        menu.page_up()
                        menu.render(y=2, width=cols)
                        continue

                    if key in (Keys.PAGE_DOWN, "\033[6~"):
                        menu.page_down()
                        menu.render(y=2, width=cols)
                        continue

                    if key in (Keys.HOME, Keys.HOME_ALT):
                        menu.home()
                        menu.render(y=2, width=cols)
                        continue

                    if key in (Keys.END, Keys.END_ALT):
                        menu.end()
                        menu.render(y=2, width=cols)
                        continue

                    # Number key selection
                    if key.isdigit() and key != "0":
                        if menu.select_by_number(int(key)):
                            menu.render(y=2, width=cols)
                        continue

                    # Enter to select
                    if key in (Keys.ENTER, "\r", "\n"):
                        idx, value, is_custom = menu.get_selected()
                        kb.__exit__(None, None, None)

                        if is_custom:
                            # Get custom input
                            return get_tui_input(prompt="Custom input")
                        return value

            finally:
                kb.__exit__(None, None, None)

    except KeyboardInterrupt:
        graceful_exit(130)
        return ""  # Never reached


# =============================================================================
# OUTPUT FUNCTIONS
# =============================================================================


def output_result(marker: str, content: str) -> None:
    """
    Output formatted content to stdout for AI consumption.

    When TUI is available, the Task Box already shows the content visually,
    so we suppress the visible stdout echo while still sending to stdout.


    """
    if TUI_AVAILABLE:
        # Use TUI output formatting
        formatted = format_output(content)

        # Print to stdout (so AI can read it), then immediately clear from screen
        # Count how many lines we'll print
        line_count = formatted.count("\n") + 1  # +1 for print's trailing newline

        # Print the content (AI reads this from stdout)
        print(formatted)

        # Move cursor up and clear the lines we just printed
        # This makes the output invisible on terminal but still in stdout
        sys.stderr.write(f"\033[{line_count}A")  # Move cursor up
        sys.stderr.write("\033[J")  # Clear from cursor to end of screen
        sys.stderr.flush()

        # Show a visible submission box on stderr (user feedback) while keeping
        # stdout pristine for Copilot consumption.
        try:
            from tui.output import OutputBox, THEME as OUTPUT_THEME  # type: ignore

            total_lines = formatted.count("\n") + (1 if formatted else 0)
            total_chars = len(formatted)

            # Build a preview for display (avoid dumping huge payloads to the terminal).
            max_preview_lines = 20
            max_preview_chars = 4000
            preview_lines = formatted.splitlines()
            truncated = False

            if len(preview_lines) > max_preview_lines:
                preview_lines = preview_lines[:max_preview_lines]
                truncated = True

            preview = "\n".join(preview_lines)
            if len(preview) > max_preview_chars:
                preview = preview[:max_preview_chars]
                truncated = True

            header = (
                f"{OUTPUT_THEME['success']}✓ "
                f"Transmitted {total_lines} lines ({total_chars} chars) to Copilot"
                f"{OUTPUT_THEME['reset']}"
            )

            display_parts = [header]
            if preview:
                display_parts.extend(["", preview])
            if truncated:
                display_parts.extend(
                    [
                        "",
                        f"{OUTPUT_THEME['dim']}... (preview truncated; full content sent to Copilot){OUTPUT_THEME['reset']}",
                    ]
                )

            # Add a blank line before the box to separate from previous output.
            sys.stderr.write("\n")
            sys.stderr.flush()

            OutputBox.render(marker, "\n".join(display_parts), full_width=True)
        except Exception:
            pass
    else:
        # Fallback: prepend instruction if slash command
        formatted = content
        if content.strip().startswith("/"):
            # Simple slash command detection
            cmd = content.strip().split()[0]
            agent_map = {
                "/ouroboros": "ouroboros.agent.md",
                "/ouroboros-spec": "ouroboros-spec.agent.md",
                "/ouroboros-init": "ouroboros-init.agent.md",
                "/ouroboros-implement": "ouroboros-implement.agent.md",
                "/ouroboros-archive": "ouroboros-archive.agent.md",
            }
            if cmd in agent_map:
                formatted = (
                    f"Follow the prompt '.github/agents/{agent_map[cmd]}'\n\n{content}"
                )

        # Output to stdout (visible in fallback mode)
        print(formatted)


# =============================================================================
# CLI ARGUMENT PARSING
# =============================================================================


def parse_args():
    """
    Parse command line arguments.


    """
    parser = argparse.ArgumentParser(
        description="Ouroboros Enhanced Input Handler v3",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--var", default="task", help="Variable name for output marker")
    parser.add_argument("--prompt", default="", help="Custom prompt text")
    parser.add_argument("--header", default="", help="Header/menu text (Type B)")
    parser.add_argument(
        "--question",
        default="",
        help="Question text to display above input (auto word-wrap)",
    )
    parser.add_argument(
        "--options", nargs="+", help="Options for selection menu (space-separated)"
    )
    parser.add_argument(
        "--no-custom",
        action="store_true",
        help="Disable custom input in selection menu",
    )
    parser.add_argument("--no-ui", action="store_true", help="Disable UI decorations")
    parser.add_argument("--ascii", action="store_true", help="Use ASCII characters")
    parser.add_argument("--no-color", action="store_true", help="Disable colors")
    parser.add_argument(
        "--reset-config", action="store_true", help="Reset configuration"
    )
    parser.add_argument("--version", action="version", version=f"%(prog)s {VERSION}")
    return parser.parse_args()


# =============================================================================
# MODE DETECTION
# =============================================================================


def detect_mode(args) -> str:
    """
    Detect input mode based on arguments and environment.

    Modes:
    - 'pipe': stdin is a pipe
    - 'selection': --options provided
    - 'menu': --header with numbered options or [y/n]
    - 'prompt': --prompt provided
    - 'ccl': default CCL mode


    """
    # Check for pipe input first
    if is_pipe_input():
        return "pipe"

    # Check for explicit selection menu
    if args.options:
        return "selection"

    # Check for header with menu options
    if args.header:
        title, options = parse_menu_options(args.header, args.prompt)
        if options:
            return "menu"
        return "header"

    # Check for simple prompt
    if args.prompt:
        return "prompt"

    # Default: CCL mode
    return "ccl"


# =============================================================================
# MAIN
# =============================================================================


def main():
    """
    Main entry point.


    """
    args = parse_args()

    # Update theme if colors disabled
    if args.no_color:
        for key in THEME:
            THEME[key] = ""

    # Detect mode
    mode = detect_mode(args)

    # Prepare question header (if provided)
    # Question text is displayed above the input/menu
    question_header = args.question if hasattr(args, "question") else ""

    try:
        # Handle each mode
        if mode == "pipe":
            # Pipe input - read directly without UI
            content = get_pipe_input()

        elif mode == "selection":
            # Explicit selection menu
            title = args.prompt or "Select an option:"
            # Prepend question to title if provided
            if question_header:
                title = f"{question_header}\n\n{title}"
            content = get_selection_input(
                options=args.options,
                title=title,
                allow_custom=not args.no_custom,
            )

        elif mode == "menu":
            # Header with detected menu options
            title, options = parse_menu_options(args.header, args.prompt)
            is_yes_no = detect_yes_no(args.prompt) if args.prompt else False

            # Prepend question to title if provided
            if question_header:
                title = f"{question_header}\n\n{title}"

            content = get_selection_input(
                options=options, title=title, allow_custom=not is_yes_no
            )

            # Map Yes/No back to y/n for compatibility
            if is_yes_no:
                if content.lower().startswith("yes"):
                    content = "y"
                elif content.lower().startswith("no"):
                    content = "n"

        elif mode == "header":
            # Header without menu - show as welcome, then input
            header = args.header
            # Prepend question to header if provided
            if question_header:
                header = f"{question_header}\n\n{header}"
            content = get_tui_input(
                header=header, prompt=args.prompt or "[Ouroboros] > "
            )

        elif mode == "prompt":
            # Simple prompt mode
            if args.no_ui:
                # For no-ui, print question first
                if question_header:
                    writeln(question_header)
                content = get_simple_input(args.prompt)
            else:
                header = question_header if question_header else ""
                content = get_tui_input(header=header, prompt=args.prompt)

        else:
            # CCL mode (default)
            if args.no_ui:
                if question_header:
                    writeln(question_header)
                content = get_fallback_input(show_ui=False)
            else:
                # Pass question as header for display
                content = get_tui_input(header=question_header)

        # Output result
        if content:
            output_result(args.var, content)

    except KeyboardInterrupt:
        graceful_exit(130)


if __name__ == "__main__":
    main()
