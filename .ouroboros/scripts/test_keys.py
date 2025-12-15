"""
Key detection test script.
Run this to see what key codes are being received.
Press Ctrl+C to exit.
"""
import sys
import os
import msvcrt
import ctypes
from ctypes import wintypes

# Windows console input
kernel32 = ctypes.windll.kernel32
user32 = ctypes.windll.user32

# Get stdin handle
STD_INPUT_HANDLE = -10
stdin_handle = kernel32.GetStdHandle(STD_INPUT_HANDLE)

# Input record structure
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
    class _Event(ctypes.Union):
        _fields_ = [("KeyEvent", KEY_EVENT_RECORD)]
    
    _fields_ = [
        ("EventType", wintypes.WORD),
        ("Event", _Event),
    ]

KEY_EVENT = 0x0001

def get_pending_event_count():
    """Get number of pending console input events."""
    count = wintypes.DWORD()
    kernel32.GetNumberOfConsoleInputEvents(stdin_handle, ctypes.byref(count))
    return count.value

def read_console_input():
    """Read a single console input event with full VK info."""
    record = INPUT_RECORD()
    count = wintypes.DWORD()
    
    result = kernel32.ReadConsoleInputW(
        stdin_handle,
        ctypes.byref(record),
        1,
        ctypes.byref(count)
    )
    
    if result and count.value > 0:
        if record.EventType == KEY_EVENT:
            ke = record.Event.KeyEvent
            return {
                'key_down': ke.bKeyDown,
                'vk_code': ke.wVirtualKeyCode,
                'scan_code': ke.wVirtualScanCode,
                'char': ke.uChar,
                'control_state': ke.dwControlKeyState,
            }
    return None

print("="*60)
print("KEY DETECTION TEST")
print("="*60)
print("Press any key to see its codes.")
print("Press Ctrl+V to test paste detection.")
print("Press Ctrl+C to exit.")
print("="*60)
print()

# VK codes for reference
VK_CODES = {
    0x01: 'VK_LBUTTON', 0x02: 'VK_RBUTTON', 0x03: 'VK_CANCEL',
    0x08: 'VK_BACK', 0x09: 'VK_TAB', 0x0D: 'VK_RETURN', 
    0x10: 'VK_SHIFT', 0x11: 'VK_CONTROL', 0x12: 'VK_MENU',
    0x13: 'VK_PAUSE', 0x14: 'VK_CAPITAL',
    0x1B: 'VK_ESCAPE', 0x20: 'VK_SPACE', 0x21: 'VK_PRIOR', 0x22: 'VK_NEXT',
    0x23: 'VK_END', 0x24: 'VK_HOME', 0x25: 'VK_LEFT', 0x26: 'VK_UP',
    0x27: 'VK_RIGHT', 0x28: 'VK_DOWN', 0x2D: 'VK_INSERT', 0x2E: 'VK_DELETE',
    0x56: 'VK_V',  # V key
}


CTRL_KEY_STATE = {
    0x0001: 'RIGHT_ALT',
    0x0002: 'LEFT_ALT', 
    0x0004: 'RIGHT_CTRL',
    0x0008: 'LEFT_CTRL',
    0x0010: 'SHIFT',
    0x0020: 'NUMLOCK',
    0x0040: 'SCROLLLOCK',
    0x0080: 'CAPSLOCK',
    0x0100: 'ENHANCED',
}

def decode_ctrl_state(state):
    """Decode control key state bitmap."""
    flags = []
    for bit, name in CTRL_KEY_STATE.items():
        if state & bit:
            flags.append(name)
    return ' | '.join(flags) if flags else 'NONE'

try:
    while True:
        pending = get_pending_event_count()
        if pending > 0:
            event = read_console_input()
            if event and event['key_down']:  # Only show key-down events
                vk = event['vk_code']
                vk_name = VK_CODES.get(vk, f'0x{vk:02X}')
                char = event['char']
                char_repr = repr(char) if char else 'NONE'
                ctrl_state = decode_ctrl_state(event['control_state'])
                
                print(f"VK: {vk_name:15} | Char: {char_repr:10} | Control: {ctrl_state}")
                
                # Special detection for Ctrl+V
                if vk == 0x56 and (event['control_state'] & 0x000C):  # V key + any Ctrl
                    print(">>> CTRL+V DETECTED! <<<")
                    
                # Check for rapid events (paste detection)
                new_pending = get_pending_event_count()
                if new_pending >= 5:
                    print(f">>> RAPID EVENTS DETECTED: {new_pending} pending <<<")

except KeyboardInterrupt:
    print("\n\nExited.")
