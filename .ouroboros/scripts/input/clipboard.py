"""
Clipboard access module.

This module provides cross-platform clipboard access using
win32clipboard/ctypes on Windows and xclip/xsel/pbpaste on Unix.


"""

import sys
import subprocess
from typing import Optional

# Platform detection
IS_WINDOWS = sys.platform == "win32"
IS_MACOS = sys.platform == "darwin"
IS_LINUX = sys.platform.startswith("linux")


class ClipboardManager:
    """Cross-platform clipboard access."""

    def __init__(self):
        self._available = None

    def read(self) -> str:
        """
        Read text content from the system clipboard.

        Returns:
            The clipboard text content, or empty string if unavailable.
        """
        if IS_WINDOWS:
            return self._read_windows()
        elif IS_MACOS:
            return self._read_macos()
        elif IS_LINUX:
            return self._read_linux()
        return ""

    def _read_windows(self) -> str:
        """Read clipboard on Windows using ctypes."""
        try:
            import ctypes
            from ctypes import wintypes

            user32 = ctypes.windll.user32
            kernel32 = ctypes.windll.kernel32

            CF_UNICODETEXT = 13

            if not user32.OpenClipboard(None):
                return ""

            try:
                handle = user32.GetClipboardData(CF_UNICODETEXT)
                if not handle:
                    return ""

                kernel32.GlobalLock.restype = ctypes.c_void_p
                ptr = kernel32.GlobalLock(handle)
                if not ptr:
                    return ""

                try:
                    return ctypes.wstring_at(ptr)
                finally:
                    kernel32.GlobalUnlock(handle)
            finally:
                user32.CloseClipboard()
        except Exception:
            return ""

    def _read_macos(self) -> str:
        """Read clipboard on macOS using pbpaste."""
        try:
            result = subprocess.run(
                ["pbpaste"], capture_output=True, text=True, timeout=2
            )
            return result.stdout if result.returncode == 0 else ""
        except Exception:
            return ""

    def _read_linux(self) -> str:
        """Read clipboard on Linux using xclip, xsel, or wl-paste."""
        # Try xclip first
        try:
            result = subprocess.run(
                ["xclip", "-selection", "clipboard", "-o"],
                capture_output=True,
                text=True,
                timeout=2,
            )
            if result.returncode == 0:
                return result.stdout
        except FileNotFoundError:
            pass
        except Exception:
            pass

        # Try xsel
        try:
            result = subprocess.run(
                ["xsel", "--clipboard", "--output"],
                capture_output=True,
                text=True,
                timeout=2,
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
                ["wl-paste"], capture_output=True, text=True, timeout=2
            )
            if result.returncode == 0:
                return result.stdout
        except FileNotFoundError:
            pass
        except Exception:
            pass

        return ""

    def is_available(self) -> bool:
        """Check if clipboard reading is available on this platform."""
        if self._available is not None:
            return self._available

        if IS_WINDOWS:
            try:
                import ctypes

                ctypes.windll.user32
                self._available = True
            except Exception:
                self._available = False
        elif IS_MACOS:
            try:
                result = subprocess.run(
                    ["which", "pbpaste"], capture_output=True, timeout=1
                )
                self._available = result.returncode == 0
            except Exception:
                self._available = False
        elif IS_LINUX:
            for cmd in [["which", "xclip"], ["which", "xsel"], ["which", "wl-paste"]]:
                try:
                    result = subprocess.run(cmd, capture_output=True, timeout=1)
                    if result.returncode == 0:
                        self._available = True
                        return True
                except Exception:
                    pass
            self._available = False
        else:
            self._available = False

        return self._available


# Module-level convenience functions
_clipboard_manager: Optional[ClipboardManager] = None


def get_clipboard_manager() -> ClipboardManager:
    """Get the global ClipboardManager instance."""
    global _clipboard_manager
    if _clipboard_manager is None:
        _clipboard_manager = ClipboardManager()
    return _clipboard_manager


def read_clipboard() -> str:
    """Read text content from the system clipboard."""
    return get_clipboard_manager().read()


def has_clipboard_support() -> bool:
    """Check if clipboard reading is available on this platform."""
    return get_clipboard_manager().is_available()
