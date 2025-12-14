#!/usr/bin/env python3
"""Test Windows Console API for paste detection via event count."""
import ctypes
from ctypes import wintypes
import time

print("=" * 60)
print("Console Input Event Count Test")
print("=" * 60)
print()
print("This tests if we can detect paste via waiting event count.")
print("Try:")
print("  1. Type normally - should see 1-2 events per keystroke")
print("  2. Paste text - should see MANY events at once")
print()
print("Press Ctrl+C to exit.")
print("=" * 60)

kernel32 = ctypes.windll.kernel32

# Get console input handle
STD_INPUT_HANDLE = -10
handle = kernel32.GetStdHandle(STD_INPUT_HANDLE)

# Console mode flags
ENABLE_PROCESSED_INPUT = 0x0001

# Get and modify console mode
old_mode = wintypes.DWORD()
kernel32.GetConsoleMode(handle, ctypes.byref(old_mode))

# Set minimal mode for raw input
kernel32.SetConsoleMode(handle, ENABLE_PROCESSED_INPUT)

try:
    while True:
        # Check number of waiting events
        num_events = wintypes.DWORD()
        kernel32.GetNumberOfConsoleInputEvents(handle, ctypes.byref(num_events))
        
        if num_events.value > 0:
            event_count = num_events.value
            timestamp = time.time()
            
            # This is the key insight for paste detection!
            if event_count >= 5:
                print(f"[PASTE DETECTED?] {event_count} events waiting at once!")
            else:
                print(f"[normal] {event_count} event(s) waiting")
            
            # Read all events to clear buffer
            class KEY_EVENT_RECORD(ctypes.Structure):
                _fields_ = [
                    ("bKeyDown", wintypes.BOOL),
                    ("wRepeatCount", wintypes.WORD),
                    ("wVirtualKeyCode", wintypes.WORD),
                    ("wVirtualScanCode", wintypes.WORD),
                    ("uChar", wintypes.WCHAR),
                    ("dwControlKeyState", wintypes.DWORD),
                ]
            
            class INPUT_RECORD(ctypes.Structure):
                _fields_ = [
                    ("EventType", wintypes.WORD),
                    ("Event", KEY_EVENT_RECORD),
                ]
            
            # Read one event at a time
            for _ in range(event_count):
                record = INPUT_RECORD()
                num_read = wintypes.DWORD()
                kernel32.ReadConsoleInputW(handle, ctypes.byref(record), 1, ctypes.byref(num_read))
                
                if num_read.value > 0 and record.EventType == 0x0001:  # KEY_EVENT
                    if record.Event.bKeyDown:
                        char = record.Event.uChar
                        if char and ord(char) >= 32:
                            print(f"  -> '{char}'")
        
        time.sleep(0.05)  # Small delay to prevent busy loop

except KeyboardInterrupt:
    print("\nExiting...")
finally:
    # Restore original mode
    kernel32.SetConsoleMode(handle, old_mode.value)
    print("Console mode restored.")
