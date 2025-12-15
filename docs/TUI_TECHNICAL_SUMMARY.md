# Enhanced CCL TUI Refactor — Technical Summary (v3.1)

This document summarizes the architecture and key design decisions behind the refactored Ouroboros Enhanced CCL input system.

## Goals and Constraints

- **Zero dependencies**: the TUI and input stack use only the Python standard library.
- **Cross-platform**: supports Windows / macOS / Linux with consistent key behavior where possible.
- **Readable UI, clean output**: UI decorations go to **stderr**, while **stdout** stays machine-readable for AI ingestion.
- **Robust “badge” UX**: file paths and large pastes show as compact badges while preserving full content for submission.
- **Low flicker**: incremental updates where safe; full redraw only when required (resize/layout changes).

## High-Level Module Layout

The refactor moves from a monolithic script into a small package-style layout:

- `.ouroboros/scripts/tui/`
  - `app.py`: main loop and orchestration (modes, key routing, paste/path integration).
  - `screen.py`: screen lifecycle and curses/ANSI selection.
  - `window.py`: window abstraction over curses and ANSI fallback rendering.
  - `output.py`: marker expansion and stdout/stderr separation.
  - `fallback.py`: ANSI primitives and buffer-based fallback rendering support.
- `.ouroboros/scripts/components/`
  - `input_box.py`: dynamic input box rendering, cursor positioning, line numbers, incremental line updates.
  - `welcome_box.py`, `status_bar.py`, `selection_menu.py`: auxiliary UI components.
- `.ouroboros/scripts/input/`
  - `keybuffer.py`: cross-platform key interface.
  - `keybuffer_win.py` / `keybuffer_unix.py`: platform implementations.
  - `paste.py`: bracketed paste parsing + paste collection.
  - `clipboard.py`: cross-platform clipboard read.
  - `commands.py`: slash-command model and completion.
- `.ouroboros/scripts/data/`
  - `buffer.py`: text buffer with cursor, scrolling, insertion/deletion primitives.
  - `history.py`: persistent history with navigation/search.
  - `config.py`: config loading and defaults.
- `.ouroboros/scripts/utils/`
  - `badge.py`: marker formats and display conversions.
  - `filepath.py`: path heuristics and validation helpers.
  - `text.py`: width calculation (CJK-aware), visible-length helpers.

## Rendering Model (Curses + ANSI Fallback)

The renderer selects **curses** when available, otherwise uses an **ANSI fallback** path:

- **Curses mode**
  - Uses `curses` windows for drawing boxes and text.
  - Relies on curses for cursor placement and refresh control.
- **ANSI fallback mode**
  - Uses direct ANSI cursor movement and repainting.
  - Uses batched writes (save/restore cursor, hide/show cursor) to reduce flicker.
  - When the input box shrinks, extra rows must be explicitly removed to avoid border residue. This is handled via ANSI **Delete Line** (`DL`, `ESC [ n M`).

## Input Pipeline

The main loop in `tui/app.py` routes input through these layers:

1. `KeyBuffer` reads keys as normalized sequences (arrows, home/end, etc.).
2. `PasteDetector` handles **Bracketed Paste Mode** (when supported).
3. Windows-specific fallbacks:
   - **Event-count paste detection**: detects paste bursts via console input queue size.
   - **Ctrl+V key-state detection**: when terminals intercept Ctrl+V, the app reads the clipboard directly.
4. Keys are routed to:
   - editing actions (insert, backspace/delete, clear line, kill-to-end),
   - navigation (arrows, word left/right, home/end),
   - modes (history, reverse search),
   - slash-command autocomplete.

## Badge System (Markers vs Display)

Badges are built around a strict separation:

- **Internal storage (markers)**: placed in the buffer so submission can expand back to the original content.
- **UI display (badges)**: markers are rendered as compact labels.

Marker formats:

- **File marker**: `«/full/path/file.ext»` → displays as `[ file.ext ]`
- **Paste marker**: `‹PASTE:N›...‹/PASTE›` → displays as `[ Pasted N Lines ]`

Key properties:

- **Atomic operations**: cursor navigation and deletion treat badges as indivisible units.
- **Cursor positioning**: display column calculation accounts for CJK widths and marker→badge expansion.
- **Round-trip safety**: `expand_markers()` restores exact content for submission.

## Path Detection (Windows Drag-and-Drop)

Windows drag-and-drop often injects a path as raw text into the terminal. To produce a badge:

- Detect the start pattern `X:\` while typing.
- Temporarily collect characters until a delimiter (space) or a short timeout.
- Validate the collected string via `utils/filepath.py`.
- Replace raw text with a file marker (`«...»`) if it looks like a valid path.

## Output Contract (stderr UI vs stdout data)

The UI is drawn to **stderr** so the terminal shows the TUI, but the program’s **stdout** remains clean:

- `stdout`: the submitted content (with markers expanded) for downstream tooling (Copilot/LLM).
- `stderr`: all UI frames, borders, hints, animations.

This separation is critical to keep automated consumption stable while still presenting a rich interactive experience.

## Testing Strategy

The refactor includes property-based tests in `.ouroboros/scripts/tests/property/` focusing on correctness invariants:

- marker round-trips (file/paste),
- cursor movement semantics around badges,
- width calculations (including CJK),
- input box height behavior and scrolling rules,
- output purity (no ANSI pollution in stdout).

## Known Limitations

For platform-specific quirks (terminal support, IME, key interception), see `docs/LIMITATIONS.md`.

