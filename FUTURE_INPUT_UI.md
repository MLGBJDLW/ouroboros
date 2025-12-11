# 🎨 Enhanced Input UI - Future Exploration

> **Status**: 💡 Idea / Not Started
> **Priority**: Low
> **Last Updated**: 2025-12-11

## Problem

Current `python -c "task = input('[Ouroboros] > ')"` is very limited:
- Single line input only
- No multi-line support
- Poor editing experience
- No command history

## Proposed Solution

Create cross-platform scripts for enhanced input:

### Windows (PowerShell)

```powershell
# ouroboros-input.ps1
Add-Type -AssemblyName System.Windows.Forms

$form = New-Object System.Windows.Forms.Form
$form.Text = "[Ouroboros] >"
$form.Size = '500,300'
$form.StartPosition = 'CenterScreen'

$textBox = New-Object System.Windows.Forms.TextBox
$textBox.Multiline = $true
$textBox.ScrollBars = 'Vertical'
$textBox.Dock = 'Fill'
$textBox.Font = 'Consolas,12'

$button = New-Object System.Windows.Forms.Button
$button.Text = "Submit"
$button.Dock = 'Bottom'
$button.Add_Click({ $form.Close() })

$form.Controls.Add($textBox)
$form.Controls.Add($button)
$form.ShowDialog() | Out-Null

Write-Output $textBox.Text
```

### macOS/Linux (Bash + Dialog)

```bash
#!/bin/bash
# ouroboros-input.sh

# Using dialog for TUI
input=$(dialog --title "[Ouroboros] >" \
               --inputbox "Enter task:" 10 60 \
               2>&1 >/dev/tty)
echo "$input"

# Alternative: Use a temp file for multi-line
# nano /tmp/ouroboros-input.txt && cat /tmp/ouroboros-input.txt
```

## Integration

Replace in `copilot-instructions.md`:

```diff
- python -c "task = input('[Ouroboros] > ')"
+ # Windows
+ powershell -File .ouroboros/scripts/ouroboros-input.ps1
+ # macOS/Linux  
+ bash .ouroboros/scripts/ouroboros-input.sh
```

## Limitations

⚠️ **Image Support**: Copilot cannot read images from file paths provided via terminal. Images must be attached directly in VS Code Chat UI. This is a VS Code/Copilot limitation, not something we can work around.

## Future Ideas

1. Node.js TUI (like Gemini CLI using Ink)
2. Local web server with browser UI
3. VS Code extension with custom input panel

---

*This is a future exploration item. Implementation not currently planned.*
