"""
Property Test: File Path Marker Round-Trip

**Feature: curses-tui-frontend, Property 2: File Path Marker Round-Trip**
**Validates: Requirements 6.1-6.6, 16.2**

Property 2: File Path Marker Round-Trip
*For any* valid file path string, creating a file marker with `create_file_marker(path)`
and then expanding it with `expand_markers(marker)` SHALL return the original path.
"""

import sys
import os
import unittest

# Add scripts directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from tests.pbt_framework import property_test, FilePathGenerator, Generator
import random
from typing import List


class FilePathWithExtensionGenerator(Generator[str]):
    """Generate file paths with common extensions."""
    
    EXTENSIONS = ['.py', '.js', '.ts', '.md', '.txt', '.json', '.yaml', '.xml', '.html', '.css']
    
    def __init__(self, windows_ratio: float = 0.5):
        self.windows_ratio = windows_ratio
    
    def generate(self, rng: random.Random) -> str:
        ext = rng.choice(self.EXTENSIONS)
        
        if rng.random() < self.windows_ratio:
            # Windows path
            drive = rng.choice('CDEFGH')
            depth = rng.randint(1, 4)
            parts = [''.join(rng.choices('abcdefghijklmnopqrstuvwxyz0123456789_-', k=rng.randint(1, 12))) for _ in range(depth)]
            filename = ''.join(rng.choices('abcdefghijklmnopqrstuvwxyz0123456789_-', k=rng.randint(1, 10))) + ext
            parts.append(filename)
            return f"{drive}:\\" + "\\".join(parts)
        else:
            # Unix path
            depth = rng.randint(1, 4)
            parts = [''.join(rng.choices('abcdefghijklmnopqrstuvwxyz0123456789_-', k=rng.randint(1, 12))) for _ in range(depth)]
            filename = ''.join(rng.choices('abcdefghijklmnopqrstuvwxyz0123456789_-', k=rng.randint(1, 10))) + ext
            parts.append(filename)
            return "/" + "/".join(parts)
    
    def shrink(self, value: str) -> List[str]:
        # Try shorter paths
        if '\\' in value:
            parts = value.split('\\')
            if len(parts) > 2:
                return ['\\'.join(parts[:2]) + '\\file.txt']
        elif '/' in value:
            parts = value.split('/')
            if len(parts) > 2:
                return ['/'.join(parts[:2]) + '/file.txt']
        return []


class RelativePathGenerator(Generator[str]):
    """Generate relative file paths."""
    
    EXTENSIONS = ['.py', '.js', '.ts', '.md', '.txt']
    
    def generate(self, rng: random.Random) -> str:
        ext = rng.choice(self.EXTENSIONS)
        prefix = rng.choice(['./', '../', '../../'])
        depth = rng.randint(0, 3)
        parts = [''.join(rng.choices('abcdefghijklmnopqrstuvwxyz0123456789_-', k=rng.randint(1, 10))) for _ in range(depth)]
        filename = ''.join(rng.choices('abcdefghijklmnopqrstuvwxyz0123456789_-', k=rng.randint(1, 8))) + ext
        parts.append(filename)
        return prefix + '/'.join(parts)
    
    def shrink(self, value: str) -> List[str]:
        return ['./file.txt']


from utils.badge import create_file_marker, expand_markers, is_file_marker, extract_file_path


class TestFileMarkerRoundTrip(unittest.TestCase):
    """
    Property 2: File Path Marker Round-Trip
    
    **Feature: curses-tui-frontend, Property 2: File Path Marker Round-Trip**
    **Validates: Requirements 6.1-6.6, 16.2**
    """
    
    @property_test(FilePathWithExtensionGenerator(windows_ratio=0.5), iterations=100)
    def test_file_marker_round_trip_absolute_paths(self, path: str):
        """
        **Feature: curses-tui-frontend, Property 2: File Path Marker Round-Trip**
        **Validates: Requirements 6.1-6.6, 16.2**
        
        For any absolute file path, create_file_marker then expand_markers
        should return the original path.
        """
        # Create marker
        marker = create_file_marker(path)
        
        # Verify it's a valid marker
        self.assertTrue(
            is_file_marker(marker),
            f"create_file_marker did not produce a valid marker for '{path}'"
        )
        
        # Expand marker
        expanded = expand_markers(marker)
        
        # Should match original
        self.assertEqual(
            path,
            expanded,
            f"Round-trip failed: '{path}' -> '{marker}' -> '{expanded}'"
        )
    
    @property_test(RelativePathGenerator(), iterations=100)
    def test_file_marker_round_trip_relative_paths(self, path: str):
        """
        **Feature: curses-tui-frontend, Property 2: File Path Marker Round-Trip**
        **Validates: Requirements 6.1-6.6, 16.2**
        
        For any relative file path, create_file_marker then expand_markers
        should return the original path.
        """
        # Create marker
        marker = create_file_marker(path)
        
        # Verify it's a valid marker
        self.assertTrue(
            is_file_marker(marker),
            f"create_file_marker did not produce a valid marker for '{path}'"
        )
        
        # Expand marker
        expanded = expand_markers(marker)
        
        # Should match original
        self.assertEqual(
            path,
            expanded,
            f"Round-trip failed: '{path}' -> '{marker}' -> '{expanded}'"
        )
    
    @property_test(FilePathGenerator(windows_ratio=1.0), iterations=50)
    def test_windows_paths_round_trip(self, path: str):
        """
        **Feature: curses-tui-frontend, Property 2: File Path Marker Round-Trip**
        **Validates: Requirements 6.1, 16.2**
        
        For any Windows path, round-trip should preserve the path exactly.
        """
        marker = create_file_marker(path)
        expanded = expand_markers(marker)
        
        self.assertEqual(
            path,
            expanded,
            f"Windows path round-trip failed: '{path}'"
        )
    
    @property_test(FilePathGenerator(windows_ratio=0.0), iterations=50)
    def test_unix_paths_round_trip(self, path: str):
        """
        **Feature: curses-tui-frontend, Property 2: File Path Marker Round-Trip**
        **Validates: Requirements 6.2, 16.2**
        
        For any Unix path, round-trip should preserve the path exactly.
        """
        marker = create_file_marker(path)
        expanded = expand_markers(marker)
        
        self.assertEqual(
            path,
            expanded,
            f"Unix path round-trip failed: '{path}'"
        )
    
    def test_extract_file_path_consistency(self):
        """
        **Feature: curses-tui-frontend, Property 2: File Path Marker Round-Trip**
        **Validates: Requirements 6.5-6.6, 16.2**
        
        extract_file_path and expand_markers should produce same result for single markers.
        """
        test_paths = [
            'C:\\Users\\test\\file.py',
            '/home/user/document.md',
            './relative/path.txt',
            '../parent/file.json',
        ]
        
        for path in test_paths:
            marker = create_file_marker(path)
            
            # Both methods should extract the same path
            via_extract = extract_file_path(marker)
            via_expand = expand_markers(marker)
            
            self.assertEqual(
                via_extract,
                via_expand,
                f"Extraction methods differ for '{path}'"
            )
            self.assertEqual(
                path,
                via_extract,
                f"Extracted path differs from original for '{path}'"
            )


if __name__ == '__main__':
    unittest.main()
