#!/usr/bin/env python3
"""
Tests for paste badge functionality.

Tests the paste detection, marker creation, badge rendering, and content extraction
for the multi-line paste badge feature.

Run: python test_paste_badge.py
"""
import sys
import os
import re

# Add parent directory (scripts) to path for imports
SCRIPT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, SCRIPT_DIR)

from ouroboros_filepath import (
    process_pasted_content, create_paste_marker, parse_paste_marker,
    is_paste_marker, extract_paste_content, extract_all_special_content,
    format_paste_badge
)
from ouroboros_ui import format_display_text


# =============================================================================
# PASTE DETECTION TESTS
# =============================================================================

def test_paste_detection_small():
    """Test that small pastes (below threshold) are not badged."""
    print("=" * 70)
    print("Testing small paste detection (below threshold)")
    print("=" * 70)
    
    passed = 0
    failed = 0
    
    # Test 1: 1 line
    content = "single line of text"
    display, actual, is_special, paste_type = process_pasted_content(content)
    if paste_type == 'text' and not is_special:
        print("PASS: 1 line -> not badged")
        passed += 1
    else:
        print(f"FAIL: 1 line -> paste_type={paste_type}, is_special={is_special}")
        failed += 1
    
    # Test 2: 2 lines
    content = "line1\nline2"
    display, actual, is_special, paste_type = process_pasted_content(content)
    if paste_type == 'text' and not is_special:
        print("PASS: 2 lines -> not badged")
        passed += 1
    else:
        print(f"FAIL: 2 lines -> paste_type={paste_type}")
        failed += 1
    
    # Test 3: 4 lines (just below threshold)
    content = "line1\nline2\nline3\nline4"
    display, actual, is_special, paste_type = process_pasted_content(content)
    if paste_type == 'text' and not is_special:
        print("PASS: 4 lines -> not badged (below threshold)")
        passed += 1
    else:
        print(f"FAIL: 4 lines -> paste_type={paste_type}")
        failed += 1
    
    print(f"\nResults: {passed} passed, {failed} failed")
    return failed == 0


def test_paste_detection_large():
    """Test that large pastes (at or above threshold) are badged."""
    print("\n" + "=" * 70)
    print("Testing large paste detection (at/above threshold)")
    print("=" * 70)
    
    passed = 0
    failed = 0
    
    # Test 1: Exactly 5 lines (threshold)
    content = "line1\nline2\nline3\nline4\nline5"
    display, actual, is_special, paste_type = process_pasted_content(content)
    if paste_type == 'paste' and is_special:
        print("PASS: 5 lines -> badged")
        passed += 1
    else:
        print(f"FAIL: 5 lines -> paste_type={paste_type}, is_special={is_special}")
        failed += 1
    
    # Test 2: 10 lines
    content = '\n'.join([f'line{i}' for i in range(10)])
    display, actual, is_special, paste_type = process_pasted_content(content)
    if paste_type == 'paste' and is_special:
        print("PASS: 10 lines -> badged")
        passed += 1
    else:
        print(f"FAIL: 10 lines -> paste_type={paste_type}")
        failed += 1
    
    # Test 3: 50 lines
    content = '\n'.join([f'line{i}' for i in range(50)])
    display, actual, is_special, paste_type = process_pasted_content(content)
    if paste_type == 'paste' and is_special:
        print("PASS: 50 lines -> badged")
        passed += 1
    else:
        print(f"FAIL: 50 lines -> paste_type={paste_type}")
        failed += 1
    
    # Test 4: Long single line (100+ chars)
    content = "x" * 150
    display, actual, is_special, paste_type = process_pasted_content(content)
    if paste_type == 'paste' and is_special:
        print("PASS: Long single line (150 chars) -> badged")
        passed += 1
    else:
        print(f"FAIL: Long single line -> paste_type={paste_type}")
        failed += 1
    
    print(f"\nResults: {passed} passed, {failed} failed")
    return failed == 0


# =============================================================================
# MARKER TESTS
# =============================================================================

def test_paste_marker_creation():
    """Test paste marker creation and parsing."""
    print("\n" + "=" * 70)
    print("Testing paste marker creation and parsing")
    print("=" * 70)
    
    passed = 0
    failed = 0
    
    # Test 1: Create marker
    content = "line1\nline2\nline3\nline4\nline5"
    marker = create_paste_marker(content)
    if marker.startswith('‹PASTE:5›') and marker.endswith('‹/PASTE›'):
        print("PASS: Marker created with correct format")
        passed += 1
    else:
        print(f"FAIL: Marker format incorrect: {marker[:30]}...")
        failed += 1
    
    # Test 2: Parse marker
    line_count, extracted = parse_paste_marker(marker)
    if line_count == 5 and extracted == content:
        print("PASS: Marker parsed correctly")
        passed += 1
    else:
        print(f"FAIL: Parsed line_count={line_count}, content match={extracted == content}")
        failed += 1
    
    # Test 3: is_paste_marker
    if is_paste_marker(marker):
        print("PASS: is_paste_marker returns True for valid marker")
        passed += 1
    else:
        print("FAIL: is_paste_marker returned False for valid marker")
        failed += 1
    
    # Test 4: is_paste_marker returns False for non-markers
    if not is_paste_marker("regular text"):
        print("PASS: is_paste_marker returns False for regular text")
        passed += 1
    else:
        print("FAIL: is_paste_marker returned True for regular text")
        failed += 1
    
    print(f"\nResults: {passed} passed, {failed} failed")
    return failed == 0


# =============================================================================
# BADGE DISPLAY TESTS
# =============================================================================

def test_badge_rendering():
    """Test badge rendering for display."""
    print("\n" + "=" * 70)
    print("Testing badge rendering")
    print("=" * 70)
    
    passed = 0
    failed = 0
    
    # Test 1: format_paste_badge singular
    badge = format_paste_badge(1)
    if badge == "[ Pasted 1 Line ]":
        print("PASS: Singular badge format")
        passed += 1
    else:
        print(f"FAIL: Singular badge = {badge}")
        failed += 1
    
    # Test 2: format_paste_badge plural
    badge = format_paste_badge(10)
    if badge == "[ Pasted 10 Lines ]":
        print("PASS: Plural badge format")
        passed += 1
    else:
        print(f"FAIL: Plural badge = {badge}")
        failed += 1
    
    # Test 3: format_display_text with paste marker
    content = "line1\nline2\nline3\nline4\nline5"
    marker = create_paste_marker(content)
    display = format_display_text(marker)
    if "Pasted 5 Lines" in display:
        print("PASS: format_display_text converts marker to badge")
        passed += 1
    else:
        print(f"FAIL: format_display_text output = {display}")
        failed += 1
    
    # Test 4: format_display_text with mixed content
    text = f"Hello {marker} World"
    display = format_display_text(text)
    if "Hello" in display and "Pasted 5 Lines" in display and "World" in display:
        print("PASS: Mixed content rendered correctly")
        passed += 1
    else:
        print(f"FAIL: Mixed content = {display}")
        failed += 1
    
    print(f"\nResults: {passed} passed, {failed} failed")
    return failed == 0


# =============================================================================
# CONTENT EXTRACTION TESTS
# =============================================================================

def test_content_extraction():
    """Test content extraction from markers."""
    print("\n" + "=" * 70)
    print("Testing content extraction")
    print("=" * 70)
    
    passed = 0
    failed = 0
    
    # Test 1: Extract paste content
    content = "line1\nline2\nline3\nline4\nline5"
    marker = create_paste_marker(content)
    extracted = extract_paste_content(marker)
    if extracted == content:
        print("PASS: extract_paste_content preserves content")
        passed += 1
    else:
        print("FAIL: Content not preserved")
        failed += 1
    
    # Test 2: Extract all special content (paste)
    extracted = extract_all_special_content(marker)
    if extracted == content:
        print("PASS: extract_all_special_content handles paste markers")
        passed += 1
    else:
        print("FAIL: extract_all_special_content failed")
        failed += 1
    
    # Test 3: Extract file path marker
    file_marker = "«C:\\Users\\test\\file.py»"
    extracted = extract_all_special_content(file_marker)
    if extracted == "C:\\Users\\test\\file.py":
        print("PASS: extract_all_special_content handles file markers")
        passed += 1
    else:
        print(f"FAIL: File marker extraction = {extracted}")
        failed += 1
    
    # Test 4: Mixed content extraction
    paste_content = "def hello():\n    pass\n    return\n    # comment\n    end"
    paste_marker = create_paste_marker(paste_content)
    mixed = f"Check this code: {paste_marker} and this file: «/path/to/file.txt»"
    extracted = extract_all_special_content(mixed)
    expected = f"Check this code: {paste_content} and this file: /path/to/file.txt"
    if extracted == expected:
        print("PASS: Mixed content extraction")
        passed += 1
    else:
        print("FAIL: Mixed content extraction")
        print(f"  Expected: {expected[:50]}...")
        print(f"  Got: {extracted[:50]}...")
        failed += 1
    
    # Test 5: Content with special characters
    special_content = "print('hello')\n\"str\"\n<html>\n{json}\n`code`"
    marker = create_paste_marker(special_content)
    extracted = extract_all_special_content(marker)
    if extracted == special_content:
        print("PASS: Special characters preserved")
        passed += 1
    else:
        print("FAIL: Special characters not preserved")
        failed += 1
    
    # Test 6: Unicode content
    unicode_content = "你好\n世界\nこんにちは\n🔧\n💻"
    marker = create_paste_marker(unicode_content)
    extracted = extract_all_special_content(marker)
    if extracted == unicode_content:
        print("PASS: Unicode content preserved")
        passed += 1
    else:
        print("FAIL: Unicode content not preserved")
        failed += 1
    
    print(f"\nResults: {passed} passed, {failed} failed")
    return failed == 0


# =============================================================================
# INTEGRATION TESTS
# =============================================================================

def test_full_paste_flow():
    """Test the complete paste -> display -> extract flow."""
    print("\n" + "=" * 70)
    print("Testing full paste flow")
    print("=" * 70)
    
    passed = 0
    failed = 0
    
    # Test 1: Full flow for code paste
    code = '''def fibonacci(n):
    if n <= 1:
        return n
    return fibonacci(n-1) + fibonacci(n-2)

print(fibonacci(10))'''
    
    # Step 1: Process paste
    display, actual, is_special, paste_type = process_pasted_content(code)
    if paste_type == 'paste':
        print("PASS: Step 1 - Code detected as paste")
        passed += 1
    else:
        print(f"FAIL: Step 1 - paste_type={paste_type}")
        failed += 1
    
    # Step 2: Display shows badge
    display_text = format_display_text(actual)
    if "Pasted" in display_text and "Lines" in display_text:
        print("PASS: Step 2 - Display shows badge")
        passed += 1
    else:
        print(f"FAIL: Step 2 - display={display_text}")
        failed += 1
    
    # Step 3: Extraction recovers original
    extracted = extract_all_special_content(actual)
    if extracted == code:
        print("PASS: Step 3 - Extraction recovers original code")
        passed += 1
    else:
        print("FAIL: Step 3 - Extraction failed")
        failed += 1
    
    # Test 2: Multiple pastes in same buffer
    code1 = "line1\nline2\nline3\nline4\nline5"
    code2 = "a\nb\nc\nd\ne"
    _, marker1, _, _ = process_pasted_content(code1)
    _, marker2, _, _ = process_pasted_content(code2)
    
    buffer_content = f"First paste: {marker1}\nSecond paste: {marker2}"
    extracted = extract_all_special_content(buffer_content)
    expected = f"First paste: {code1}\nSecond paste: {code2}"
    
    if extracted == expected:
        print("PASS: Multiple pastes extracted correctly")
        passed += 1
    else:
        print("FAIL: Multiple pastes extraction failed")
        failed += 1
    
    print(f"\nResults: {passed} passed, {failed} failed")
    return failed == 0


# =============================================================================
# EDGE CASES
# =============================================================================

def test_edge_cases():
    """Test edge cases and boundary conditions."""
    print("\n" + "=" * 70)
    print("Testing edge cases")
    print("=" * 70)
    
    passed = 0
    failed = 0
    
    # Test 1: Empty content
    display, actual, is_special, paste_type = process_pasted_content("")
    if paste_type == 'text':
        print("PASS: Empty content handled")
        passed += 1
    else:
        print(f"FAIL: Empty content -> paste_type={paste_type}")
        failed += 1
    
    # Test 2: Only whitespace
    display, actual, is_special, paste_type = process_pasted_content("   \n   \n   ")
    if not is_special:  # Whitespace shouldn't be treated as special
        print("PASS: Whitespace-only handled")
        passed += 1
    else:
        print(f"FAIL: Whitespace-only -> is_special={is_special}")
        failed += 1
    
    # Test 3: Content with existing markers (shouldn't double-mark)
    content = "Some text with ‹ and › characters"
    _, actual, _, _ = process_pasted_content(content)
    if '‹PASTE:' not in actual:  # Single line, shouldn't be marked
        print("PASS: Content with marker-like chars handled")
        passed += 1
    else:
        print("FAIL: Content incorrectly marked")
        failed += 1
    
    # Test 4: Exact threshold
    content = "1\n2\n3\n4\n5"  # Exactly 5 lines
    _, _, is_special, paste_type = process_pasted_content(content)
    if paste_type == 'paste':
        print("PASS: Exact threshold (5 lines) triggers badge")
        passed += 1
    else:
        print(f"FAIL: Exact threshold -> paste_type={paste_type}")
        failed += 1
    
    # Test 5: Very large paste
    large_content = '\n'.join([f'Line {i}' for i in range(1000)])
    _, marker, _, paste_type = process_pasted_content(large_content)
    extracted = extract_all_special_content(marker)
    if extracted == large_content:
        print("PASS: Very large paste (1000 lines) handled")
        passed += 1
    else:
        print("FAIL: Very large paste failed")
        failed += 1
    
    print(f"\nResults: {passed} passed, {failed} failed")
    return failed == 0


# =============================================================================
# MAIN
# =============================================================================

if __name__ == '__main__':
    print("\n🔧 Ouroboros Paste Badge Test Suite\n")
    
    all_passed = True
    
    all_passed &= test_paste_detection_small()
    all_passed &= test_paste_detection_large()
    all_passed &= test_paste_marker_creation()
    all_passed &= test_badge_rendering()
    all_passed &= test_content_extraction()
    all_passed &= test_full_paste_flow()
    all_passed &= test_edge_cases()
    
    print("\n" + "=" * 70)
    if all_passed:
        print("✅ ALL PASTE BADGE TESTS PASSED!")
    else:
        print("❌ SOME TESTS FAILED!")
        sys.exit(1)
    print("=" * 70)
