param([int]$OwnerProcessId = 0)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class VideoVisibility {
 [DllImport("user32.dll")] private static extern bool EnumWindows(EnumProc callback,IntPtr parameter);
 private delegate bool EnumProc(IntPtr hwnd,IntPtr parameter);
 [DllImport("user32.dll")] private static extern bool IsWindowVisible(IntPtr hwnd);
 [DllImport("user32.dll")] private static extern uint GetWindowThreadProcessId(IntPtr hwnd,out uint processId);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] private static extern int GetWindowText(IntPtr hwnd,System.Text.StringBuilder title,int count);
 public static IntPtr[] BrowserWindows(int[] processIds) {
  var ids=new System.Collections.Generic.HashSet<int>(processIds);var result=new System.Collections.Generic.List<IntPtr>();
  EnumWindows((hwnd,arg)=>{uint id;GetWindowThreadProcessId(hwnd,out id);if(!ids.Contains((int)id)||!IsWindowVisible(hwnd))return true;
   var text=new System.Text.StringBuilder(2048);GetWindowText(hwnd,text,text.Capacity);var title=text.ToString();
   if(title.IndexOf("YouTube",StringComparison.OrdinalIgnoreCase)>=0||title.IndexOf("Instagram",StringComparison.OrdinalIgnoreCase)>=0)result.Add(hwnd);return true;},IntPtr.Zero);return result.ToArray();
 }
 public static string Title(IntPtr hwnd){var text=new System.Text.StringBuilder(2048);GetWindowText(hwnd,text,text.Capacity);return text.ToString();}
 public static int ProcessId(IntPtr hwnd){uint id;GetWindowThreadProcessId(hwnd,out id);return (int)id;}
 [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
 [StructLayout(LayoutKind.Sequential)] public struct Point { public int X,Y; }
 [DllImport("user32.dll")] public static extern IntPtr WindowFromPoint(Point p);
 [DllImport("user32.dll")] public static extern IntPtr GetAncestor(IntPtr h,uint flags);
}
'@
[void][VideoVisibility]::SetProcessDPIAware()
$playerNames = @('YouTube 동영상 플레이어 전체화면 모드','YouTube video player full screen','YouTube video player fullscreen','YouTube 동영상 플레이어','YouTube video player','Instagram video player','Instagram 동영상 플레이어')
$scope = [System.Windows.Automation.TreeScope]::Descendants
while ($true) {
    try {
        $browserIds = [int[]]@(Get-Process msedge,chrome -ErrorAction SilentlyContinue | ForEach-Object { $_.Id })
        $browsers = @([VideoVisibility]::BrowserWindows($browserIds) | ForEach-Object { [pscustomobject]@{MainWindowHandle=$_;MainWindowTitle=[VideoVisibility]::Title($_)} })
        $found = $null
        $coveredFallback = $null
        foreach ($browser in $browsers) {
            $root = [System.Windows.Automation.AutomationElement]::FromHandle($browser.MainWindowHandle)
            foreach ($name in $playerNames) {
                $condition = New-Object System.Windows.Automation.PropertyCondition ([System.Windows.Automation.AutomationElement]::NameProperty), $name
                $player = $root.FindFirst($scope,$condition)
                if (-not $player) { continue }
                $bounds = $player.Current.BoundingRectangle
                if ($player.Current.IsOffscreen -or $bounds.Width -lt 100 -or $bounds.Height -lt 100) { continue }
                $windowRect = $root.Current.BoundingRectangle
                $left = [Math]::Max($bounds.X,$windowRect.X)
                $topEdge = [Math]::Max($bounds.Y,$windowRect.Y)
                $right = [Math]::Min($bounds.Right,$windowRect.Right)
                $bottom = [Math]::Min($bounds.Bottom,$windowRect.Bottom)
                $rect = New-Object System.Windows.Rect $left,$topEdge,($right-$left),($bottom-$topEdge)
                if ($rect.Width -lt 100 -or $rect.Height -lt 100) { continue }

                # Check only a small grid, comparing native window handles directly.
                # The previous implementation walked every UIA button/slider and
                # called Get-Process for 49 points on every pass; that could stall
                # detection long enough for capture to fall back to the desktop.
                $covered = 0
                foreach ($fx in @(0.08,0.5,0.92)) { foreach ($fy in @(0.08,0.5,0.92)) {
                    $point = New-Object VideoVisibility+Point
                    $point.X = [int]($rect.X+$rect.Width*$fx); $point.Y = [int]($rect.Y+$rect.Height*$fy)
                    $top = [VideoVisibility]::GetAncestor([VideoVisibility]::WindowFromPoint($point),2)
                    # Our own overlay is separately blacked out by scene-capture.
                    # Unrelated applications must still block capture.
                    $ownOverlay = $OwnerProcessId -gt 0 -and [VideoVisibility]::ProcessId($top) -eq $OwnerProcessId
                    if ($top -ne $browser.MainWindowHandle -and -not $ownOverlay) { $covered++ }
                } }

                $title = $browser.MainWindowTitle -replace '\s+- YouTube.*$','' -replace '\s+- Instagram.*$',''
                $url = ''
                foreach ($addressName in @('주소 표시줄 및 검색 창','Address and search bar')) {
                    try {
                        $addressCondition = New-Object System.Windows.Automation.PropertyCondition ([System.Windows.Automation.AutomationElement]::NameProperty), $addressName
                        $edit = $root.FindFirst($scope,$addressCondition)
                        if ($edit) { $url = $edit.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern).Current.Value; break }
                    } catch {}
                }
                $candidate = @{available=$true;occluded=($covered -gt 0);rect=@{x=$rect.X;y=$rect.Y;width=$rect.Width;height=$rect.Height};title=$title;key=($url+'|'+$title)}
                if ($covered -eq 0) { $found = $candidate }
                elseif (-not $coveredFallback) { $coveredFallback = $candidate }
                break
            }
            if ($found) { break }
        }
        if (-not $found) { $found = $coveredFallback }
        if ($found) { $found | ConvertTo-Json -Compress -Depth 4 }
        else { '{"available":false}' }
    } catch { '{"available":false}' }
    Start-Sleep -Milliseconds 750
}
