#!/usr/bin/env python3
"""
Test suite for ouroboros_ui.py - UI components and rendering.

Run: python test_ui.py
"""
import sys
import os

# Add parent directory (scripts) to path for imports
SCRIPT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, SCRIPT_DIR)

from ouroboros_ui import (
    visible_len, pad_text, strip_ansi, get_terminal_size,
    ANSI, THEME, BOX
)

# =============================================================================
# TEST CASES
# =============================================================================

def test_visible_len():
    """Test visible_len correctly calculates display width."""
    print("=" * 70)
    print("Testing visible_len()")
    print("=" * 70)
    
    test_cases = [
        # (text, expected_len, description)
        ("hello", 5, "ASCII text"),
        ("", 0, "Empty string"),
        ("你好", 4, "Chinese characters (2 width each)"),
        ("hello世界", 9, "Mixed ASCII and Chinese"),
        ("\x1b[31mred\x1b[0m", 3, "ANSI colored text"),
        ("\x1b[1;32mbold green\x1b[0m", 10, "Bold colored text"),
        ("🔧", 2, "Emoji (2 width)"),
        ("Tab\there", 8, "Text with tab"),
        ("  spaces  ", 10, "Text with spaces"),
    ]
    
    passed = 0
    failed = 0
    
    for text, expected, description in test_cases:
        result = visible_len(text)
        success = (result == expected)
        
        status = "PASS" if success else "FAIL"
        print(f"{status}: [test case]")
        print(f"  Input: [test data] -> Length: {result}")
        
        if not success:
            print(f"  Expected: {expected}")
            failed += 1
        else:
            passed += 1
    
    print(f"\nResults: {passed} passed, {failed} failed")
    return failed == 0


def test_strip_ansi():
    """Test strip_ansi removes ANSI escape codes."""
    print("\n" + "=" * 70)
    print("Testing strip_ansi()")
    print("=" * 70)
    
    test_cases = [
        ("\x1b[31mred\x1b[0m", "red", "Simple color"),
        ("\x1b[1;32;40mbold\x1b[0m", "bold", "Multiple attributes"),
        ("no ansi", "no ansi", "Plain text"),
        ("\x1b[31m\x1b[32mnested\x1b[0m\x1b[0m", "nested", "Nested codes"),
        ("", "", "Empty string"),
    ]
    
    passed = 0
    failed = 0
    
    for text, expected, description in test_cases:
        result = strip_ansi(text)
        success = (result == expected)
        
        status = "PASS" if success else "FAIL"
        print(f"{status}: [test case]")
        print(f"  Input: [test data] -> Output: {repr(result)}")
        
        if not success:
            print(f"  Expected: {repr(expected)}")
            failed += 1
        else:
            passed += 1
    
    print(f"\nResults: {passed} passed, {failed} failed")
    return failed == 0


def test_pad_text():
    """Test pad_text correctly pads text to width."""
    print("\n" + "=" * 70)
    print("Testing pad_text()")
    print("=" * 70)
    
    test_cases = [
        # (text, width, expected_visible_len, description)
        ("hello", 10, 10, "Pad ASCII to 10"),
        ("你好", 10, 10, "Pad Chinese to 10"),
        ("test", 4, 4, "No padding needed"),
        ("", 5, 5, "Pad empty string"),
    ]
    
    passed = 0
    failed = 0
    
    for text, width, expected_len, description in test_cases:
        result = pad_text(text, width)
        result_len = visible_len(result)
        success = (result_len == expected_len)
        
        status = "PASS" if success else "FAIL"
        print(f"{status}: [test case]")
        print(f"  Input: [test data], width={width}")
        print(f"  Output: [result], visible_len={result_len}")
        
        if not success:
            print(f"  Expected visible_len: {expected_len}")
            failed += 1
        else:
            passed += 1
    
    print(f"\nResults: {passed} passed, {failed} failed")
    return failed == 0


def test_terminal_size():
    """Test get_terminal_size returns valid dimensions."""
    print("\n" + "=" * 70)
    print("Testing get_terminal_size()")
    print("=" * 70)
    
    cols, rows = get_terminal_size()
    
    # Should return reasonable values
    valid_cols = 20 <= cols <= 500
    valid_rows = 5 <= rows <= 200
    
    print(f"Terminal size: {cols} columns x {rows} rows")
    
    if valid_cols and valid_rows:
        print("PASS: Valid terminal dimensions")
        return True
    else:
        print("FAIL: Invalid terminal dimensions")
        return False


def test_theme_colors():
    """Test THEME dictionary has required keys."""
    print("\n" + "=" * 70)
    print("Testing THEME colors")
    print("=" * 70)
    
    required_keys = ['border', 'prompt', 'success', 'warning', 'error', 'info', 'reset']
    
    passed = 0
    failed = 0
    
    for key in required_keys:
        if key in THEME:
            print(f"PASS: THEME['{key}'] exists")
            passed += 1
        else:
            print(f"FAIL: THEME['{key}'] missing")
            failed += 1
    
    print(f"\nResults: {passed} passed, {failed} failed")
    return failed == 0


def test_box_characters():
    """Test BOX dictionary has required characters."""
    print("\n" + "=" * 70)
    print("Testing BOX characters")
    print("=" * 70)
    
    required_keys = ['tl', 'tr', 'bl', 'br', 'h', 'v', 'lj', 'rj']
    
    passed = 0
    failed = 0
    
    for key in required_keys:
        if key in BOX:
            print(f"PASS: BOX['{key}'] = {repr(BOX[key])}")
            passed += 1
        else:
            print(f"FAIL: BOX['{key}'] missing")
            failed += 1
    
    print(f"\nResults: {passed} passed, {failed} failed")
    return failed == 0


# =============================================================================
# MAIN
# =============================================================================

if __name__ == '__main__':
    print("\n Ouroboros UI Test Suite\n")
    
    all_passed = True
    
    all_passed &= test_visible_len()
    all_passed &= test_strip_ansi()
    all_passed &= test_pad_text()
    all_passed &= test_terminal_size()
    all_passed &= test_theme_colors()
    all_passed &= test_box_characters()
    
    print("\n" + "=" * 70)
    if all_passed:
        print(" ALL TESTS PASSED!")
    else:
        print("X SOME TESTS FAILED!")
        sys.exit(1)
    print("=" * 70)


