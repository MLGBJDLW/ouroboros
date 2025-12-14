#!/usr/bin/env python3
"""
ouroboros_filepath.py - File Path Detection and Formatting

Provides file path detection, validation, and display formatting for the Ouroboros CCL system.
Handles both Windows and Unix paths, with special badge formatting for UI display.

Dependencies: Python 3.6+ standard library only
"""

import os
import re

# =============================================================================
# FILE EXTENSION CATEGORIES
# =============================================================================

# Common file extensions for different categories
FILE_EXTENSIONS = {
    # Code files
    'code': {'.py', '.js', '.ts', '.tsx', '.jsx', '.java', '.c', '.cpp', '.h', '.hpp',
             '.cs', '.go', '.rs', '.rb', '.php', '.swift', '.kt', '.scala', '.lua',
             '.pl', '.r', '.m', '.mm', '.sh', '.bash', '.zsh', '.ps1', '.bat', '.cmd'},
    # Config/data files
    'config': {'.json', '.yaml', '.yml', '.xml', '.toml', '.ini', '.cfg', '.conf',
               '.env', '.properties', '.lock'},
    # Documentation
    'doc': {'.md', '.markdown', '.rst', '.txt', '.rtf', '.doc', '.docx', '.pdf',
            '.tex', '.org', '.adoc'},
    # Images
    'image': {'.png', '.jpg', '.jpeg', '.gif', '.bmp', '.svg', '.webp', '.ico',
              '.tiff', '.tif', '.psd', '.ai', '.eps'},
    # Audio/Video
    'media': {'.mp3', '.wav', '.ogg', '.flac', '.aac', '.m4a', '.wma',
              '.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv', '.webm'},
    # Archives
    'archive': {'.zip', '.tar', '.gz', '.bz2', '.7z', '.rar', '.xz'},
    # Web
    'web': {'.html', '.htm', '.css', '.scss', '.sass', '.less'},
    # Data
    'data': {'.csv', '.tsv', '.sql', '.db', '.sqlite', '.parquet', '.arrow'},
}

# Flatten all extensions for quick lookup
ALL_EXTENSIONS = set()
for exts in FILE_EXTENSIONS.values():
    ALL_EXTENSIONS.update(exts)

# Image extensions (for special handling)
IMAGE_EXTENSIONS = FILE_EXTENSIONS['image']

# Document extensions
DOC_EXTENSIONS = FILE_EXTENSIONS['doc']

# Code extensions
CODE_EXTENSIONS = FILE_EXTENSIONS['code'] | FILE_EXTENSIONS['web']

# File path patterns for regex matching
FILE_PATH_PATTERNS = [
    # Windows paths: C:\path\to\file.ext or "C:\path with spaces\file.ext"
    re.compile(r'^[A-Za-z]:\\(?:[^\\/:*?"<>|\r\n]+\\)*[^\\/:*?"<>|\r\n]*$'),
    # Unix paths: /path/to/file or ~/path/to/file
    re.compile(r'^(?:/|~/)(?:[^/\0]+/)*[^/\0]*$'),
    # Relative paths: ./file or ../file
    re.compile(r'^\.\.?/(?:[^/\0]+/)*[^/\0]*$'),
]


# =============================================================================
# PATH DETECTION FUNCTIONS
# =============================================================================

def is_file_path(text: str) -> bool:
    """
    Check if the given text looks like a file path.
    Handles both Windows and Unix paths.
    """
    text = text.strip().strip('"').strip("'")  # Remove quotes often added by terminals

    if not text:
        return False

    # Check for common path patterns
    # Windows: C:\path\file.ext or \\server\share\file.ext
    # Unix: /path/file.ext or ~/path/file.ext or ./path/file.ext

    # Windows absolute path
    if len(text) >= 3 and text[1] == ':' and text[2] in ('\\', '/'):
        return True

    # Windows UNC path
    if text.startswith('\\\\'):
        return True

    # Unix absolute path (but NOT slash commands like /ouroboros-spec)
    if text.startswith('/'):
        # Exclude slash commands (they start with /ouroboros)
        if text.startswith('/ouroboros'):
            return False
        # Must have at least one more path component to be a real path
        # e.g., /home/user not just /
        if len(text) > 1 and '/' in text[1:]:
            return True
        # Single slash or /filename - only if it has a file extension
        ext = os.path.splitext(text)[1].lower()
        if ext in ALL_EXTENSIONS:
            return True
        return False

    # Home directory
    if text.startswith('~'):
        return True

    # Relative path with known extension
    ext = os.path.splitext(text)[1].lower()
    if ext in ALL_EXTENSIONS:
        return True

    # Check if it looks like a path (contains path separators and an extension)
    if ('/' in text or '\\' in text) and '.' in text:
        ext = os.path.splitext(text)[1].lower()
        if ext:
            return True

    return False


def detect_file_path(text: str) -> str:
    """Detect if text is a file path. Returns the path or empty string."""
    text = text.strip().strip('"').strip("'")
    for pattern in FILE_PATH_PATTERNS:
        if pattern.match(text):
            return text
    return ''


def get_file_extension(path: str) -> str:
    """Get lowercase file extension from path."""
    if '.' in path:
        return '.' + path.rsplit('.', 1)[-1].lower()
    return ''


def get_file_category(path: str) -> str:
    """Get the category of a file based on its extension."""
    ext = get_file_extension(path)
    for category, extensions in FILE_EXTENSIONS.items():
        if ext in extensions:
            return category
    return 'file'


# =============================================================================
# DISPLAY FORMATTING FUNCTIONS
# =============================================================================

def format_file_display(path: str) -> str:
    """
    Format a file path for display as [ filename.ext ].
    Returns the formatted display string.
    """
    path = path.strip().strip('"').strip("'")

    # Extract filename
    filename = os.path.basename(path)

    if not filename:
        # Maybe it's a directory, use the last component
        parts = path.replace('\\', '/').rstrip('/').split('/')
        filename = parts[-1] if parts else path

    return f"[ {filename} ]"


def format_file_badge(path: str) -> str:
    """
    Format a file path as a simple badge for display.

    Internal storage: «/full/path/file.ext»
    Display format:   [ file.ext ]
    """
    # Extract filename
    filename = os.path.basename(path.strip().strip('«»'))
    if not filename:
        filename = path.split('/')[-1] or path.split('\\')[-1] or path

    # Simple badge without icons (per user request)
    return f"[ {filename} ]"


def format_file_reference(path: str) -> str:
    """Format a file path as a reference string with type indicator."""
    ext = get_file_extension(path)
    filename = path.replace('\\', '/').rsplit('/', 1)[-1] if '/' in path or '\\' in path else path

    if ext in IMAGE_EXTENSIONS:
        return f"[image: {filename}]"
    elif ext in DOC_EXTENSIONS:
        return f"[doc: {filename}]"
    elif ext in CODE_EXTENSIONS:
        return f"[code: {filename}]"
    else:
        return f"[file: {filename}]"


# =============================================================================
# PASTE CONTENT PROCESSING
# =============================================================================

def process_pasted_content(content: str) -> tuple:
    """
    Process pasted content to detect file paths.

    Returns:
        Tuple of (display_text, actual_text, is_file_path)
        - display_text: What to show in the UI
        - actual_text: What to store in the buffer (for AI)
        - is_file_path: Whether this is a file path
    """
    content = content.strip()

    # Check if it's a single file path (not multi-line)
    if '\n' not in content and is_file_path(content):
        display = format_file_display(content)
        # Store the actual path for AI, but display nicely
        return (display, content, True)

    # Check for multiple file paths (one per line)
    lines = content.split('\n')
    if len(lines) > 1 and all(is_file_path(line.strip()) for line in lines if line.strip()):
        # Multiple files - format each one
        display_lines = []
        for line in lines:
            if line.strip():
                display_lines.append(format_file_display(line.strip()))
        display = '\n'.join(display_lines)
        return (display, content, True)

    # Not a file path, return as-is
    return (content, content, False)


def convert_unmarked_file_paths(text: str) -> str:
    """
    Convert any unmarked file paths in text to the «path» format.

    This is a safety net for file paths that weren't detected during input
    (e.g., when Bracketed Paste Mode isn't supported and rapid input detection
    didn't trigger).

    Only converts paths that:
    1. Are not already marked with «»
    2. Look like absolute file paths (Windows or Unix)
    3. Are on their own line or surrounded by whitespace

    Args:
        text: The input text to process

    Returns:
        Text with file paths converted to «path» format
    """
    # Skip if text already contains markers (already processed)
    if '«' in text:
        return text

    # Pattern to match file paths:
    # - Windows: C:\path\to\file.ext or "C:\path with spaces\file.ext"
    # - Unix: /path/to/file or ~/path/to/file
    # Must be at start of line or after whitespace, and end at line end or before whitespace

    # Windows absolute path pattern (with optional quotes)
    win_pattern = r'(?:^|(?<=\s))("?[A-Za-z]:\\[^"\n]*"?)(?=\s|$)'
    # Unix absolute path pattern
    unix_pattern = r'(?:^|(?<=\s))((?:/|~/)[^\s\n]+)(?=\s|$)'

    result = text

    # Process Windows paths
    for match in re.finditer(win_pattern, result, re.MULTILINE):
        path = match.group(1).strip('"')
        if is_file_path(path):
            # Replace the match with marked version
            result = result[:match.start(1)] + f'«{path}»' + result[match.end(1):]

    # Process Unix paths (only if no Windows paths were found to avoid double processing)
    if '«' not in result:
        for match in re.finditer(unix_pattern, result, re.MULTILINE):
            path = match.group(1)
            if is_file_path(path):
                result = result[:match.start(1)] + f'«{path}»' + result[match.end(1):]

    return result


def format_paste_summary(text: str) -> str:
    """Format a multi-line paste as a summary."""
    lines = text.split('\n')
    line_count = len(lines)

    if line_count == 1:
        return text

    # Check if it looks like code
    code_indicators = ['{', '}', 'def ', 'function ', 'class ', 'import ', 'from ', '#include']
    is_code = any(indicator in text for indicator in code_indicators)

    if is_code:
        return f"[code: {line_count} lines]"
    else:
        return f"[text: {line_count} lines]"


def detect_and_format_input(text: str) -> tuple:
    """
    Detect input type and format appropriately.
    Returns (formatted_display, actual_content, input_type)

    input_type: 'text', 'file', 'image', 'doc', 'code', 'multiline'
    """
    text = text.strip()

    # Check for file path
    file_path = detect_file_path(text)
    if file_path:
        ext = get_file_extension(file_path)
        if ext in IMAGE_EXTENSIONS:
            return (format_file_reference(file_path), file_path, 'image')
        elif ext in DOC_EXTENSIONS:
            return (format_file_reference(file_path), file_path, 'doc')
        elif ext in CODE_EXTENSIONS:
            return (format_file_reference(file_path), file_path, 'code')
        else:
            return (format_file_reference(file_path), file_path, 'file')

    # Check for multi-line content
    if '\n' in text:
        line_count = len(text.split('\n'))
        return (format_paste_summary(text), text, 'multiline')

    return (text, text, 'text')
