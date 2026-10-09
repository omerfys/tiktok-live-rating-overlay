param (
    [string]$StartKey = "F6",
    [string]$StopKey = "",
    [string]$RaffleKey = "F8",
    [int]$Port = 3000
)

function Get-VKCode([string]$k) {
    if ([string]::IsNullOrWhiteSpace($k)) { return 0 }
    $clean = $k.ToUpper().Trim()

    # 1. Mouse Buttons (Fare Tuşları)
    if ($clean -match '^(MOUSE4|XBUTTON1|MOUSE_4|M4|BUTTON4)$') { return 5 }
    if ($clean -match '^(MOUSE5|XBUTTON2|MOUSE_5|M5|BUTTON5)$') { return 6 }
    if ($clean -match '^(MOUSEMIDDLE|MOUSE3|MBUTTON|MIDDLE|WHEEL|SCROLLCLICK)$') { return 4 }
    if ($clean -match '^(MOUSERIGHT|RBUTTON|RIGHTCLICK|MOUSE2)$') { return 2 }
    if ($clean -match '^(MOUSELEFT|LBUTTON|LEFTCLICK|MOUSE1)$') { return 1 }

    # 2. Function Keys F1 - F24
    if ($clean -match '^F([1-9]|1[0-9]|2[0-4])$') {
        $num = [int]$matches[1]
        if ($num -le 12) { return 111 + $num }
        if ($num -le 24) { return 123 + ($num - 12) }
    }

    # 3. Letters A-Z (e.g. "KeyA", "A")
    if ($clean -match '^(?:KEY)?([A-Z])$') {
        return [int][char]$matches[1]
    }

    # 4. Digits 0-9 (e.g. "Digit1", "1")
    if ($clean -match '^(?:DIGIT)?([0-9])$') {
        return 48 + [int]$matches[1]
    }

    # 5. Numpad Keys (e.g. "Numpad1", "Num1")
    if ($clean -match '^(?:NUMPAD|NUM)?([0-9])$') {
        return 96 + [int]$matches[1]
    }
    if ($clean -match '^(NUMPADMULTIPLY|MULTIPLY)$') { return 106 }
    if ($clean -match '^(NUMPADADD|ADD)$') { return 107 }
    if ($clean -match '^(NUMPADSUBTRACT|SUBTRACT)$') { return 109 }
    if ($clean -match '^(NUMPADDECIMAL|DECIMAL)$') { return 110 }
    if ($clean -match '^(NUMPADDIVIDE|DIVIDE)$') { return 111 }

    # 6. Special / Navigation / Modifier Keys
    if ($clean -match '^(SPACE|SPACEBAR)$') { return 32 }
    if ($clean -match '^(ENTER|RETURN)$') { return 13 }
    if ($clean -match '^(ESCAPE|ESC)$') { return 27 }
    if ($clean -match '^TAB$') { return 9 }
    if ($clean -match '^(BACKSPACE|BACK)$') { return 8 }
    if ($clean -match '^(CAPSLOCK|CAPS|CAPITAL)$') { return 20 }
    if ($clean -match '^(SHIFT|LSHIFT|RSHIFT|SHIFTLEFT|SHIFTRIGHT)$') { return 16 }
    if ($clean -match '^(CONTROL|CTRL|LCONTROL|RCONTROL|CONTROLLEFT|CONTROLRIGHT)$') { return 17 }
    if ($clean -match '^(ALT|MENU|ALTLEFT|ALTRIGHT)$') { return 18 }
    if ($clean -match '^(PAUSE|BREAK)$') { return 19 }
    if ($clean -match '^(PAGEUP|PRIOR)$') { return 33 }
    if ($clean -match '^(PAGEDOWN|NEXT)$') { return 34 }
    if ($clean -match '^END$') { return 35 }
    if ($clean -match '^HOME$') { return 36 }
    if ($clean -match '^(ARROWLEFT|LEFT)$') { return 37 }
    if ($clean -match '^(ARROWUP|UP)$') { return 38 }
    if ($clean -match '^(ARROWRIGHT|RIGHT)$') { return 39 }
    if ($clean -match '^(ARROWDOWN|DOWN)$') { return 40 }
    if ($clean -match '^INSERT$') { return 45 }
    if ($clean -match '^(DELETE|DEL)$') { return 46 }
    if ($clean -match '^(PRINTSCREEN|SNAPSHOT|PRTSC|PRTSCN)$') { return 44 }
    if ($clean -match '^NUMLOCK$') { return 144 }
    if ($clean -match '^(SCROLLLOCK|SCROLL)$') { return 145 }

    # 7. OEM Symbols / Punctuation
    if ($clean -match '^(SEMICOLON|;)$') { return 186 }
    if ($clean -match '^(EQUAL|EQUALS|=)$') { return 187 }
    if ($clean -match '^(COMMA|,)$') { return 188 }
    if ($clean -match '^(MINUS|-)$') { return 189 }
    if ($clean -match '^(PERIOD|\.)$') { return 190 }
    if ($clean -match '^(SLASH|\/)$') { return 191 }
    if ($clean -match '^(BACKQUOTE|GRAVE|TILDE|`)$') { return 192 }
    if ($clean -match '^(BRACKETLEFT|\[)$') { return 219 }
    if ($clean -match '^(BACKSLASH|\\)$') { return 220 }
    if ($clean -match '^(BRACKETRIGHT|\])$') { return 221 }
    if ($clean -match '^(QUOTE|\'')$') { return 222 }

    # 8. Direct numeric VK code
    if ($clean -match '^[0-9]{1,3}$') {
        $val = [int]$clean
        if ($val -ge 1 -and $val -le 255) { return $val }
    }

    return 0
}

$vStartKey = Get-VKCode $StartKey
$vRaffleKey = Get-VKCode $RaffleKey

$code = @"
using System;
using System.Runtime.InteropServices;
public class WinHotkeyNative {
    [DllImport("user32.dll")]
    public static extern short GetAsyncKeyState(int vKey);
}
"@

try {
    Add-Type -TypeDefinition $code -Language CSharp -ErrorAction SilentlyContinue
} catch {}

$lastStartState = $false
$lastRaffleState = $false

while ($true) {
    Start-Sleep -Milliseconds 25
    try {
        if ($vStartKey -gt 0) {
            $startState = ([WinHotkeyNative]::GetAsyncKeyState($vStartKey) -band 0x8000) -ne 0
            if ($startState -and -not $lastStartState) {
                Invoke-RestMethod -Uri "http://localhost:$Port/api/round/toggle" -Method POST -ContentType "application/json" -Body '{}' -ErrorAction SilentlyContinue | Out-Null
            }
            $lastStartState = $startState
        }

        if ($vRaffleKey -gt 0) {
            $raffleState = ([WinHotkeyNative]::GetAsyncKeyState($vRaffleKey) -band 0x8000) -ne 0
            if ($raffleState -and -not $lastRaffleState) {
                Invoke-RestMethod -Uri "http://localhost:$Port/api/raffle/toggle" -Method POST -ContentType "application/json" -Body '{}' -ErrorAction SilentlyContinue | Out-Null
            }
            $lastRaffleState = $raffleState
        }
    } catch {}
}




