$ErrorActionPreference='Stop'
$project = Split-Path -Parent $PSScriptRoot
$desktop = Join-Path $project 'cleantouch-desktop'
$repository = Split-Path -Parent $project
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class ChatReviewWindow {
 [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr hwnd, IntPtr after, int x, int y, int w, int h, uint flags);
 [DllImport("user32.dll")] public static extern IntPtr GetWindowLongPtr(IntPtr hwnd, int index);
}
'@
$videoWindow=[IntPtr]3803118
$wasPinned=([ChatReviewWindow]::GetWindowLongPtr($videoWindow,-20).ToInt64() -band 8) -ne 0
[ChatReviewWindow]::SetWindowPos($videoWindow,[IntPtr](-1),0,0,0,0,3) | Out-Null
try {
 $env:CLEANTOUCH_PREVIEW_PROFILE=Join-Path $repository '.local\chat-source-review-0.1.37'
 $previewProcess=Start-Process -FilePath (Join-Path $desktop 'node_modules\electron\dist\electron.exe') -ArgumentList '--remote-debugging-port=9237',$desktop -WindowStyle Hidden -PassThru
 Start-Sleep -Seconds 3
 Push-Location $desktop
 try { node test/conversation-release.mjs; if($LASTEXITCODE -ne 0){throw 'Actual conversation review failed.'} } finally { Pop-Location }
} finally {if(!$wasPinned){[ChatReviewWindow]::SetWindowPos($videoWindow,[IntPtr](-2),0,0,0,0,3) | Out-Null}}
