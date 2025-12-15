"""
Test GetAsyncKeyState to detect Ctrl+V at hardware level.
This bypasses terminal interception!
"""
import sys
import time
import ctypes
from ctypes import wintypes

user32 = ctypes.windll.user32

# Virtual key codes
VK_CONTROL = 0x11
VK_V = 0x56

def is_key_pressed(vk_code):
    """Check if a key is currently pressed using GetAsyncKeyState."""
    # High bit (0x8000) means key is currently pressed
    return bool(user32.GetAsyncKeyState(vk_code) & 0x8000)

print("="*60)
print("GetAsyncKeyState TEST")
print("="*60)
print("Press Ctrl+V - this should detect even if terminal intercepts!")
print("Press Ctrl+C to exit.")
print("="*60)
print()

last_ctrl_v = False

try:
    while True:
        ctrl_pressed = is_key_pressed(VK_CONTROL)
        v_pressed = is_key_pressed(VK_V)
        
        ctrl_v_now = ctrl_pressed and v_pressed
        
        # Only print on state change to avoid spam
        if ctrl_v_now and not last_ctrl_v:
            print(">>> CTRL+V DETECTED via GetAsyncKeyState! <<<")
        
        last_ctrl_v = ctrl_v_now
        
        time.sleep(0.01)  # Small delay to avoid CPU hogging

except KeyboardInterrupt:
    print("\n\nExited.")
