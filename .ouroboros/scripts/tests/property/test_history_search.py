"""
Property Test: History Search Correctness

**Feature: curses-tui-frontend, Property 7: History Search Correctness**
**Validates: Requirements 19.1-19.5**

Property 7: History Search Correctness
*For any* history entries list and search query, the search results SHALL contain
only entries that include the query as a substring, ordered by recency (most recent first).
"""

import sys
import os
import unittest
import random
import tempfile

# Add scripts directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from tests.pbt_framework import Generator, property_test, StringGenerator
from data.history import HistoryManager


class HistorySearchGenerator(Generator):
    """
    Generate HistoryManager instances with random entries and a search query.

    Returns a tuple of (HistoryManager, query_string).
    """

    def __init__(self, min_entries: int = 0, max_entries: int = 50, max_entry_len: int = 80):
        self.min_entries = min_entries
        self.max_entries = max_entries
        self.max_entry_len = max_entry_len

    def generate(self, rng: random.Random) -> tuple:
        # Create a temporary history file
        temp_file = tempfile.NamedTemporaryFile(mode="w", delete=False, suffix=".history")
        temp_file.close()

        # Create history manager with temp file
        history = HistoryManager(history_file=temp_file.name, max_entries=1000)
        history.entries = []  # Clear any loaded entries

        # Generate random entries
        num_entries = rng.randint(self.min_entries, self.max_entries)
        for _ in range(num_entries):
            entry_len = rng.randint(1, self.max_entry_len)
            entry = "".join(rng.choices("abcdefghijklmnopqrstuvwxyz0123456789 ", k=entry_len))
            history.entries.append(entry.strip())

        # Filter out empty entries
        history.entries = [e for e in history.entries if e]
        history.position = len(history.entries)

        # Generate a query - either from existing entries or random
        if history.entries and rng.random() < 0.7:
            # Pick a substring from an existing entry (more likely to match)
            source_entry = rng.choice(history.entries)
            if len(source_entry) > 2:
                start = rng.randint(0, len(source_entry) - 2)
                end = rng.randint(start + 1, min(start + 10, len(source_entry)))
                query = source_entry[start:end]
            else:
                query = source_entry
        else:
            # Random query
            query_len = rng.randint(1, 10)
            query = "".join(rng.choices("abcdefghijklmnopqrstuvwxyz", k=query_len))

        return (history, query, temp_file.name)

    def shrink(self, value: tuple) -> list:
        """Try to shrink to simpler cases."""
        history, query, temp_file = value
        results = []

        # Try with fewer entries
        if len(history.entries) > 1:
            smaller_history = HistoryManager(history_file=temp_file, max_entries=1000)
            smaller_history.entries = history.entries[: len(history.entries) // 2]
            smaller_history.position = len(smaller_history.entries)
            results.append((smaller_history, query, temp_file))

        # Try with shorter query
        if len(query) > 1:
            results.append((history, query[: len(query) // 2], temp_file))

        return results


class TestHistorySearchProperty(unittest.TestCase):
    """
    Property 7: History Search Correctness

    **Feature: curses-tui-frontend, Property 7: History Search Correctness**
    **Validates: Requirements 19.1-19.5**
    """

    def tearDown(self):
        """Clean up temporary files."""
        # Cleanup is handled by the test framework
        pass

    @property_test(HistorySearchGenerator(min_entries=1, max_entries=50), iterations=100)
    def test_search_results_contain_query(self, value: tuple):
        """
        **Feature: curses-tui-frontend, Property 7: History Search Correctness**
        **Validates: Requirements 19.1-19.5**

        For any search query, all results must contain the query as a substring.
        """
        history, query, temp_file = value

        try:
            results = history.search(query)

            # All results must contain the query (case-insensitive)
            for result in results:
                self.assertIn(
                    query.lower(),
                    result.lower(),
                    f"Result '{result}' does not contain query '{query}'",
                )
        finally:
            # Cleanup temp file
            try:
                os.unlink(temp_file)
            except:
                pass

    @property_test(HistorySearchGenerator(min_entries=5, max_entries=50), iterations=100)
    def test_search_results_ordered_by_recency(self, value: tuple):
        """
        **Feature: curses-tui-frontend, Property 7: History Search Correctness**
        **Validates: Requirements 19.1-19.5**

        Search results must be ordered by recency (most recent first).
        """
        history, query, temp_file = value

        try:
            results = history.search(query)

            if len(results) < 2:
                return  # Not enough results to check ordering

            # Get indices of results in original entries
            result_indices = []
            for result in results:
                # Find the last occurrence (most recent) of this entry
                for i in range(len(history.entries) - 1, -1, -1):
                    if history.entries[i] == result:
                        result_indices.append(i)
                        break

            # Results should be in descending order of indices (most recent first)
            for i in range(len(result_indices) - 1):
                self.assertGreaterEqual(
                    result_indices[i],
                    result_indices[i + 1],
                    f"Results not ordered by recency: index {result_indices[i]} should be >= {result_indices[i + 1]}",
                )
        finally:
            # Cleanup temp file
            try:
                os.unlink(temp_file)
            except:
                pass

    @property_test(HistorySearchGenerator(min_entries=1, max_entries=30), iterations=100)
    def test_search_finds_all_matching_entries(self, value: tuple):
        """
        **Feature: curses-tui-frontend, Property 7: History Search Correctness**
        **Validates: Requirements 19.1-19.5**

        Search should find all entries that contain the query.
        """
        history, query, temp_file = value

        try:
            results = history.search(query)

            # Count expected matches
            expected_matches = [e for e in history.entries if query.lower() in e.lower()]

            # Results should contain all matching entries (as a set, ignoring order)
            self.assertEqual(
                set(results),
                set(expected_matches),
                f"Search results don't match expected. Query: '{query}', "
                f"Expected: {expected_matches}, Got: {results}",
            )
        finally:
            # Cleanup temp file
            try:
                os.unlink(temp_file)
            except:
                pass


if __name__ == "__main__":
    unittest.main()
