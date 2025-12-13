#!/usr/bin/env python3
"""Test keyboard input detection - diagnose arrow key issues."""
import sys
import os

# Add parent directory (scripts) to path for imports
SCRIPT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, SCRIPT_DIR)

from ouroboros_keybuffer import KeyBuffer, Keys

print("=" * 70)
print("Keyboard Input Diagnostic Test")
print("=" * 70)
print()
print("This test will help diagnose why arrow keys might not work.")
print("Press arrow keys, Enter to test, Ctrl+C to exit")
print()
print("Expected key values:")
print(f"  Keys.UP    = {repr(Keys.UP)} (bytes: {[hex(ord(c)) for c in Keys.UP]})")
print(f"  Keys.DOWN  = {repr(Keys.DOWN)} (bytes: {[hex(ord(c)) for c in Keys.DOWN]})")
print(f"  Keys.WIN_UP   = {repr(Keys.WIN_UP)} (bytes: {[hex(ord(c)) for c in Keys.WIN_UP]})")
print(f"  Keys.WIN_DOWN = {repr(Keys.WIN_DOWN)} (bytes: {[hex(ord(c)) for c in Keys.WIN_DOWN]})")
print()

with KeyBuffer() as kb:
    # Check which implementation is being used
    impl_name = type(kb._impl).__name__
    print(f"Using implementation: {impl_name}")
    if hasattr(kb._impl, '_use_readconsole'):
        print(f"  ReadConsoleW enabled: {kb._impl._use_readconsole}")
    print()
    print("-" * 70)
    print("Press keys now (Ctrl+C to exit):")
    print("-" * 70)
    
    while True:
        try:
            key = kb.getch()
            
            if key == Keys.CTRL_C:
                print("\nExiting...")
                break
            
            # Show raw key info
            key_bytes = [hex(ord(c)) for c in key] if key else []
            print(f"\nRaw key: {repr(key)}")
            print(f"  Bytes: {key_bytes}")
            print(f"  Length: {len(key)}")
            
            # Check against all known arrow key formats
            if key == Keys.UP:
                print("  ✅ Matches Keys.UP (ANSI)")
            elif key == Keys.WIN_UP:
                print("  ✅ Matches Keys.WIN_UP (Windows)")
            elif key == Keys.UP_ALT:
                print("  ✅ Matches Keys.UP_ALT (Alternate)")
            elif key == Keys.DOWN:
                print("  ✅ Matches Keys.DOWN (ANSI)")
            elif key == Keys.WIN_DOWN:
                print("  ✅ Matches Keys.WIN_DOWN (Windows)")
            elif key == Keys.DOWN_ALT:
                print("  ✅ Matches Keys.DOWN_ALT (Alternate)")
            elif key == Keys.LEFT:
                print("  ✅ Matches Keys.LEFT (ANSI)")
            elif key == Keys.WIN_LEFT:
                print("  ✅ Matches Keys.WIN_LEFT (Windows)")
            elif key == Keys.RIGHT:
                print("  ✅ Matches Keys.RIGHT (ANSI)")
            elif key == Keys.WIN_RIGHT:
                print("  ✅ Matches Keys.WIN_RIGHT (Windows)")
            elif kb.is_enter(key):
                print("  ✅ Detected as ENTER")
            elif kb.is_printable(key):
                print(f"  📝 Printable character: '{key}'")
            else:
                print(f"  ❓ Unknown key")
                
        except KeyboardInterrupt:
            print("\nInterrupted")
            break
