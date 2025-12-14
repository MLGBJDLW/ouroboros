# Enhanced CCL - Future Improvements

This document tracks planned improvements for the Enhanced CCL input system.

## Low Priority / Nice-to-Have

### 1. Text Selection Mode (Keyboard)
**Status**: Not Implemented

Enable text selection using Shift+Arrow keys:
- `Shift+Left/Right`: Select character by character
- `Shift+Ctrl+Left/Right`: Select word by word
- `Shift+Home/End`: Select to line start/end

**Considerations**:
- Need to track selection start and end positions
- Need visual highlighting for selected text (reverse video)
- Need to handle Cut (Ctrl+X), Copy (Ctrl+C) with selection

### 2. Undo/Redo Functionality
**Status**: Not Implemented

Enable undo/redo for text editing:
- `Ctrl+Z`: Undo last change
- `Ctrl+Shift+Z` or `Ctrl+Y`: Redo

**Considerations**:
- Need to maintain an undo stack of buffer states or operations
- Memory usage concerns for large buffers
- Should undo individual characters or "chunks" of typing?
- Badge insertion/deletion should be a single undo unit

---

## Completed Improvements

### Clipboard Paste (Ctrl+V) ✓
- Implemented in v2.2.0
- Reads clipboard directly (cross-platform)
- Creates `[ Pasted N Lines ]` badge for 5+ lines

### Atomic Badge Deletion ✓
- Implemented in v2.2.0
- Backspace/Delete removes entire badge at once

### Arrow Key Badge Navigation ✓
- Implemented in v2.2.0
- Cursor skips past badge internals

### Folder Detection ✓
- Implemented in v2.2.0
- `is_file_path()` now detects folders (directories without extensions)
