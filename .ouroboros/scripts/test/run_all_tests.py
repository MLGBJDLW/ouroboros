#!/usr/bin/env python3
"""
Run all Ouroboros test suites.

Usage:
    python run_all_tests.py           # Run all tests
    python run_all_tests.py --quick   # Skip interactive tests
"""
import sys
import os
import subprocess
import argparse

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

# Test modules to run (in order)
TEST_MODULES = [
    ('test_ui.py', 'UI Components'),
    ('test_keybuffer.py', 'KeyBuffer'),
    ('test_textbuffer.py', 'TextBuffer'),
    ('test_input_types.py', 'Input Types & Menu Detection'),
    ('test_edge_cases.py', 'Edge Cases & Boundary Conditions'),
]

# Interactive tests (skipped with --quick)
INTERACTIVE_TESTS = [
    ('test_keys.py', 'Keyboard Input (Interactive)'),
]


def run_test(filename: str, description: str) -> bool:
    """Run a single test file and return success status."""
    filepath = os.path.join(SCRIPT_DIR, filename)
    
    if not os.path.exists(filepath):
        print(f"SKIP: {filename} not found")
        return True
    
    print(f"\n{'=' * 70}")
    print(f"Running: {description}")
    print(f"File: {filename}")
    print('=' * 70)
    
    result = subprocess.run(
        [sys.executable, filepath],
        cwd=SCRIPT_DIR,
        capture_output=False
    )
    
    return result.returncode == 0


def main():
    parser = argparse.ArgumentParser(description='Run Ouroboros test suites')
    parser.add_argument('--quick', action='store_true', 
                        help='Skip interactive tests')
    args = parser.parse_args()
    
    print("\n" + "=" * 70)
    print("OUROBOROS TEST RUNNER")
    print("=" * 70)
    
    all_passed = True
    passed_count = 0
    failed_count = 0
    
    # Run automated tests
    for filename, description in TEST_MODULES:
        if run_test(filename, description):
            passed_count += 1
        else:
            failed_count += 1
            all_passed = False
    
    # Run interactive tests (unless --quick)
    if not args.quick:
        print("\n" + "=" * 70)
        print("Interactive tests (require manual input)")
        print("=" * 70)
        for filename, description in INTERACTIVE_TESTS:
            print(f"\nSKIP: {description}")
            print(f"   Run manually: python {filename}")
    
    # Summary
    print("\n" + "=" * 70)
    print("TEST SUMMARY")
    print("=" * 70)
    print(f"  Passed: {passed_count}")
    print(f"  Failed: {failed_count}")
    print("=" * 70)
    
    if all_passed:
        print("ALL AUTOMATED TESTS PASSED!")
        return 0
    else:
        print("SOME TESTS FAILED!")
        return 1


if __name__ == '__main__':
    sys.exit(main())

