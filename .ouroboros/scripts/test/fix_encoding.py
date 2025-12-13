#!/usr/bin/env python3
"""Fix encoding issues in test files by wrapping repr() output."""
import re
import sys
from pathlib import Path

def safe_repr_wrapper(text):
    """Create a safe representation that won't cause encoding errors."""
    try:
        # Try to encode as ASCII
        text.encode('ascii')
        return repr(text)
    except (UnicodeEncodeError, UnicodeDecodeError):
        # Contains non-ASCII, return placeholder
        return "'[non-ASCII data]'"

def fix_file(filepath):
    """Fix encoding issues in a test file."""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Replace problematic print statements
    replacements = [
        # test_ui.py line 51
        (r'print\(f"  Input: \{repr\(text\)\} -> Length: \{result\}"\)',
         'print(f"  Input: [test] -> Length: {result}")'),
        
        # test_keybuffer.py line 108
        (r'print\(f"  is_printable\(\{repr\(char\)\}\) = \{result\}"\)',
         'print(f"  is_printable([char]) = {result}")'),
        
        # test_input_types.py line 124
        (r'print\(f"  Header: \{repr\(header\[:50\]\)\}\.\.\."\)',
         'print(f"  Header: [test data]...")'),
        
        # test_edge_cases.py line 524
        (r'print\(f"\{status\}: \{description\}"\)',
         'print(f"{status}: [test]")'),
        
        # test_edge_cases.py line 326
        (r'print\(f"  Input: \{repr\(text\[:30\]\)\}\.\.\."\)',
         'print(f"  Input: [test data]...")'),
    ]
    
    modified = False
    for pattern, replacement in replacements:
        if re.search(pattern, content):
            content = re.sub(pattern, replacement, content)
            modified = True
    
    if modified:
        with open(filepath, 'w', encoding='utf-8', newline='\n') as f:
            f.write(content)
        print(f"Fixed: {filepath}")
        return True
    return False

if __name__ == '__main__':
    test_dir = Path(__file__).parent
    files = ['test_ui.py', 'test_keybuffer.py', 'test_input_types.py', 'test_edge_cases.py']
    
    fixed_count = 0
    for filename in files:
        filepath = test_dir / filename
        if filepath.exists() and fix_file(filepath):
            fixed_count += 1
    
    print(f"\nFixed {fixed_count} file(s)")
