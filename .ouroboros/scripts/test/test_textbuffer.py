#!/usr/bin/env python3
"""
Test suite for TextBuffer class in ouroboros_input.py.

Run: python test_textbuffer.py
"""
import sys
import os

# Add parent directory (scripts) to path for imports
SCRIPT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, SCRIPT_DIR)

from ouroboros_input import TextBuffer

# =============================================================================
# TEST CASES
# =============================================================================

def test_basic_operations():
    """Test basic TextBuffer operations."""
    print("=" * 70)
    print("Testing TextBuffer basic operations")
    print("=" * 70)
    
    passed = 0
    failed = 0
    
    # Test 1: Initial state
    buf = TextBuffer()
    if buf.text == '' and buf.line_count == 1 and buf.cursor_row == 0 and buf.cursor_col == 0:
        print("PASS: Initial state is empty")
        passed += 1
    else:
        print("FAIL: Initial state incorrect")
        failed += 1
    
    # Test 2: Insert characters
    buf.insert_char('H')
    buf.insert_char('i')
    if buf.text == 'Hi' and buf.cursor_col == 2:
        print("PASS: Insert characters")
        passed += 1
    else:
        print(f"FAIL: Insert characters - got [data]")
        failed += 1
    
    # Test 3: Newline
    buf.newline()
    buf.insert_char('!')
    if buf.text == 'Hi\n!' and buf.line_count == 2 and buf.cursor_row == 1:
        print("PASS: Newline creates new line")
        passed += 1
    else:
        print(f"FAIL: Newline - got [data], lines={buf.line_count}")
        failed += 1
    
    # Test 4: Backspace
    buf.backspace()
    if buf.text == 'Hi\n' and buf.cursor_col == 0:
        print("PASS: Backspace deletes character")
        passed += 1
    else:
        print(f"FAIL: Backspace - got [data]")
        failed += 1
    
    # Test 5: Backspace at line start (merge lines)
    buf.backspace()
    if buf.text == 'Hi' and buf.line_count == 1 and buf.cursor_col == 2:
        print("PASS: Backspace merges lines")
        passed += 1
    else:
        print(f"FAIL: Backspace merge - got [data], lines={buf.line_count}")
        failed += 1
    
    # Test 6: Clear
    buf.clear()
    if buf.text == '' and buf.line_count == 1:
        print("PASS: Clear resets buffer")
        passed += 1
    else:
        print("FAIL: Clear")
        failed += 1
    
    print(f"\nResults: {passed} passed, {failed} failed")
    return failed == 0


def test_cursor_movement():
    """Test cursor movement operations."""
    print("\n" + "=" * 70)
    print("Testing TextBuffer cursor movement")
    print("=" * 70)
    
    passed = 0
    failed = 0
    
    buf = TextBuffer()
    buf.insert_text("Hello\nWorld")
    
    # Test move_left
    buf.cursor_row = 1
    buf.cursor_col = 3  # At 'l' in World
    buf.move_left()
    if buf.cursor_col == 2:
        print("PASS: move_left decrements column")
        passed += 1
    else:
        print(f"FAIL: move_left - col={buf.cursor_col}")
        failed += 1
    
    # Test move_left at line start (wrap to previous line)
    buf.cursor_col = 0
    buf.move_left()
    if buf.cursor_row == 0 and buf.cursor_col == 5:  # End of "Hello"
        print("PASS: move_left wraps to previous line")
        passed += 1
    else:
        print(f"FAIL: move_left wrap - row={buf.cursor_row}, col={buf.cursor_col}")
        failed += 1
    
    # Test move_right
    buf.move_right()
    if buf.cursor_row == 1 and buf.cursor_col == 0:  # Start of "World"
        print("PASS: move_right wraps to next line")
        passed += 1
    else:
        print(f"FAIL: move_right wrap - row={buf.cursor_row}, col={buf.cursor_col}")
        failed += 1
    
    # Test move_up
    buf.cursor_row = 1
    buf.cursor_col = 2
    buf.move_up()
    if buf.cursor_row == 0 and buf.cursor_col == 2:
        print("PASS: move_up")
        passed += 1
    else:
        print(f"FAIL: move_up - row={buf.cursor_row}")
        failed += 1
    
    # Test move_down
    buf.move_down()
    if buf.cursor_row == 1:
        print("PASS: move_down")
        passed += 1
    else:
        print(f"FAIL: move_down - row={buf.cursor_row}")
        failed += 1
    
    # Test home
    buf.cursor_col = 3
    buf.home()
    if buf.cursor_col == 0:
        print("PASS: home")
        passed += 1
    else:
        print(f"FAIL: home - col={buf.cursor_col}")
        failed += 1
    
    # Test end
    buf.end()
    if buf.cursor_col == 5:  # "World" has 5 chars
        print("PASS: end")
        passed += 1
    else:
        print(f"FAIL: end - col={buf.cursor_col}")
        failed += 1
    
    print(f"\nResults: {passed} passed, {failed} failed")
    return failed == 0


def test_insert_text():
    """Test multi-character text insertion."""
    print("\n" + "=" * 70)
    print("Testing TextBuffer insert_text")
    print("=" * 70)
    
    passed = 0
    failed = 0
    
    # Test single line insert
    buf = TextBuffer()
    buf.insert_text("Hello World")
    if buf.text == "Hello World" and buf.line_count == 1:
        print("PASS: Single line insert")
        passed += 1
    else:
        print(f"FAIL: Single line - got [data]")
        failed += 1
    
    # Test multi-line insert
    buf.clear()
    buf.insert_text("Line1\nLine2\nLine3")
    if buf.text == "Line1\nLine2\nLine3" and buf.line_count == 3:
        print("PASS: Multi-line insert")
        passed += 1
    else:
        print(f"FAIL: Multi-line - got [data], lines={buf.line_count}")
        failed += 1
    
    # Test Chinese text
    buf.clear()
    buf.insert_text("你好世界")
    if buf.text == "你好世界":
        print("PASS: Chinese text insert")
        passed += 1
    else:
        print(f"FAIL: Chinese - got [data]")
        failed += 1
    
    # Test mixed content
    buf.clear()
    buf.insert_text("Hello 你好 🔧")
    if buf.text == "Hello 你好 🔧":
        print("PASS: Mixed content insert")
        passed += 1
    else:
        print(f"FAIL: Mixed - got [data]")
        failed += 1
    
    print(f"\nResults: {passed} passed, {failed} failed")
    return failed == 0


def test_delete_operation():
    """Test delete key operation."""
    print("\n" + "=" * 70)
    print("Testing TextBuffer delete")
    print("=" * 70)
    
    passed = 0
    failed = 0
    
    buf = TextBuffer()
    buf.insert_text("Hello")
    buf.cursor_col = 2  # After "He"
    
    # Delete at cursor
    buf.delete()
    if buf.text == "Helo":
        print("PASS: Delete at cursor")
        passed += 1
    else:
        print(f"FAIL: Delete - got [data]")
        failed += 1
    
    # Delete at end of line (merge with next)
    buf.clear()
    buf.insert_text("Hi\nWorld")
    buf.cursor_row = 0
    buf.cursor_col = 2  # End of "Hi"
    buf.delete()
    if buf.text == "HiWorld" and buf.line_count == 1:
        print("PASS: Delete merges lines")
        passed += 1
    else:
        print(f"FAIL: Delete merge - got [data], lines={buf.line_count}")
        failed += 1
    
    print(f"\nResults: {passed} passed, {failed} failed")
    return failed == 0


def test_viewport_scrolling():
    """Test viewport scrolling for large content."""
    print("\n" + "=" * 70)
    print("Testing TextBuffer viewport scrolling")
    print("=" * 70)
    
    passed = 0
    failed = 0
    
    buf = TextBuffer()
    # Create 20 lines
    for i in range(20):
        buf.insert_text(f"Line {i}")
        if i < 19:
            buf.newline()
    
    # Test get_visible_lines with viewport of 5
    buf.cursor_row = 0
    buf.scroll_offset = 0
    visible = buf.get_visible_lines(5)
    if len(visible) == 5 and visible[0] == "Line 0":
        print("PASS: get_visible_lines returns correct count")
        passed += 1
    else:
        print(f"FAIL: get_visible_lines - got {len(visible)} lines")
        failed += 1
    
    # Test scroll adjustment when cursor moves down
    buf.cursor_row = 10
    visible = buf.get_visible_lines(5)
    if buf.scroll_offset > 0:
        print("PASS: Scroll offset adjusts for cursor")
        passed += 1
    else:
        print(f"FAIL: Scroll offset - got {buf.scroll_offset}")
        failed += 1
    
    # Test visible cursor row
    visible_row = buf.get_visible_cursor_row()
    if 0 <= visible_row < 5:
        print("PASS: Visible cursor row within viewport")
        passed += 1
    else:
        print(f"FAIL: Visible cursor row - got {visible_row}")
        failed += 1
    
    print(f"\nResults: {passed} passed, {failed} failed")
    return failed == 0


# =============================================================================
# MAIN
# =============================================================================

if __name__ == '__main__':
    print("\n Ouroboros TextBuffer Test Suite\n")
    
    all_passed = True
    
    all_passed &= test_basic_operations()
    all_passed &= test_cursor_movement()
    all_passed &= test_insert_text()
    all_passed &= test_delete_operation()
    all_passed &= test_viewport_scrolling()
    
    print("\n" + "=" * 70)
    if all_passed:
        print(" ALL TESTS PASSED!")
    else:
        print("X SOME TESTS FAILED!")
        sys.exit(1)
    print("=" * 70)


