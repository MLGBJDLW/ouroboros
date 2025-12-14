#!/usr/bin/env python3
"""Debug Ctrl+V detection."""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from ouroboros_keybuffer import KeyBuffer, Keys

print("=" * 60)
print("Ctrl+V Debug Test")
print("=" * 60)
print()
print("Press Ctrl+V to test if we receive the key code.")
print("Press Ctrl+D to exit.")
print()
print("=" * 60)

with KeyBuffer() as kb:
    while True:
        key = kb.getch(timeout=0.1)
        if not key:
            continue
        
        # Check for Ctrl+V specifically
        if key == Keys.CTRL_V:
            print(f"[SUCCESS] Received Keys.CTRL_V (\\x16)")
            print("This means Ctrl+V detection works!")
        elif key == Keys.CTRL_D:
            print("\nCtrl+D pressed - exiting...")
            break
        elif len(key) == 1:
            code = ord(key)
            if code < 32:
                print(f"Control char: 0x{code:02x} (Ctrl+{chr(code + 64)})")
            elif key.isprintable():
                print(f"Printable: '{key}'")
            else:
                print(f"Non-printable: 0x{code:02x}")
        else:
            print(f"Multi-byte: {repr(key)}")
                
print("\nTest complete.")
