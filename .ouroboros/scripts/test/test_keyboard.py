#!/usr/bin/env python3
"""
test_keyboard.py - Interactive keyboard input diagnostic tool

Tests KeyBuffer functionality including arrow keys, modifiers, and special keys.
Run this to verify keyboard input works correctly in your terminal.

Usage: python test_keyboard.py
"""

import sys
import os

# Add parent directory to path
SCRIPT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if SCRIPT_DIR not in sys.path:
    sys.path.insert(0, SCRIPT_DIR)

from ouroboros_keybuffer import KeyBuffer, Keys

def main():
    print("=" * 60)
    print("Keyboard Input Diagnostic Tool")
    print("=" * 60)
    print("Press keys to see their codes. Press 'q' to quit.")
    print("=" * 60)

    with KeyBuffer() as kb:
        # Show internal state
        impl = kb._impl
        print(f"Platform: {type(impl).__name__}")
        if hasattr(impl, '_use_readconsole'):
            print(f"ReadConsole: {impl._use_readconsole}")
        if hasattr(impl, '_vt_input_mode'):
            print(f"VT Input Mode: {impl._vt_input_mode}")
        print("=" * 60)

        while True:
            key = kb.getch()

            if key == 'q':
                print("\nQuitting...")
                break

            # Format output
            hex_codes = ' '.join(f'0x{ord(c):02x}' for c in key) if key else 'empty'
            
            # Identify key
            key_name = None
            key_map = {
                Keys.UP: "UP", Keys.DOWN: "DOWN", Keys.LEFT: "LEFT", Keys.RIGHT: "RIGHT",
                Keys.CTRL_UP: "CTRL+UP", Keys.CTRL_DOWN: "CTRL+DOWN",
                Keys.CTRL_LEFT: "CTRL+LEFT", Keys.CTRL_RIGHT: "CTRL+RIGHT",
                Keys.HOME: "HOME", Keys.END: "END", Keys.DELETE: "DELETE",
                Keys.TAB: "TAB", Keys.ESCAPE: "ESCAPE",
                Keys.BACKSPACE: "BACKSPACE", Keys.BACKSPACE_WIN: "BACKSPACE",
                '\r': "ENTER", '\n': "NEWLINE",
            }
            key_name = key_map.get(key)
            
            if key_name:
                print(f"Key: {repr(key):20} ({hex_codes:30}) -> {key_name}")
            else:
                print(f"Key: {repr(key):20} ({hex_codes:30})")

if __name__ == '__main__':
    main()
