# dsh-taskbar-flash - taskbar attention helper.
#
# Finds the top-level window owned by -ParentPid (the DSH Desktop main process)
# and asks Win32 FlashWindowEx for the standard attention flash. Skips the flash
# while that window is the foreground window unless -Force is given.
#
# The script prints exactly one JSON line on stdout and never throws for a
# missing window: the caller treats any parsed result as best-effort input.
#
# Keep this file ASCII-only: Windows PowerShell reads .ps1 files as ANSI when
# they have no BOM.

param(
    [int]$ParentPid = 0,
    [int]$Count = 0,
    [switch]$Force
)

$ErrorActionPreference = 'Stop'

$source = @'
using System;
using System.Runtime.InteropServices;

public static class DshTaskbarFlash
{
    [StructLayout(LayoutKind.Sequential)]
    public struct FLASHWINFO
    {
        public uint cbSize;
        public IntPtr hwnd;
        public uint dwFlags;
        public uint uCount;
        public uint dwTimeout;
    }

    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    [DllImport("user32.dll")]
    public static extern bool EnumWindows(EnumWindowsProc callback, IntPtr lParam);

    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);

    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hWnd);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    public static extern int GetWindowTextLength(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool FlashWindowEx(ref FLASHWINFO info);

    public static IntPtr FindWindow(uint pid)
    {
        IntPtr found = IntPtr.Zero;
        EnumWindows(delegate(IntPtr hWnd, IntPtr lParam)
        {
            uint owner = 0;
            GetWindowThreadProcessId(hWnd, out owner);
            if (owner != pid) return true;
            if (!IsWindowVisible(hWnd)) return true;
            if (GetWindowTextLength(hWnd) == 0) return true;
            found = hWnd;
            return false;
        }, IntPtr.Zero);
        return found;
    }
}
'@

Add-Type -TypeDefinition $source -Language CSharp

if ($ParentPid -le 0) {
    Write-Output '{"ok":false,"action":"skip","reason":"no-parent-pid"}'
    exit 0
}

$window = [DshTaskbarFlash]::FindWindow([uint32]$ParentPid)
if ($window -eq [IntPtr]::Zero) {
    Write-Output '{"ok":false,"action":"skip","reason":"no-window"}'
    exit 0
}

$focused = ([DshTaskbarFlash]::GetForegroundWindow() -eq $window)
if ($focused -and -not $Force) {
    Write-Output ('{"ok":false,"action":"skip","reason":"focused","hwnd":' + $window.ToInt64() + '}')
    exit 0
}

# FLASHW_ALL = 1 | 2; FLASHW_TIMERNOFG = 12 keeps flashing until the window is
# brought to the foreground. With -Count > 0 flash a bounded number of times.
$flags = 3
if ($Count -le 0) {
    $flags = 15
}

$info = New-Object DshTaskbarFlash+FLASHWINFO
$info.cbSize = [uint32][System.Runtime.InteropServices.Marshal]::SizeOf($info)
$info.hwnd = $window
$info.dwFlags = [uint32]$flags
$info.uCount = [uint32]([Math]::Max(0, $Count))
$info.dwTimeout = 0

$result = [DshTaskbarFlash]::FlashWindowEx([ref]$info)
Write-Output ('{"ok":' + $result.ToString().ToLowerInvariant() + ',"action":"flash","hwnd":' + $window.ToInt64() + ',"count":' + $Count + '}')
