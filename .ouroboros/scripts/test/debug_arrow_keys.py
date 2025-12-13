#!/usr/bin/env python3
"""Debug arrow key detection in selection menu."""
import sys
import os

SCRIPT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, SCRIPT_DIR)

from ouroboros_keybuffer import KeyBuffer, Keys

print("=" * 60)
print("Arrow Key Debug Test")
print("=" * 60)
print()
print("Press arrow keys to see what codes are received.")
print("Press Enter to test selection, Ctrl+C to exit.")
print()
print("Key code reference:")
print(f"  Keys.UP      = {repr(Keys.UP)}")
print(f"  Keys.DOWN    = {repr(Keys.DOWN)}")
print(f"  Keys.WIN_UP  = {repr(Keys.WIN_UP)}")
print(f"  Keys.WIN_DOWN= {repr(Keys.WIN_DOWN)}")
print(f"  Keys.UP_ALT  = {repr(Keys.UP_ALT)}")
print(f"  Keys.DOWN_ALT= {repr(Keys.DOWN_ALT)}")
print()

with KeyBuffer() as kb:
    print(f"Implementation: {type(kb._impl).__name__}")
    if hasattr(kb._impl, '_use_readconsole'):
        print(f"ReadConsoleW: {kb._impl._use_readconsole}")
    print()
    print("-" * 60)
    
    while True:
        try:
            # Get raw key from implementation
            raw_key = kb._impl.getch()
            # Get normalized key
            normalized_key = kb._normalize_key(raw_key)
            
            raw_bytes = [hex(ord(c)) for c in raw_key] if raw_key else []
            norm_bytes = [hex(ord(c)) for c in normalized_key] if normalized_key else []
            
            print(f"\nRaw: {repr(raw_key)} {raw_bytes}")
            print(f"Normalized: {repr(normalized_key)} {norm_bytes}")
            
            # Check matches
            if normalized_key == Keys.UP:
                print("  -> Matches Keys.UP OK")
            elif normalized_key == Keys.DOWN:
                print("  -> Matches Keys.DOWN OK")
            elif raw_key == Keys.WIN_UP:
                print("  -> Raw matches Keys.WIN_UP (should normalize!)")
            elif raw_key == Keys.WIN_DOWN:
                print("  -> Raw matches Keys.WIN_DOWN (should normalize!)")
            elif kb.is_enter(normalized_key):
                print("  -> ENTER")
            elif normalized_key == Keys.CTRL_C:
                print("\nExiting...")
                break
                
        except KeyboardInterrupt:
            print("\nInterrupted")
            break


