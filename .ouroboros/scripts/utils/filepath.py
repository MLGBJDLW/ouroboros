"""
File path detection module for Ouroboros TUI.

This module provides file path detection and validation for both
Windows and Unix paths, including relative paths and known file extensions.

Requirements: 6.1-6.6, 31.1-31.5
"""

import os
import re
from typing import Optional, Set

# =============================================================================
# FILE EXTENSION CATEGORIES
# =============================================================================

FILE_EXTENSIONS: dict[str, Set[str]] = {
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
        
    Requirements: 6.1-6.6, 31.1-31.5
    """
    text = text.strip().strip('"').strip("'")
    
    if not text:
        return False
    
    # Windows absolute path: C:\path or D:/path
    if len(text) >= 3 and text[1] == ':' and text[2] in ('\\', '/'):
        return _validate_windows_path(text)
    
    # Windows UNC path: \\server\share
    if text.startswith('\\\\'):
        return True
    
    # Unix absolute path: /path/to/file
    if text.startswith('/'):
        return _validate_unix_path(text)
    
    # Home directory: ~/path
    if text.startswith('~'):
        return True
    
    # Relative path: ./file or ../file
    if text.startswith('./') or text.startswith('../'):
        return True
    if text.startswith('.\\') or text.startswith('..\\'):
        return True
    
    # Check for known file extension
    ext = get_file_extension(text)
    if ext in ALL_EXTENSIONS:
        return True
    
    # Check if path contains separators and has an extension
    if ('/' in text or '\\' in text) and '.' in text:
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
    if text.endswith('\\') or text.endswith('/'):
        return True
    
    # Has multiple path components - likely valid
    if text.count('\\') >= 1 or text.count('/') >= 1:
        return True
    
    return False


def _validate_unix_path(text: str) -> bool:
    """Validate a Unix absolute path."""
    # Exclude slash commands (they start with /ouroboros)
    if text.startswith('/ouroboros'):
        return False
    
    # If path exists, it's valid
    if os.path.exists(text):
        return True
    
    # Must have at least one more path component
    if len(text) > 1 and '/' in text[1:]:
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
    if '.' in path:
        return '.' + path.rsplit('.', 1)[-1].lower()
    return ''


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
    return 'file'


def get_filename(path: str) -> str:
    """
    Extract filename from a path.
    
    Args:
        path: File path string
        
    Returns:
        Filename component of the path
    """
    path = path.strip().strip('"').strip("'").strip('«»')
    
    # Use os.path.basename
    filename = os.path.basename(path)
    
    if not filename:
        # Maybe it's a directory, use the last component
        parts = path.replace('\\', '/').rstrip('/').split('/')
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
        
    Requirements: 31.1-31.5
    """
    return char.isalpha() and len(char) == 1


def is_windows_path_pattern(text: str) -> bool:
    """
    Check if text matches Windows path pattern (letter + colon + backslash).
    
    Args:
        text: Text to check (at least 3 characters)
        
    Returns:
        True if text starts with Windows path pattern like 'C:\\'
        
    Requirements: 31.1-31.5
    """
    if len(text) < 3:
        return False
    return text[0].isalpha() and text[1] == ':' and text[2] == '\\'
