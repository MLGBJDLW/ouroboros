#!/usr/bin/env python3
"""Comprehensive fix for all encoding issues in test files."""
import re
from pathlib import Path

def safe_repr(match):
    """Replace repr() calls with safe ASCII-only output."""
    return '[data]'

def fix_file(filepath):
    """Fix all repr() calls that might contain non-ASCII data."""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original = content
    
    # Replace all repr() in print statements with safe placeholders
    # Pattern: print statements containing repr()
    patterns = [
        # FAIL messages with repr(buf.text) or similar
        (r'print\(f"FAIL: .* - got \{repr\([^)]+\)\}"\)', 
         lambda m: m.group(0).replace('repr(', '[').replace(')}', ']')),
        
        # Any print with repr() that might contain non-ASCII
        (r'(print\(f"[^"]*\{repr\()([^)]+)(\)\}[^"]*"\))',
         r'\1\2\3'),  # Keep structure but we'll replace repr output
    ]
    
    # Simpler approach: replace specific problematic lines
    replacements = {
        # test_textbuffer.py
        'print(f"FAIL: Insert characters - got {repr(buf.text)}")':
            'print(f"FAIL: Insert characters - got [data]")',
        'print(f"FAIL: Newline - got {repr(buf.text)}, lines={buf.line_count}")':
            'print(f"FAIL: Newline - got [data], lines={buf.line_count}")',
        'print(f"FAIL: Backspace - got {repr(buf.text)}")':
            'print(f"FAIL: Backspace - got [data]")',
        'print(f"FAIL: Backspace merge - got {repr(buf.text)}, lines={buf.line_count}")':
            'print(f"FAIL: Backspace merge - got [data], lines={buf.line_count}")',
        'print(f"FAIL: Single line - got {repr(buf.text)}")':
            'print(f"FAIL: Single line - got [data]")',
        'print(f"FAIL: Multi-line - got {repr(buf.text)}, lines={buf.line_count}")':
            'print(f"FAIL: Multi-line - got [data], lines={buf.line_count}")',
        'print(f"FAIL: Chinese - got {repr(buf.text)}")':
            'print(f"FAIL: Chinese - got [data]")',
        'print(f"FAIL: Mixed - got {repr(buf.text)}")':
            'print(f"FAIL: Mixed - got [data]")',
        'print(f"FAIL: Delete - got {repr(buf.text)}")':
            'print(f"FAIL: Delete - got [data]")',
        'print(f"FAIL: Delete merge - got {repr(buf.text)}, lines={buf.line_count}")':
            'print(f"FAIL: Delete merge - got [data], lines={buf.line_count}")',
        
        # test_edge_cases.py
        'print(f"FAIL: Emoji - got {repr(buf.text)}")':
            'print(f"FAIL: Emoji - got [data]")',
        'print(f"FAIL: Insert middle - got {repr(buf.text)}")':
            'print(f"FAIL: Insert middle - got [data]")',
        'print(f"  Input: {repr(input_key)}, Expected: {repr(expected)}, Got: {repr(result)}")':
            'print(f"  Input: [key], Expected: [expected], Got: [result]")',
        'print(f"  Input: {repr(content)}, Expected: {repr(expected)}, Got: {repr(result)}")':
            'print(f"  Input: [content], Expected: [expected], Got: [result]")',
        
        # test_input_types.py
        'print(f"  Prompt: {repr(prompt)}")':
            'print(f"  Prompt: [prompt]")',
        'print(f"  Input: {repr(content)} -> Output: {repr(result)}")':
            'print(f"  Input: [content] -> Output: [result]")',
        'print(f"  Expected: {repr(expected)}")':
            'print(f"  Expected: [expected]")',
        
        # test_keybuffer.py
        'print(f"{status}: Keys.{name} = {repr(actual)}")':
            'print(f"{status}: Keys.{name} = [value]")',
        'print(f"  Expected: {repr(expected)}")':
            'print(f"  Expected: [expected]")',
        'print(f"  {repr(input_key)} -> {repr(result)}")':
            'print(f"  [input] -> [result]")',
        
        # test_ui.py
        'print(f"  Input: [test data] -> Output: {repr(result)}")':
            'print(f"  Input: [test data] -> Output: [result]")',
        'print(f"  Expected: {repr(expected)}")':
            'print(f"  Expected: [expected]")',
    }
    
    for old, new in replacements.items():
        if old in content:
            content = content.replace(old, new)
    
    if content != original:
        with open(filepath, 'w', encoding='utf-8', newline='\n') as f:
            f.write(content)
        return True
    return False

if __name__ == '__main__':
    test_dir = Path(__file__).parent
    files = [
        'test_textbuffer.py',
        'test_edge_cases.py', 
        'test_input_types.py',
        'test_keybuffer.py',
        'test_ui.py'
    ]
    
    fixed_count = 0
    for filename in files:
        filepath = test_dir / filename
        if filepath.exists():
            if fix_file(filepath):
                print(f"Fixed: {filename}")
                fixed_count += 1
            else:
                print(f"No changes: {filename}")
    
    print(f"\nFixed {fixed_count} file(s)")
