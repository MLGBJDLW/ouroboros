#!/usr/bin/env python3
"""
Cross-platform clipboard utilities.
Reads clipboard content without any external dependencies.

Supports:
- Windows: Uses ctypes to call Windows API
- macOS: Uses pbpaste subprocess
- Linux: Uses xclip/xsel subprocess
"""
import sys
import subprocess

# Platform detection
IS_WINDOWS = sys.platform == 'win32'
IS_MACOS = sys.platform == 'darwin'
IS_LINUX = sys.platform.startswith('linux')


def read_clipboard() -> str:
    """
    Read text content from the system clipboard.
    
    Returns:
        The clipboard text content, or empty string if unavailable.
    """
    if IS_WINDOWS:
        return _read_clipboard_windows()
    elif IS_MACOS:
        return _read_clipboard_macos()
    elif IS_LINUX:
        return _read_clipboard_linux()
    else:
        return ""


def _read_clipboard_windows() -> str:
    """Read clipboard on Windows using ctypes."""
    try:
        import ctypes
        from ctypes import wintypes
        
        user32 = ctypes.windll.user32
        kernel32 = ctypes.windll.kernel32
        
        # Constants
        CF_UNICODETEXT = 13
        GMEM_MOVEABLE = 0x0002
        
        # Open clipboard
        if not user32.OpenClipboard(None):
            return ""
        
        try:
            # Get clipboard data handle
            handle = user32.GetClipboardData(CF_UNICODETEXT)
            if not handle:
                return ""
            
            # Lock the handle to get pointer
            kernel32.GlobalLock.restype = ctypes.c_void_p
            ptr = kernel32.GlobalLock(handle)
            if not ptr:
                return ""
            
            try:
                # Read the string
                return ctypes.wstring_at(ptr)
            finally:
                kernel32.GlobalUnlock(handle)
        finally:
            user32.CloseClipboard()
    except Exception:
        return ""


def _read_clipboard_macos() -> str:
    """Read clipboard on macOS using pbpaste."""
    try:
        result = subprocess.run(
            ['pbpaste'],
            capture_output=True,
            text=True,
            timeout=2
        )
        return result.stdout if result.returncode == 0 else ""
    except Exception:
        return ""


def _read_clipboard_linux() -> str:
    """Read clipboard on Linux using xclip or xsel."""
    # Try xclip first (more common)
    try:
        result = subprocess.run(
            ['xclip', '-selection', 'clipboard', '-o'],
            capture_output=True,
            text=True,
            timeout=2
        )
        if result.returncode == 0:
            return result.stdout
    except FileNotFoundError:
        pass
    except Exception:
        pass
    
    # Try xsel as fallback
    try:
        result = subprocess.run(
            ['xsel', '--clipboard', '--output'],
            capture_output=True,
            text=True,
            timeout=2
        )
        if result.returncode == 0:
            return result.stdout
    except FileNotFoundError:
        pass
    except Exception:
        pass
    
    # Try wl-paste for Wayland
    try:
        result = subprocess.run(
            ['wl-paste'],
            capture_output=True,
            text=True,
            timeout=2
        )
        if result.returncode == 0:
            return result.stdout
    except FileNotFoundError:
        pass
    except Exception:
        pass
    
    return ""


def has_clipboard_support() -> bool:
    """Check if clipboard reading is available on this platform."""
    if IS_WINDOWS:
        try:
            import ctypes
            ctypes.windll.user32
            return True
        except Exception:
            return False
    elif IS_MACOS:
        try:
            result = subprocess.run(
                ['which', 'pbpaste'],
                capture_output=True,
                timeout=1
            )
            return result.returncode == 0
        except Exception:
            return False
    elif IS_LINUX:
        # Check for any of the clipboard tools
        for cmd in [['which', 'xclip'], ['which', 'xsel'], ['which', 'wl-paste']]:
            try:
                result = subprocess.run(cmd, capture_output=True, timeout=1)
                if result.returncode == 0:
                    return True
            except Exception:
                pass
        return False
    return False


# Quick test
if __name__ == '__main__':
    print(f"Platform: {sys.platform}")
    print(f"Clipboard support: {has_clipboard_support()}")
    
    content = read_clipboard()
    if content:
        lines = content.split('\n')
        print(f"Clipboard has {len(lines)} lines, {len(content)} chars")
        print(f"First 100 chars: {content[:100]!r}")
    else:
        print("Clipboard is empty or not accessible")
