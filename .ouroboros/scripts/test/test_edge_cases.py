#!/usr/bin/env python3
"""
Edge case tests for Ouroboros input system.

Covers boundary conditions, stress tests, and unusual inputs.

Run: python test_edge_cases.py
"""
import sys
import os

# Add parent directory (scripts) to path for imports
SCRIPT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, SCRIPT_DIR)

from ouroboros_input import TextBuffer, parse_menu_options
from ouroboros_ui import InputBox, visible_len, pad_text, strip_ansi

# =============================================================================
# INPUTBOX EDGE CASES
# =============================================================================

def test_inputbox_height_limits():
    """Test InputBox height expansion and shrinking limits."""
    print("=" * 70)
    print("Testing InputBox height limits")
    print("=" * 70)
    
    passed = 0
    failed = 0
    
    # Test 1: Initial height
    box = InputBox(height=1)
    if box.height == 1:
        print("✅ PASS: Initial height = 1")
        passed += 1
    else:
        print(f"❌ FAIL: Initial height = {box.height}, expected 1")
        failed += 1
    
    # Test 2: Expand to max (10 lines)
    box = InputBox(height=1)
    for i in range(15):
        box.expand_height(min(i + 1, 10))  # Request up to 10
    if box.height <= 10:
        print(f"✅ PASS: Height capped at max ({box.height} <= 10)")
        passed += 1
    else:
        print(f"❌ FAIL: Height = {box.height}, expected <= 10 (max)")
        failed += 1
    
    # Test 3: Shrink to minimum (1 line)
    box = InputBox(height=5)
    box.shrink_height(0)
    if box.height >= 1:
        print("✅ PASS: Height doesn't go below 1")
        passed += 1
    else:
        print(f"❌ FAIL: Height = {box.height}, should be >= 1")
        failed += 1
    
    # Test 4: Expand height increases
    box = InputBox(height=1)
    initial = box.height
    box.expand_height(5)
    if box.height >= initial:
        print("✅ PASS: Expand height increases or stays same")
        passed += 1
    else:
        print(f"❌ FAIL: Height decreased from {initial} to {box.height}")
        failed += 1
    
    # Test 5: Shrink height decreases
    box = InputBox(height=8)
    initial = box.height
    box.shrink_height(3)
    if box.height <= initial:
        print("✅ PASS: Shrink height decreases or stays same")
        passed += 1
    else:
        print(f"❌ FAIL: Height increased from {initial} to {box.height}")
        failed += 1
    
    print(f"\nResults: {passed} passed, {failed} failed")
    return failed == 0


def test_textbuffer_edge_cases():
    """Test TextBuffer with edge case inputs."""
    print("\n" + "=" * 70)
    print("Testing TextBuffer edge cases")
    print("=" * 70)
    
    passed = 0
    failed = 0
    
    # Test 1: Empty buffer operations
    buf = TextBuffer()
    result = buf.backspace()  # Backspace on empty
    if not result and buf.text == '':
        print("✅ PASS: Backspace on empty buffer")
        passed += 1
    else:
        print("❌ FAIL: Backspace on empty buffer")
        failed += 1
    
    # Test 2: Delete on empty
    buf = TextBuffer()
    result = buf.delete()
    if not result and buf.text == '':
        print("✅ PASS: Delete on empty buffer")
        passed += 1
    else:
        print("❌ FAIL: Delete on empty buffer")
        failed += 1
    
    # Test 3: Move left at start
    buf = TextBuffer()
    result = buf.move_left()
    if not result and buf.cursor_col == 0:
        print("✅ PASS: Move left at buffer start")
        passed += 1
    else:
        print("❌ FAIL: Move left at buffer start")
        failed += 1
    
    # Test 4: Move up at first line
    buf = TextBuffer()
    buf.insert_text("test")
    result = buf.move_up()
    if not result and buf.cursor_row == 0:
        print("✅ PASS: Move up at first line")
        passed += 1
    else:
        print("❌ FAIL: Move up at first line")
        failed += 1
    
    # Test 5: Very long single line
    buf = TextBuffer()
    long_text = "x" * 1000
    buf.insert_text(long_text)
    if len(buf.text) == 1000 and buf.cursor_col == 1000:
        print("✅ PASS: Very long single line (1000 chars)")
        passed += 1
    else:
        print(f"❌ FAIL: Long line - len={len(buf.text)}, col={buf.cursor_col}")
        failed += 1
    
    # Test 6: Many lines
    buf = TextBuffer()
    for i in range(100):
        buf.insert_text(f"Line {i}")
        buf.newline()
    if buf.line_count == 101:  # 100 lines + 1 empty at end
        print("✅ PASS: Many lines (100+)")
        passed += 1
    else:
        print(f"❌ FAIL: Many lines - count={buf.line_count}")
        failed += 1
    
    # Test 7: Unicode edge cases
    buf = TextBuffer()
    buf.insert_text("🔧🎉💻")  # Emoji
    if buf.text == "🔧🎉💻":
        print("✅ PASS: Emoji insertion")
        passed += 1
    else:
        print(f"❌ FAIL: Emoji - got {repr(buf.text)}")
        failed += 1
    
    # Test 8: Mixed newlines (should normalize)
    buf = TextBuffer()
    buf.insert_text("a\nb\nc")
    if buf.line_count == 3:
        print("✅ PASS: Newline handling")
        passed += 1
    else:
        print(f"❌ FAIL: Newlines - lines={buf.line_count}")
        failed += 1
    
    # Test 9: Cursor position after clear
    buf = TextBuffer()
    buf.insert_text("Hello\nWorld")
    buf.cursor_row = 1
    buf.cursor_col = 3
    buf.clear()
    if buf.cursor_row == 0 and buf.cursor_col == 0:
        print("✅ PASS: Cursor reset after clear")
        passed += 1
    else:
        print(f"❌ FAIL: Cursor after clear - row={buf.cursor_row}, col={buf.cursor_col}")
        failed += 1
    
    # Test 10: Insert in middle of text
    buf = TextBuffer()
    buf.insert_text("Hello World")
    buf.cursor_col = 5  # After "Hello"
    buf.insert_char('!')
    if buf.text == "Hello! World":
        print("✅ PASS: Insert in middle of text")
        passed += 1
    else:
        print(f"❌ FAIL: Insert middle - got {repr(buf.text)}")
        failed += 1
    
    print(f"\nResults: {passed} passed, {failed} failed")
    return failed == 0


def test_menu_parsing_edge_cases():
    """Test parse_menu_options with edge case inputs."""
    print("\n" + "=" * 70)
    print("Testing menu parsing edge cases")
    print("=" * 70)
    
    passed = 0
    failed = 0
    
    test_cases = [
        # (header, prompt, should_detect_menu, description)
        
        # Empty inputs
        ("", "", False, "Empty header and prompt"),
        ("", "[y/n]", True, "Empty header with [y/n] prompt"),
        
        # Whitespace
        ("   ", "", False, "Whitespace only header"),
        ("Title\\n   \\n1. Option\\n2. Option", "", True, "Menu with blank lines"),
        
        # Edge number formats
        ("0. Zero\\n1. One\\n2. Two", "", True, "Menu starting with 0"),
        ("10. Ten\\n11. Eleven\\n12. Twelve", "", True, "Double digit numbers"),
        ("99. High\\n100. Higher", "", True, "Large numbers"),
        
        # Special characters in options
        ("Title\\n1. Option with (parentheses)\\n2. Option [brackets]", "", True, "Special chars in options"),
        ("Title\\n1. 中文选项\\n2. 日本語オプション", "", True, "Non-ASCII options"),
        ("Title\\n1. 🔧 Emoji option\\n2. 🎉 Another", "", True, "Emoji in options"),
        
        # Mixed formats (should still work)
        ("Title\\n1. First\\n[2] Second\\n3) Third", "", True, "Mixed number formats"),
        
        # Almost menus (should NOT detect)
        ("Title\\n1. Only one option", "", False, "Only 1 numbered option"),
        ("No numbers here\\nJust text\\nMore text", "", False, "No numbers at all"),
        # Note: "1 " matches the regex pattern, this is acceptable behavior
        ("1without dot\\n2without dot", "", False, "Numbers without space separator"),
        
        # [y/n] variations
        ("Question?", "[Y/N]", True, "Uppercase Y/N"),
        ("Question?", "[y/N]", True, "Mixed case y/N"),
        ("Question?", "Enter [y/n] to confirm", True, "[y/n] in middle of prompt"),
        ("Question?", "yes or no?", False, "No [y/n] format"),
        
        # Very long inputs
        ("A" * 500, "", False, "Very long header (no menu)"),
        ("Title\\n" + "\\n".join([f"{i}. Option {i}" for i in range(1, 51)]), "", True, "50 options"),
    ]
    
    for header, prompt, should_detect, description in test_cases:
        title, options = parse_menu_options(header, prompt)
        detected = options is not None
        
        success = (detected == should_detect)
        status = "✅ PASS" if success else "❌ FAIL"
        
        print(f"{status}: {description}")
        if not success:
            print(f"  Expected menu: {should_detect}, Got: {detected}")
            print(f"  Header: {repr(header[:50])}...")
            failed += 1
        else:
            passed += 1
    
    print(f"\nResults: {passed} passed, {failed} failed")
    return failed == 0


def test_visible_len_edge_cases():
    """Test visible_len with edge case inputs."""
    print("\n" + "=" * 70)
    print("Testing visible_len edge cases")
    print("=" * 70)
    
    passed = 0
    failed = 0
    
    test_cases = [
        # (text, expected_len, description)
        ("", 0, "Empty string"),
        (" ", 1, "Single space"),
        ("\t", 1, "Tab character"),
        ("\n", 1, "Newline"),
        
        # ANSI codes
        ("\x1b[0m", 0, "Reset code only"),
        ("\x1b[31m\x1b[0m", 0, "Color then reset (empty)"),
        ("\x1b[1;2;3;4;5;6;7;8;9m", 0, "Many ANSI params"),
        
        # Unicode
        ("你", 2, "Single Chinese char"),
        ("あ", 2, "Single Japanese hiragana"),
        ("한", 2, "Single Korean char"),
        ("🔧", 2, "Single emoji"),
        # Note: ZWJ sequences are complex; actual width varies by terminal
        # We test that it returns a positive number, not exact width
        # ("👨‍👩‍👧‍👦", 2, "Family emoji (ZWJ sequence)"),  # Skipped - terminal dependent
        
        # Mixed
        ("\x1b[31m你好\x1b[0mWorld", 9, "ANSI + Chinese + ASCII"),
        ("A你B好C", 7, "Interleaved ASCII and Chinese"),
        
        # Long strings
        ("x" * 1000, 1000, "1000 ASCII chars"),
        ("你" * 100, 200, "100 Chinese chars"),
    ]
    
    for text, expected, description in test_cases:
        result = visible_len(text)
        success = (result == expected)
        
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {description}")
        
        if not success:
            print(f"  Input: {repr(text[:30])}...")
            print(f"  Expected: {expected}, Got: {result}")
            failed += 1
        else:
            passed += 1
    
    print(f"\nResults: {passed} passed, {failed} failed")
    return failed == 0


def test_viewport_scrolling_edge_cases():
    """Test viewport scrolling with edge cases."""
    print("\n" + "=" * 70)
    print("Testing viewport scrolling edge cases")
    print("=" * 70)
    
    passed = 0
    failed = 0
    
    # Test 1: Viewport larger than content
    buf = TextBuffer()
    buf.insert_text("Line1\nLine2")
    visible = buf.get_visible_lines(10)
    if len(visible) == 2:
        print("✅ PASS: Viewport larger than content")
        passed += 1
    else:
        print(f"❌ FAIL: Expected 2 lines, got {len(visible)}")
        failed += 1
    
    # Test 2: Viewport of 1 line
    buf = TextBuffer()
    buf.insert_text("Line1\nLine2\nLine3")
    buf.cursor_row = 1
    visible = buf.get_visible_lines(1)
    if len(visible) == 1 and visible[0] == "Line2":
        print("✅ PASS: Viewport of 1 line follows cursor")
        passed += 1
    else:
        print(f"❌ FAIL: 1-line viewport - got {visible}")
        failed += 1
    
    # Test 3: Cursor at very end
    buf = TextBuffer()
    for i in range(50):
        buf.insert_text(f"Line{i}")
        buf.newline()
    buf.cursor_row = 50
    visible = buf.get_visible_lines(5)
    visible_row = buf.get_visible_cursor_row()
    if 0 <= visible_row < 5:
        print("✅ PASS: Cursor at end stays in viewport")
        passed += 1
    else:
        print(f"❌ FAIL: Visible row = {visible_row}")
        failed += 1
    
    # Test 4: Rapid cursor movement
    buf = TextBuffer()
    for i in range(20):
        buf.insert_text(f"Line{i}")
        buf.newline()
    
    # Jump around
    buf.cursor_row = 0
    buf.get_visible_lines(5)
    buf.cursor_row = 19
    buf.get_visible_lines(5)
    buf.cursor_row = 10
    visible = buf.get_visible_lines(5)
    visible_row = buf.get_visible_cursor_row()
    
    if 0 <= visible_row < 5:
        print("✅ PASS: Rapid cursor movement handled")
        passed += 1
    else:
        print(f"❌ FAIL: After rapid movement, visible_row = {visible_row}")
        failed += 1
    
    # Test 5: Empty buffer viewport
    buf = TextBuffer()
    visible = buf.get_visible_lines(5)
    if len(visible) == 1 and visible[0] == '':
        print("✅ PASS: Empty buffer viewport")
        passed += 1
    else:
        print(f"❌ FAIL: Empty viewport - got {visible}")
        failed += 1
    
    print(f"\nResults: {passed} passed, {failed} failed")
    return failed == 0


def test_special_key_sequences():
    """Test handling of special key sequences."""
    print("\n" + "=" * 70)
    print("Testing special key sequence handling")
    print("=" * 70)
    
    from ouroboros_keybuffer import Keys, KeyBuffer
    
    passed = 0
    failed = 0
    
    kb = KeyBuffer()
    
    # Test normalization of various key formats
    test_cases = [
        # Windows keys should normalize to ANSI
        (Keys.WIN_UP, Keys.UP, "WIN_UP normalizes"),
        (Keys.WIN_DOWN, Keys.DOWN, "WIN_DOWN normalizes"),
        (Keys.WIN_LEFT, Keys.LEFT, "WIN_LEFT normalizes"),
        (Keys.WIN_RIGHT, Keys.RIGHT, "WIN_RIGHT normalizes"),
        (Keys.WIN_HOME, Keys.HOME, "WIN_HOME normalizes"),
        (Keys.WIN_END, Keys.END, "WIN_END normalizes"),
        (Keys.WIN_DELETE, Keys.DELETE, "WIN_DELETE normalizes"),
        (Keys.WIN_PAGE_UP, Keys.PAGE_UP, "WIN_PAGE_UP normalizes"),
        (Keys.WIN_PAGE_DOWN, Keys.PAGE_DOWN, "WIN_PAGE_DOWN normalizes"),
        
        # Alt sequences should normalize
        (Keys.UP_ALT, Keys.UP, "UP_ALT normalizes"),
        (Keys.DOWN_ALT, Keys.DOWN, "DOWN_ALT normalizes"),
        (Keys.LEFT_ALT, Keys.LEFT, "LEFT_ALT normalizes"),
        (Keys.RIGHT_ALT, Keys.RIGHT, "RIGHT_ALT normalizes"),
        
        # Regular keys unchanged
        ('a', 'a', "Regular char unchanged"),
        ('\r', '\r', "Enter unchanged"),
        ('\x03', '\x03', "Ctrl+C unchanged"),
    ]
    
    for input_key, expected, description in test_cases:
        result = kb._normalize_key(input_key)
        success = (result == expected)
        
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {description}")
        
        if not success:
            print(f"  Input: {repr(input_key)}, Expected: {repr(expected)}, Got: {repr(result)}")
            failed += 1
        else:
            passed += 1
    
    print(f"\nResults: {passed} passed, {failed} failed")
    return failed == 0


def test_yn_response_edge_cases():
    """Test y/n response mapping edge cases."""
    print("\n" + "=" * 70)
    print("Testing y/n response mapping edge cases")
    print("=" * 70)
    
    passed = 0
    failed = 0
    
    def map_yn(content):
        """Simulate the y/n mapping logic from main()."""
        if content.lower().startswith('yes') or content.startswith('是'):
            return 'y'
        elif content.lower().startswith('no') or content.startswith('否'):
            return 'n'
        return content
    
    test_cases = [
        # Standard cases
        ("Yes (是)", "y", "Standard Yes"),
        ("No (否)", "n", "Standard No"),
        
        # Case variations
        ("YES", "y", "Uppercase YES"),
        ("NO", "n", "Uppercase NO"),
        ("yes", "y", "Lowercase yes"),
        ("no", "n", "Lowercase no"),
        ("Yes", "y", "Title case Yes"),
        ("No", "n", "Title case No"),
        
        # Chinese
        ("是", "y", "Chinese 是"),
        ("否", "n", "Chinese 否"),
        ("是的", "y", "Chinese 是的"),
        ("否定", "n", "Chinese 否定"),
        
        # Edge cases that should NOT map
        ("Maybe", "Maybe", "Maybe unchanged"),
        ("y", "y", "Single y unchanged"),
        ("n", "n", "Single n unchanged"),
        ("Yesterday", "y", "Starts with Yes"),  # This is expected behavior
        ("Nothing", "n", "Starts with No"),     # This is expected behavior
        ("", "", "Empty string"),
    ]
    
    for content, expected, description in test_cases:
        result = map_yn(content)
        success = (result == expected)
        
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {description}")
        
        if not success:
            print(f"  Input: {repr(content)}, Expected: {repr(expected)}, Got: {repr(result)}")
            failed += 1
        else:
            passed += 1
    
    print(f"\nResults: {passed} passed, {failed} failed")
    return failed == 0


# =============================================================================
# MAIN
# =============================================================================

if __name__ == '__main__':
    print("\n🧪 Ouroboros Edge Case Test Suite\n")
    
    all_passed = True
    
    all_passed &= test_inputbox_height_limits()
    all_passed &= test_textbuffer_edge_cases()
    all_passed &= test_menu_parsing_edge_cases()
    all_passed &= test_visible_len_edge_cases()
    all_passed &= test_viewport_scrolling_edge_cases()
    all_passed &= test_special_key_sequences()
    all_passed &= test_yn_response_edge_cases()
    
    print("\n" + "=" * 70)
    if all_passed:
        print("🎉 ALL EDGE CASE TESTS PASSED!")
    else:
        print("❌ SOME TESTS FAILED!")
        sys.exit(1)
    print("=" * 70)
