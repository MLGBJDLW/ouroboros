"""
Custom Property-Based Testing Framework for Ouroboros TUI.

This framework provides property-based testing using only Python standard library.
It includes generators for various data types and a decorator for running
property tests with shrinking support.


"""

import random
import unittest
from typing import Callable, TypeVar, Generic, List, Any

T = TypeVar("T")


class Generator(Generic[T]):
    """Base class for random value generators."""

    def generate(self, random_state: random.Random) -> T:
        raise NotImplementedError

    def shrink(self, value: T) -> List[T]:
        """Return smaller versions of value for shrinking."""
        return []


class IntGenerator(Generator[int]):
    """Generate random integers within a range."""

    def __init__(self, min_val: int = 0, max_val: int = 100):
        self.min_val = min_val
        self.max_val = max_val

    def generate(self, rng: random.Random) -> int:
        return rng.randint(self.min_val, self.max_val)

    def shrink(self, value: int) -> List[int]:
        if value == 0:
            return []
        return [0, value // 2, value - 1]


class StringGenerator(Generator[str]):
    """Generate random strings from an alphabet."""

    def __init__(self, alphabet: str = None, min_len: int = 0, max_len: int = 50):
        self.alphabet = (
            alphabet or "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
        )
        self.min_len = min_len
        self.max_len = max_len

    def generate(self, rng: random.Random) -> str:
        length = rng.randint(self.min_len, self.max_len)
        return "".join(rng.choice(self.alphabet) for _ in range(length))

    def shrink(self, value: str) -> List[str]:
        if not value:
            return []
        return ["", value[: len(value) // 2], value[:-1]]


class CJKStringGenerator(Generator[str]):
    """Generate strings with mix of ASCII and CJK characters."""

    CJK_CHARS = "你好世界日本語한국어中文漢字ひらがなカタカナ"
    ASCII_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789 "

    def __init__(self, min_len: int = 0, max_len: int = 50, cjk_ratio: float = 0.3):
        self.min_len = min_len
        self.max_len = max_len
        self.cjk_ratio = cjk_ratio

    def generate(self, rng: random.Random) -> str:
        length = rng.randint(self.min_len, self.max_len)
        chars = []
        for _ in range(length):
            if rng.random() < self.cjk_ratio:
                chars.append(rng.choice(self.CJK_CHARS))
            else:
                chars.append(rng.choice(self.ASCII_CHARS))
        return "".join(chars)

    def shrink(self, value: str) -> List[str]:
        if not value:
            return []
        # Try to shrink to smaller strings
        results = []
        if len(value) > 1:
            results.append(value[: len(value) // 2])
            results.append(value[:-1])
        # Try to isolate CJK characters
        cjk_only = "".join(c for c in value if c in self.CJK_CHARS)
        if cjk_only and cjk_only != value:
            results.append(cjk_only)
        return results


class FilePathGenerator(Generator[str]):
    """Generate valid file paths (Windows and Unix)."""

    def __init__(self, windows_ratio: float = 0.5):
        self.windows_ratio = windows_ratio

    def generate(self, rng: random.Random) -> str:
        if rng.random() < self.windows_ratio:
            # Windows path
            drive = rng.choice("CDEFGH")
            depth = rng.randint(1, 5)
            parts = [
                "".join(
                    rng.choices(
                        "abcdefghijklmnopqrstuvwxyz0123456789_-", k=rng.randint(1, 15)
                    )
                )
                for _ in range(depth)
            ]
            return f"{drive}:\\" + "\\".join(parts)
        else:
            # Unix path
            depth = rng.randint(1, 5)
            parts = [
                "".join(
                    rng.choices(
                        "abcdefghijklmnopqrstuvwxyz0123456789_-", k=rng.randint(1, 15)
                    )
                )
                for _ in range(depth)
            ]
            return "/" + "/".join(parts)

    def shrink(self, value: str) -> List[str]:
        # Try shorter paths
        if "\\" in value:
            parts = value.split("\\")
            if len(parts) > 2:
                return ["\\".join(parts[:2])]
        elif "/" in value:
            parts = value.split("/")
            if len(parts) > 2:
                return ["/".join(parts[:2])]
        return []


class MultilineGenerator(Generator[str]):
    """Generate multi-line text content."""

    def __init__(self, min_lines: int = 1, max_lines: int = 20, max_line_len: int = 80):
        self.min_lines = min_lines
        self.max_lines = max_lines
        self.max_line_len = max_line_len

    def generate(self, rng: random.Random) -> str:
        num_lines = rng.randint(self.min_lines, self.max_lines)
        lines = []
        for _ in range(num_lines):
            line_len = rng.randint(0, self.max_line_len)
            line = "".join(
                rng.choices("abcdefghijklmnopqrstuvwxyz0123456789 .,!?", k=line_len)
            )
            lines.append(line)
        return "\n".join(lines)

    def shrink(self, value: str) -> List[str]:
        lines = value.split("\n")
        if len(lines) <= 1:
            return []
        # Try fewer lines
        return ["\n".join(lines[: len(lines) // 2]), "\n".join(lines[:-1])]


def property_test(generator: Generator[T], iterations: int = 100, seed: int = 42):
    """
    Decorator for property-based tests.

    Args:
        generator: Generator for test values
        iterations: Number of test iterations (minimum 100)
        seed: Random seed for reproducibility
    """

    def decorator(test_func: Callable[[Any, T], None]):
        def wrapper(self):
            rng = random.Random(seed)
            for i in range(iterations):
                value = generator.generate(rng)
                try:
                    test_func(self, value)
                except AssertionError as e:
                    # Try to shrink to find minimal failing case
                    shrunk = generator.shrink(value)
                    minimal_value = value
                    for smaller in shrunk:
                        try:
                            test_func(self, smaller)
                        except AssertionError:
                            minimal_value = smaller
                            break
                    raise AssertionError(
                        f"Property failed on iteration {i} with value: {repr(minimal_value)}"
                    ) from e

        wrapper.__name__ = test_func.__name__
        wrapper.__doc__ = test_func.__doc__
        return wrapper

    return decorator
