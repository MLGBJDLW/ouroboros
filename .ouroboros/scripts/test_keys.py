#!/usr/bin/env python3
"""Test what key codes we receive for various Ctrl combinations."""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from ouroboros_keybuffer import KeyBuffer, Keys

print("=" * 60)
print("Key Code Test")
print("=" * 60)
print()
print("Press various keys to see what codes we receive.")
print("Try: Ctrl+D, Ctrl+V, Ctrl+Shift+V, Ctrl+U, etc.")
print("Press ESC to exit.")
print()
print("=" * 60)

with KeyBuffer() as kb:
    while True:
        key = kb.getch(timeout=0.5)
        if not key:
            continue
        
        # Show what we received
        if key == Keys.ESCAPE:
            print("\nESC pressed - exiting...")
            break
        
        # Display key info
        if len(key) == 1:
            code = ord(key)
            print(f"Key: {repr(key):12} | Code: 0x{code:02x} ({code:3d}) | ", end="")
            
            # Identify known keys
            for name in dir(Keys):
                if not name.startswith('_'):
                    val = getattr(Keys, name)
                    if val == key:
                        print(f"Matched: Keys.{name}")
                        break
            else:
                if code < 32:
                    print(f"Ctrl+{chr(code + 64)}")
                elif key.isprintable():
                    print(f"Printable: '{key}'")
                else:
                    print("Unknown")
        else:
            print(f"Key: {repr(key):12} | Multi-byte sequence | ", end="")
            # Check for known sequences
            for name in dir(Keys):
                if not name.startswith('_'):
                    val = getattr(Keys, name)
                    if val == key:
                        print(f"Matched: Keys.{name}")
                        break
            else:
                print("Unknown sequence")
                
print("\nTest complete.")
