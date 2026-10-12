$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
Add-Type -AssemblyName System.Runtime.WindowsRuntime
Add-Type @'
using System;
using System.Runtime.InteropServices;
using System.Text;
public class ActiveMediaWindow {
 [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
 [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern int GetWindowText(IntPtr window, StringBuilder text, int length);
 public static string Title() { var text = new StringBuilder(1024); GetWindowText(GetForegroundWindow(), text, text.Capacity); return text.ToString(); }
}
'@
$managerType = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType = WindowsRuntime]
$propertiesType = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties, Windows.Media.Control, ContentType = WindowsRuntime]
function Wait-WinRT($operation, [Type] $resultType) {
    $method = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.IsGenericMethodDefinition -and $_.GetGenericArguments().Count -eq 1 -and $_.GetParameters().Count -eq 1 } | Select-Object -First 1
    $task = $method.MakeGenericMethod($resultType).Invoke($null, @($operation))
    if (-not $task.Wait(1500)) { throw 'Media time request timed out' }
    return $task.Result
}
$manager = Wait-WinRT ($managerType::RequestAsync()) $managerType
$lastWindow = ''
while ($true) {
    try {
        $windowTitle = [ActiveMediaWindow]::Title()
        if ($windowTitle -notlike '*CleanTouch*' -and $windowTitle -match 'Edge|Chrome|YouTube|Instagram') { $lastWindow = $windowTitle }
        $session = $manager.GetCurrentSession()
        if ($session) {
            $properties = Wait-WinRT ($session.TryGetMediaPropertiesAsync()) $propertiesType
            $timeline = $session.GetTimelineProperties(); $playback = $session.GetPlaybackInfo()
            $title = $properties.Title
            $matches = $title.Length -ge 4 -and $lastWindow.IndexOf($title, [StringComparison]::OrdinalIgnoreCase) -ge 0
            $age = ([DateTimeOffset]::UtcNow - $timeline.LastUpdatedTime).TotalSeconds
            $status = $playback.PlaybackStatus.ToString()
            $seconds = $timeline.Position.TotalSeconds
            if ($status -eq 'Playing' -and $age -ge 0 -and $age -lt 2) { $seconds += $age }
            $valid = $timeline.EndTime.TotalSeconds -gt 0 -and ($status -eq 'Paused' -or ($age -ge 0 -and $age -lt 2))
            @{ available = ($matches -and $valid); timelineValid=$valid; seconds = $seconds; duration=($timeline.EndTime-$timeline.StartTime).TotalSeconds; title = $title; videoKey = $session.SourceAppUserModelId + ':' + $title; paused = ($status -eq 'Paused'); matched = $matches } | ConvertTo-Json -Compress
        } else { '{"available":false}' }
    } catch { '{"available":false}' }
    Start-Sleep -Milliseconds 500
}
