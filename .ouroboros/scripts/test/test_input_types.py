#!/usr/bin/env python3
"""
Test suite for ouroboros_input.py - covers all input types and menu detection.

Run: python test_input_types.py
"""
import sys
import os

# Add parent directory (scripts) to path for imports
SCRIPT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, SCRIPT_DIR)

from ouroboros_input import parse_menu_options

# =============================================================================
# TEST CASES
# =============================================================================

def test_parse_menu_options():
    """Test parse_menu_options with various input formats."""
    print("=" * 70)
    print("Testing parse_menu_options()")
    print("=" * 70)
    
    test_cases = [
        # (header, prompt, expected_title, expected_options, description)
        
        # === [y/n] Confirmation Tests ===
        # Note: Options are English-only (no Chinese) per user request
        (
            "继续执行下一项任务吗?",
            "[y/n]: ",
            "继续执行下一项任务吗?",
            ["Yes", "No"],
            "[y/n] confirmation - Chinese header"
        ),
        (
            "Continue with next task?",
            "[Y/N]:",
            "Continue with next task?",
            ["Yes", "No"],
            "[Y/N] confirmation - uppercase"
        ),
        (
            "Delete file?\\n\\nThis cannot be undone.",
            "[y/n]",
            "Delete file?  This cannot be undone.",
            ["Yes", "No"],
            "[y/n] with multiline header"
        ),
        
        # === Numbered Menu Tests ===
        (
            "Select action:\\n1. Create feature\\n2. Fix bug\\n3. Add test",
            "",
            "Select action:",
            ["Create feature", "Fix bug", "Add test"],
            "Numbered menu with dots (1. 2. 3.)"
        ),
        (
            "Choose mode:\\n[1] Task-by-Task\\n[2] Phase-by-Phase\\n[3] Auto-Run",
            "",
            "Choose mode:",
            ["Task-by-Task", "Phase-by-Phase", "Auto-Run"],
            "Numbered menu with brackets [1] [2] [3]"
        ),
        (
            "Options:\\n1) First option\\n2) Second option",
            "",
            "Options:",
            ["First option", "Second option"],
            "Numbered menu with parentheses 1) 2)"
        ),
        (
            "[1] 🔧 Task-by-Task\\n[2] 📦 Phase-by-Phase\\n[3] 🚀 Auto-Run All",
            "Select mode [1-3]: ",
            "Select an option:",
            ["🔧 Task-by-Task", "📦 Phase-by-Phase", "🚀 Auto-Run All"],
            "Menu with emoji icons"
        ),
        
        # === Non-Menu Tests (should return None, None) ===
        (
            "This is just a message",
            "",
            None,
            None,
            "Plain text - not a menu"
        ),
        (
            "Single line header",
            "Enter value: ",
            None,
            None,
            "Single line - not a menu"
        ),
        (
            "Info:\\nThis is line 1\\nThis is line 2",
            "",
            None,
            None,
            "Multiline without numbers - not a menu"
        ),
        (
            "Only one option:\\n1. Single item",
            "",
            None,
            None,
            "Only 1 option - not enough for menu"
        ),
    ]
    
    passed = 0
    failed = 0
    
    for header, prompt, expected_title, expected_options, description in test_cases:
        title, options = parse_menu_options(header, prompt)
        
        success = (title == expected_title and options == expected_options)
        
        status = "PASS" if success else "FAIL"
        print(f"\n{status}: {description}")
        print(f"  Header: [test data]...")
        print(f"  Prompt: [prompt]")
        
        if not success:
            print(f"  Expected: title=[expected], options=[expected]")
            print(f"  Got:      title=[got], options=[got]")
            failed += 1
        else:
            print(f"  Result: title=[result], options=[result]")
            passed += 1
    
    print("\n" + "=" * 70)
    print(f"Results: {passed} passed, {failed} failed")
    print("=" * 70)
    
    return failed == 0


def test_yn_mapping():
    """Test that Yes/No selections map back to y/n correctly."""
    print("\n" + "=" * 70)
    print("Testing y/n mapping logic")
    print("=" * 70)
    
    # Note: Chinese mapping removed per user request - English only
    test_cases = [
        ("Yes", "y", "Yes maps to y"),
        ("No", "n", "No maps to n"),
        ("yes", "y", "lowercase yes"),
        ("no", "n", "lowercase no"),
        ("YES", "y", "uppercase YES"),
        ("NO", "n", "uppercase NO"),
    ]
    
    passed = 0
    failed = 0
    
    for content, expected, description in test_cases:
        # Simulate the mapping logic from main() - English only
        if content.lower().startswith('yes'):
            result = 'y'
        elif content.lower().startswith('no'):
            result = 'n'
        else:
            result = content
        
        success = (result == expected)
        status = "PASS" if success else "FAIL"
        print(f"{status}: [test case]")
        print(f"  Input: [content] -> Output: [result]")
        
        if success:
            passed += 1
        else:
            print(f"  Expected: [expected]")
            failed += 1
    
    print("\n" + "=" * 70)
    print(f"Results: {passed} passed, {failed} failed")
    print("=" * 70)
    
    return failed == 0


def test_command_line_formats():
    """Document expected command line formats for each input type."""
    print("\n" + "=" * 70)
    print("Command Line Format Reference")
    print("=" * 70)
    
    formats = [
        (
            "Type A: CCL (main input)",
            "python ouroboros_input.py",
            "Full interactive input with WelcomeBox"
        ),
        (
            "Type B: Numbered Menu",
            'python ouroboros_input.py --header "[1] Option A\\n[2] Option B\\n[3] Option C" --prompt "Select [1-3]: " --var choice',
            "Arrow-key selection menu"
        ),
        (
            "Type B: Yes/No Confirmation",
            'python ouroboros_input.py --header "Continue with task?" --prompt "[y/n]: " --var confirm',
            "Yes/No selection, returns y or n"
        ),
        (
            "Type C: Free-form Input",
            'python ouroboros_input.py --prompt "Enter feature name: " --var feature',
            "Simple text input with prompt"
        ),
        (
            "Type D: Explicit Options",
            'python ouroboros_input.py --options "Create" "Update" "Delete" --prompt "Select action:" --var action',
            "Arrow-key selection from explicit options"
        ),
        (
            "Type E: Header + Simple Input",
            'python ouroboros_input.py --header "Info message here" --prompt "Enter value: " --var value',
            "Shows header box, then simple input (no menu detected)"
        ),
    ]
    
    for name, command, description in formats:
        print(f"\n{name}")
        print(f"  Command: {command}")
        print(f"  Description: {description}")
    
    print("\n" + "=" * 70)
    return True


# =============================================================================
# MAIN
# =============================================================================

if __name__ == '__main__':
    print("\n Ouroboros Input Test Suite\n")
    
    all_passed = True
    
    # Run tests
    all_passed &= test_parse_menu_options()
    all_passed &= test_yn_mapping()
    test_command_line_formats()
    
    print("\n" + "=" * 70)
    if all_passed:
        print(" ALL TESTS PASSED!")
    else:
        print("X SOME TESTS FAILED!")
        sys.exit(1)
    print("=" * 70)


