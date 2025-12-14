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
    Check if the given text looks like a file or folder path.
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
        # If path exists, it's valid (file or folder)
        if os.path.exists(text):
            return True
        # Check for known extension
        ext = os.path.splitext(text)[1].lower()
        if ext in ALL_EXTENSIONS:
            return True
        # Path ends with separator - definitely a folder
        if text.endswith('\\') or text.endswith('/'):
            return True
        # Has multiple path components - likely valid
        if text.count('\\') >= 1 or text.count('/') >= 1:
            return True
        return False

    # Windows UNC path
    if text.startswith('\\\\'):
        return True

    # Unix absolute path (but NOT slash commands like /ouroboros-spec)
    if text.startswith('/'):
        # Exclude slash commands (they start with /ouroboros)
        if text.startswith('/ouroboros'):
            return False
        # If path exists, it's valid
        if os.path.exists(text):
            return True
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

    # Relative path starting with ./ or ../
    if text.startswith('./') or text.startswith('../') or text.startswith('.\\') or text.startswith('..\\'):
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

    # Check if path exists on disk (covers folders without extensions)
    if os.path.exists(text):
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

def process_pasted_content(content: str, multiline_threshold: int = 5) -> tuple:
    """
    Process pasted content to detect file paths or large pastes.

    Returns:
        Tuple of (display_text, actual_text, is_special, paste_type)
        - display_text: What to show in the UI (badge or content)
        - actual_text: What to store in the buffer (marker format for AI extraction)
        - is_special: Whether this needs special handling (file path or large paste)
        - paste_type: 'file', 'multifile', 'paste', or 'text'
    """
    content = content.strip()
    lines = content.split('\n')
    line_count = len(lines)

    # Check if it's a single file path (not multi-line)
    if '\n' not in content and is_file_path(content):
        display = format_file_display(content)
        # Store the actual path for AI, but display nicely
        return (display, content, True, 'file')

    # Check for multiple file paths (one per line)
    if line_count > 1 and all(is_file_path(line.strip()) for line in lines if line.strip()):
        # Multiple files - format each one
        display_lines = []
        for line in lines:
            if line.strip():
                display_lines.append(format_file_display(line.strip()))
        display = '\n'.join(display_lines)
        return (display, content, True, 'multifile')

    # Check for large multi-line paste (code, text, etc.)
    # Threshold: 5+ lines OR 10+ characters for single line that looks like code
    is_large_paste = line_count >= multiline_threshold
    
    # Also treat long single lines (like pasted code snippets) as paste
    if not is_large_paste and line_count == 1 and len(content) > 100:
        # Long single line - could be minified code or long text
        is_large_paste = True
    
    if is_large_paste:
        # Large paste - create marker for storage, badge for display
        # Format: ‹PASTE:line_count›content‹/PASTE›
        marker = create_paste_marker(content)
        badge = format_paste_badge(line_count)
        return (badge, marker, True, 'paste')

    # Not a file path or large paste, return as-is
    return (content, content, False, 'text')


def format_paste_badge(line_count: int, char_count: int = 0) -> str:
    """Format a paste badge for display.
    
    Args:
        line_count: Number of lines in the paste
        char_count: Optional character count for additional info
    
    Returns:
        Badge string like "[ Pasted 5 Lines ]" or "[ Pasted 1 Line (150 chars) ]"
    """
    if line_count == 1:
        if char_count > 0:
            return f"[ Pasted 1 Line ({char_count} chars) ]"
        return "[ Pasted 1 Line ]"
    return f"[ Pasted {line_count} Lines ]"


def create_paste_marker(content: str) -> str:
    """
    Create a paste marker for internal storage.
    
    Format: ‹PASTE:line_count›encoded_content‹/PASTE›
    
    Newlines are encoded as ⏎ so the marker stays on a single buffer line.
    This allows the UI to display a badge while preserving
    the full content for submission to AI.
    """
    lines = content.split('\n')
    line_count = len(lines)
    # Encode newlines so marker stays on one line for display purposes
    # Use a special character that won't appear in normal text
    encoded = content.replace('\n', '⏎')
    return f"‹PASTE:{line_count}›{encoded}‹/PASTE›"


def parse_paste_marker(text: str) -> tuple:
    """
    Parse a paste marker to extract line count and content.
    
    Returns:
        Tuple of (line_count, content) or (0, text) if not a paste marker
    """
    import re
    match = re.match(r'‹PASTE:(\d+)›(.*)‹/PASTE›', text, re.DOTALL)
    if match:
        # Decode newlines (⏎ back to \n)
        content = match.group(2).replace('⏎', '\n')
        return (int(match.group(1)), content)
    return (0, text)


def is_paste_marker(text: str) -> bool:
    """Check if text is a paste marker."""
    return text.startswith('‹PASTE:') and text.endswith('‹/PASTE›')


def extract_paste_content(text: str) -> str:
    """
    Extract actual content from text, expanding any paste markers.
    
    This is used when submitting to AI - paste markers are replaced
    with their full content, preserving the original formatting.
    """
    import re
    # Replace all paste markers with their decoded content
    # Pattern: ‹PASTE:N›encoded_content‹/PASTE›
    def decode_and_extract(match):
        return match.group(1).replace('⏎', '\n')
    return re.sub(r'‹PASTE:\d+›(.*?)‹/PASTE›', decode_and_extract, text, flags=re.DOTALL)


def extract_all_special_content(text: str) -> str:
    """
    Extract all special content from text for submission to AI.
    
    This handles:
    1. File path markers: «/path/to/file» -> /path/to/file
    2. Paste markers: ‹PASTE:N›encoded_content‹/PASTE› -> decoded content
    
    The result is clean text suitable for AI consumption.
    """
    import re
    
    result = text
    
    # Extract file paths: «path» -> path
    result = re.sub(r'«([^»]+)»', r'\1', result)
    
    # Extract paste content and decode newlines: ‹PASTE:N›content‹/PASTE› -> content
    def decode_and_extract(match):
        return match.group(1).replace('⏎', '\n')
    result = re.sub(r'‹PASTE:\d+›(.*?)‹/PASTE›', decode_and_extract, result, flags=re.DOTALL)
    
    return result


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
