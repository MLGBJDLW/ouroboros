"""
File path detection module for Ouroboros TUI.

This module provides file path detection and validation for both
Windows and Unix paths, including relative paths and known file extensions.


"""

import os
import re
from typing import Optional, Set

# =============================================================================
# FILE EXTENSION CATEGORIES
# =============================================================================

FILE_EXTENSIONS: dict[str, Set[str]] = {
    # Code files
    "code": {
        ".py",
        ".js",
        ".ts",
        ".tsx",
        ".jsx",
        ".java",
        ".c",
        ".cpp",
        ".h",
        ".hpp",
        ".cs",
        ".go",
        ".rs",
        ".rb",
        ".php",
        ".swift",
        ".kt",
        ".scala",
        ".lua",
        ".pl",
        ".r",
        ".m",
        ".mm",
        ".sh",
        ".bash",
        ".zsh",
        ".ps1",
        ".bat",
        ".cmd",
    },
    # Config/data files
    "config": {
        ".json",
        ".yaml",
        ".yml",
        ".xml",
        ".toml",
        ".ini",
        ".cfg",
        ".conf",
        ".env",
        ".properties",
        ".lock",
    },
    # Documentation
    "doc": {
        ".md",
        ".markdown",
        ".rst",
        ".txt",
        ".rtf",
        ".doc",
        ".docx",
        ".pdf",
        ".tex",
        ".org",
        ".adoc",
    },
    # Images
    "image": {
        ".png",
        ".jpg",
        ".jpeg",
        ".gif",
        ".bmp",
        ".svg",
        ".webp",
        ".ico",
        ".tiff",
        ".tif",
        ".psd",
        ".ai",
        ".eps",
    },
    # Audio/Video
    "media": {
        ".mp3",
        ".wav",
        ".ogg",
        ".flac",
        ".aac",
        ".m4a",
        ".wma",
        ".mp4",
        ".avi",
        ".mkv",
        ".mov",
        ".wmv",
        ".flv",
        ".webm",
    },
    # Archives
    "archive": {".zip", ".tar", ".gz", ".bz2", ".7z", ".rar", ".xz"},
    # Web
    "web": {".html", ".htm", ".css", ".scss", ".sass", ".less"},
    # Data
    "data": {".csv", ".tsv", ".sql", ".db", ".sqlite", ".parquet", ".arrow"},
}

# Flatten all extensions for quick lookup
ALL_EXTENSIONS: Set[str] = set()
for exts in FILE_EXTENSIONS.values():
    ALL_EXTENSIONS.update(exts)


# =============================================================================
# PATH DETECTION FUNCTIONS
# =============================================================================


def is_file_path(text: str) -> bool:
    """
    Check if the given text looks like a file or folder path.

    Handles:
    - Windows paths: C:\\path\\file.ext, "C:\\path with spaces\\file.ext"
    - Unix paths: /path/to/file, ~/path/to/file
    - Relative paths: ./file.py, ../folder/file.txt
    - Known file extensions

    Args:
        text: The text to check

    Returns:
        True if text appears to be a file path


    """
    text = text.strip().strip('"').strip("'")

    if not text:
        return False

    # Windows absolute path: C:\path or D:/path (case-insensitive drive letter)
    if len(text) >= 3 and text[0].isalpha() and text[1] == ":" and text[2] in ("\\", "/"):
        return _validate_windows_path(text)

    # Windows UNC path: \\server\share
    if text.startswith("\\\\"):
        return True

    # Unix absolute path: /path/to/file
    if text.startswith("/"):
        return _validate_unix_path(text)

    # Home directory: ~/path
    if text.startswith("~"):
        return True

    # Relative path: ./file or ../file
    if text.startswith("./") or text.startswith("../"):
        return True
    if text.startswith(".\\") or text.startswith("..\\"):
        return True

    # Check for known file extension
    ext = get_file_extension(text)
    if ext in ALL_EXTENSIONS:
        return True

    # Check if path contains separators and has an extension
    if ("/" in text or "\\" in text) and "." in text:
        ext = get_file_extension(text)
        if ext:
            return True

    # Check if path exists on disk
    if os.path.exists(text):
        return True

    return False


def _validate_windows_path(text: str) -> bool:
    """Validate a Windows absolute path."""
    # If path exists, it's valid
    if os.path.exists(text):
        return True

    # Check for known extension
    ext = get_file_extension(text)
    if ext in ALL_EXTENSIONS:
        return True

    # Path ends with separator - definitely a folder
    if text.endswith("\\") or text.endswith("/"):
        return True

    # Has multiple path components - likely valid
    if text.count("\\") >= 1 or text.count("/") >= 1:
        return True

    return False


def _validate_unix_path(text: str) -> bool:
    """Validate a Unix absolute path."""
    # Exclude slash commands (they start with /ouroboros)
    if text.startswith("/ouroboros"):
        return False

    # If path exists, it's valid
    if os.path.exists(text):
        return True

    # Must have at least one more path component
    if len(text) > 1 and "/" in text[1:]:
        return True

    # Single slash or /filename - only if it has a file extension
    ext = get_file_extension(text)
    if ext in ALL_EXTENSIONS:
        return True

    return False


def get_file_extension(path: str) -> str:
    """
    Get lowercase file extension from path.

    Args:
        path: File path string

    Returns:
        Extension with dot (e.g., '.py') or empty string
    """
    if "." in path:
        return "." + path.rsplit(".", 1)[-1].lower()
    return ""


def get_file_category(path: str) -> str:
    """
    Get the category of a file based on its extension.

    Args:
        path: File path string

    Returns:
        Category name ('code', 'config', 'doc', etc.) or 'file'
    """
    ext = get_file_extension(path)
    for category, extensions in FILE_EXTENSIONS.items():
        if ext in extensions:
            return category
    return "file"


def get_filename(path: str) -> str:
    """
    Extract filename from a path.

    Args:
        path: File path string

    Returns:
        Filename component of the path
    """
    path = path.strip().strip('"').strip("'").strip("«»")

    # Use os.path.basename
    filename = os.path.basename(path)

    if not filename:
        # Maybe it's a directory, use the last component
        parts = path.replace("\\", "/").rstrip("/").split("/")
        filename = parts[-1] if parts else path

    return filename


def detect_windows_path_start(char: str) -> bool:
    """
    Check if a character could be the start of a Windows path (drive letter).

    Used for drag-and-drop path detection on Windows.

    Args:
        char: Single character to check

    Returns:
        True if char is a valid drive letter (A-Z, a-z)


    """
    return char.isalpha() and len(char) == 1


def is_windows_path_pattern(text: str) -> bool:
    """
    Check if text matches Windows path pattern (letter + colon + backslash).

    Args:
        text: Text to check (at least 3 characters)

    Returns:
        True if text starts with Windows path pattern like 'C:\\'


    """
    if len(text) < 3:
        return False
    return text[0].isalpha() and text[1] == ":" and text[2] == "\\"


def format_file_display(path: str) -> str:
    """
    Format a file path for display as a badge.

    Args:
        path: File path string

    Returns:
        Display string like [ filename.ext ]
    """
    filename = get_filename(path)
    return f"[ {filename} ]"


def process_pasted_content(content: str, multiline_threshold: int = 5) -> tuple:
    """
    Process pasted content to detect file paths or large pastes.

    This is the main entry point for handling pasted content.
    It detects:
    1. Single file paths -> file marker
    2. Multiple file paths (one per line) -> multiple file markers
    3. Large pastes (5+ lines or 100+ chars) -> paste marker with badge
    4. Regular text -> pass through

    Args:
        content: The pasted content
        multiline_threshold: Number of lines to trigger paste badge (default 5)

    Returns:
        Tuple of (display_text, actual_text, is_special, paste_type)
        - display_text: What to show in the UI (badge or content)
        - actual_text: What to store in the buffer (marker format for AI extraction)
        - is_special: Whether this needs special handling (file path or large paste)
        - paste_type: 'file', 'multifile', 'paste', or 'text'


    """
    # Import badge functions here to avoid circular imports
    from .badge import create_file_marker, create_paste_marker, format_paste_badge

    content = content.strip()
    lines = content.split("\n")
    line_count = len(lines)

    # Check if it's a single file path (not multi-line)
    if "\n" not in content and is_file_path(content):
        display = format_file_display(content)
        # Store as marker for AI, display as badge
        marker = create_file_marker(content)
        return (display, marker, True, "file")

    # Check for multiple file paths (one per line)
    non_empty_lines = [line.strip() for line in lines if line.strip()]
    if len(non_empty_lines) > 1 and all(is_file_path(line) for line in non_empty_lines):
        # Multiple files - create markers for each
        markers = []
        displays = []
        for line in non_empty_lines:
            markers.append(create_file_marker(line))
            displays.append(format_file_display(line))
        return ("\n".join(displays), "\n".join(markers), True, "multifile")

    # Check for large multi-line paste (code, text, etc.)
    # Threshold: 5+ lines OR 100+ characters for single line
    is_large_paste = line_count >= multiline_threshold

    # Also treat long single lines (like pasted code snippets) as paste
    if not is_large_paste and line_count == 1 and len(content) > 100:
        is_large_paste = True

    if is_large_paste:
        # Large paste - create marker for storage, badge for display
        marker = create_paste_marker(content)
        badge = format_paste_badge(line_count)
        return (badge, marker, True, "paste")

    # Not a file path or large paste, return as-is
    return (content, content, False, "text")


def format_paste_badge(line_count: int, char_count: int = 0) -> str:
    """
    Format a paste badge for display.

    Args:
        line_count: Number of lines in the paste
        char_count: Optional character count for single-line pastes

    Returns:
        Badge string like [ Pasted 5 Lines ] or [ Pasted 1 Line (150 chars) ]
    """
    if line_count == 1:
        if char_count > 50:
            return f"[ Pasted 1 Line ({char_count} chars) ]"
        return "[ Pasted 1 Line ]"
    return f"[ Pasted {line_count} Lines ]"
