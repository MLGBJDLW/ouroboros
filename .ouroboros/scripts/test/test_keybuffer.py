#!/usr/bin/env python3
"""
Test suite for ouroboros_keybuffer.py - Keyboard input handling.

Run: python test_keybuffer.py
"""
import sys
import os

# Add parent directory (scripts) to path for imports
SCRIPT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, SCRIPT_DIR)

from ouroboros_keybuffer import Keys, is_pipe_input, is_printable, KeyBuffer

# =============================================================================
# TEST CASES
# =============================================================================

def test_keys_constants():
    """Test Keys class has all required constants."""
    print("=" * 70)
    print("Testing Keys constants")
    print("=" * 70)
    
    required_keys = [
        # Basic keys
        ('ENTER', '\r'),
        ('TAB', '\t'),
        ('ESCAPE', '\x1b'),
        ('BACKSPACE', '\x7f'),
        
        # Ctrl combinations
        ('CTRL_C', '\x03'),
        ('CTRL_D', '\x04'),
        ('CTRL_U', '\x15'),
        
        # Arrow keys (ANSI)
        ('UP', '\x1b[A'),
        ('DOWN', '\x1b[B'),
        ('LEFT', '\x1b[D'),
        ('RIGHT', '\x1b[C'),
        
        # Arrow keys (Windows)
        ('WIN_UP', '\xe0H'),
        ('WIN_DOWN', '\xe0P'),
        ('WIN_LEFT', '\xe0K'),
        ('WIN_RIGHT', '\xe0M'),
        
        # Navigation
        ('HOME', '\x1b[H'),
        ('END', '\x1b[F'),
        ('DELETE', '\x1b[3~'),
    ]
    
    passed = 0
    failed = 0
    
    for name, expected in required_keys:
        actual = getattr(Keys, name, None)
        success = (actual == expected)
        
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: Keys.{name} = {repr(actual)}")
        
        if not success:
            print(f"  Expected: {repr(expected)}")
            failed += 1
        else:
            passed += 1
    
    print(f"\nResults: {passed} passed, {failed} failed")
    return failed == 0


def test_is_printable():
    """Test is_printable function."""
    print("\n" + "=" * 70)
    print("Testing is_printable()")
    print("=" * 70)
    
    test_cases = [
        # (char, expected, description)
        ('a', True, "ASCII letter"),
        ('Z', True, "ASCII uppercase"),
        ('5', True, "ASCII digit"),
        (' ', True, "Space"),
        ('你', True, "Chinese character"),
        ('🔧', True, "Emoji"),
        ('\x00', False, "Null character"),
        ('\x1b', False, "Escape"),
        ('\n', False, "Newline"),
        ('\r', False, "Carriage return"),
        ('\t', False, "Tab"),
        ('', False, "Empty string"),
        ('ab', False, "Multi-char string"),
    ]
    
    passed = 0
    failed = 0
    
    for char, expected, description in test_cases:
        result = is_printable(char)
        success = (result == expected)
        
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {description}")
        print(f"  is_printable({repr(char)}) = {result}")
        
        if not success:
            print(f"  Expected: {expected}")
            failed += 1
        else:
            passed += 1
    
    print(f"\nResults: {passed} passed, {failed} failed")
    return failed == 0


def test_keybuffer_methods():
    """Test KeyBuffer helper methods."""
    print("\n" + "=" * 70)
    print("Testing KeyBuffer methods")
    print("=" * 70)
    
    kb = KeyBuffer()
    
    tests = [
        # (method, args, expected, description)
        ('is_enter', ('\r',), True, "is_enter('\\r')"),
        ('is_enter', ('\n',), True, "is_enter('\\n')"),
        ('is_enter', ('a',), False, "is_enter('a')"),
        ('is_backspace', ('\x7f',), True, "is_backspace('\\x7f')"),
        ('is_backspace', ('\x08',), True, "is_backspace('\\x08')"),
        ('is_arrow', (Keys.UP,), True, "is_arrow(Keys.UP)"),
        ('is_arrow', (Keys.DOWN,), True, "is_arrow(Keys.DOWN)"),
        ('is_arrow', ('a',), False, "is_arrow('a')"),
        ('is_printable', ('a',), True, "is_printable('a')"),
        ('is_printable', ('\x1b',), False, "is_printable('\\x1b')"),
    ]
    
    passed = 0
    failed = 0
    
    for method, args, expected, description in tests:
        func = getattr(kb, method)
        result = func(*args)
        success = (result == expected)
        
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {description} = {result}")
        
        if not success:
            print(f"  Expected: {expected}")
            failed += 1
        else:
            passed += 1
    
    print(f"\nResults: {passed} passed, {failed} failed")
    return failed == 0


def test_key_normalization():
    """Test that Windows keys are normalized to ANSI format."""
    print("\n" + "=" * 70)
    print("Testing key normalization")
    print("=" * 70)
    
    kb = KeyBuffer()
    
    # Test the _normalize_key method directly
    test_cases = [
        (Keys.WIN_UP, Keys.UP, "WIN_UP -> UP"),
        (Keys.WIN_DOWN, Keys.DOWN, "WIN_DOWN -> DOWN"),
        (Keys.WIN_LEFT, Keys.LEFT, "WIN_LEFT -> LEFT"),
        (Keys.WIN_RIGHT, Keys.RIGHT, "WIN_RIGHT -> RIGHT"),
        (Keys.WIN_HOME, Keys.HOME, "WIN_HOME -> HOME"),
        (Keys.WIN_END, Keys.END, "WIN_END -> END"),
        (Keys.UP_ALT, Keys.UP, "UP_ALT -> UP"),
        (Keys.DOWN_ALT, Keys.DOWN, "DOWN_ALT -> DOWN"),
        ('a', 'a', "Regular char unchanged"),
        (Keys.UP, Keys.UP, "ANSI UP unchanged"),
    ]
    
    passed = 0
    failed = 0
    
    for input_key, expected, description in test_cases:
        result = kb._normalize_key(input_key)
        success = (result == expected)
        
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {description}")
        print(f"  {repr(input_key)} -> {repr(result)}")
        
        if not success:
            print(f"  Expected: {repr(expected)}")
            failed += 1
        else:
            passed += 1
    
    print(f"\nResults: {passed} passed, {failed} failed")
    return failed == 0


def test_platform_detection():
    """Test platform detection."""
    print("\n" + "=" * 70)
    print("Testing platform detection")
    print("=" * 70)
    
    kb = KeyBuffer()
    impl_name = type(kb._impl).__name__
    
    if sys.platform == 'win32':
        expected = 'WindowsKeyBuffer'
    else:
        expected = 'UnixKeyBuffer'
    
    success = (impl_name == expected)
    status = "✅ PASS" if success else "❌ FAIL"
    
    print(f"{status}: Platform implementation")
    print(f"  Platform: {sys.platform}")
    print(f"  Implementation: {impl_name}")
    
    if not success:
        print(f"  Expected: {expected}")
    
    return success


# =============================================================================
# MAIN
# =============================================================================

if __name__ == '__main__':
    print("\n🧪 Ouroboros KeyBuffer Test Suite\n")
    
    all_passed = True
    
    all_passed &= test_keys_constants()
    all_passed &= test_is_printable()
    all_passed &= test_keybuffer_methods()
    all_passed &= test_key_normalization()
    all_passed &= test_platform_detection()
    
    print("\n" + "=" * 70)
    if all_passed:
        print("🎉 ALL TESTS PASSED!")
    else:
        print("❌ SOME TESTS FAILED!")
        sys.exit(1)
    print("=" * 70)
