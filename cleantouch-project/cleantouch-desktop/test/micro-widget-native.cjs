const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { app, BrowserWindow, screen } = require('electron');
const { MICRO_SIZE } = require('../micro-widget-layout.cjs');
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'cleantouch-micro-native-'));
process.env.CLEANTOUCH_PREVIEW_PROFILE = profile;
// Electron normally treats this test's directory as its application root.
app.getAppPath = () => path.resolve(__dirname, '..');
require('../main.cjs');

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function waitFor(get) {
  for (let i = 0; i < 200; i++) { const value = get(); if (value) return value; await delay(25); }
  throw new Error('Timed out waiting for the test window.');
}
const nativeProbe = path.join(profile, 'probe.ps1');
fs.writeFileSync(nativeProbe, `param([long]$Handle)
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class MicroProbe {
 [DllImport("user32.dll")] public static extern IntPtr SetThreadDpiAwarenessContext(IntPtr context);
 [StructLayout(LayoutKind.Sequential)] public struct Rect { public int Left,Top,Right,Bottom; }
 [StructLayout(LayoutKind.Sequential)] public struct Point { public int X,Y; public Point(int x,int y) { X=x; Y=y; } }
 [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h,out Rect r);
 [DllImport("user32.dll")] public static extern int GetWindowRgn(IntPtr h,IntPtr r);
 [DllImport("user32.dll")] public static extern IntPtr WindowFromPoint(Point p);
 [DllImport("gdi32.dll")] public static extern IntPtr CreateRectRgn(int l,int t,int r,int b);
 [DllImport("gdi32.dll")] public static extern bool PtInRegion(IntPtr r,int x,int y);
 [DllImport("gdi32.dll")] public static extern bool DeleteObject(IntPtr r);
}
'@
[void][MicroProbe]::SetThreadDpiAwarenessContext([IntPtr]::new(-4))
$rect = New-Object MicroProbe+Rect
[void][MicroProbe]::GetWindowRect([IntPtr]$Handle,[ref]$rect)
$region = [MicroProbe]::CreateRectRgn(0,0,0,0)
$kind = [MicroProbe]::GetWindowRgn([IntPtr]$Handle,$region)
$inside = [MicroProbe]::PtInRegion($region,($rect.Right-$rect.Left)/2,($rect.Bottom-$rect.Top)/2)
$outside = [MicroProbe]::PtInRegion($region,$rect.Right-$rect.Left-1,$rect.Bottom-$rect.Top-1)
$hit = [MicroProbe]::WindowFromPoint([MicroProbe+Point]::new($rect.Right-1,$rect.Bottom-1)).ToInt64()
[void][MicroProbe]::DeleteObject($region)
@{ width=$rect.Right-$rect.Left; height=$rect.Bottom-$rect.Top; hasRegion=$kind -ne 0; inside=$inside; outside=$outside; outsideHit=$hit; iconHandle=$Handle } | ConvertTo-Json -Compress
`, 'utf8');
function verifyNative(icon) {
  if (process.platform !== 'win32') return;
  const handle = icon.getNativeWindowHandle().readBigUInt64LE().toString();
  const result = JSON.parse(execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', nativeProbe, '-Handle', handle], { windowsHide: true, encoding: 'utf8' }));
  const scale = screen.getDisplayMatching(icon.getBounds()).scaleFactor;
  // Win32 includes its small invisible non-client margin, unlike Electron's bounds.
  assert.ok(result.width >= MICRO_SIZE * scale - 1 && result.width <= (MICRO_SIZE + 4) * scale + 1);
  assert.ok(result.height >= MICRO_SIZE * scale - 1 && result.height <= (MICRO_SIZE + 4) * scale + 1);
  assert.equal(result.hasRegion, true);
  assert.equal(result.inside, true);
  assert.equal(result.outside, false);
  assert.notEqual(result.outsideHit, result.iconHandle, 'Transparent margin must not intercept the underlying screen.');
  return result;
}

app.whenReady().then(async () => {
  try {
    const main = await waitFor(() => BrowserWindow.getAllWindows().find(w => w.getTitle() === 'CleanTouch'));
    await waitFor(() => !main.webContents.isLoading());
    await main.webContents.executeJavaScript("window.cleanTouch.setWindowLayout('widget')");
    await main.webContents.executeJavaScript("window.cleanTouch.setWindowLayout('micro')");
    let icon = await waitFor(() => BrowserWindow.getAllWindows().find(w => w !== main));
    await waitFor(() => !icon.webContents.isLoading() && icon.isVisible());
    const assertIconSize = () => assert.ok(icon.getSize().every(value => value >= MICRO_SIZE && value <= MICRO_SIZE + 2), 'Native icon must stay within its small DPI-rounded size.');
    assertIconSize();
    icon.setBounds({ x: 220, y: 0, width: 1700, height: 1020 });
    await delay(100);
    assertIconSize();

    const area = screen.getPrimaryDisplay().workArea;
    const [width, height] = icon.getSize();
    const corners = [
      { x: area.x, y: area.y },
      { x: area.x + area.width - width, y: area.y },
      { x: area.x + area.width - width, y: area.y + area.height - height },
      { x: area.x, y: area.y + area.height - height },
    ];
    for (const point of corners) {
      const actual = await icon.webContents.executeJavaScript(`window.cleanTouch.moveMicroWidget(${point.x},${point.y},${point.x + 25},${point.y + 25})`);
      assert.ok(Math.abs(actual.x - point.x) <= 2 && Math.abs(actual.y - point.y) <= 2);
      assertIconSize();
      const bounds = icon.getBounds();
      assert.ok(bounds.x + bounds.width <= area.x + area.width + 2 && bounds.y + bounds.height <= area.y + area.height + 2);
    }
    const native = verifyNative(icon);
    const anchor = icon.getBounds();
    // Restoring destroys the calling page, so its IPC promise cannot be awaited.
    void icon.webContents.executeJavaScript("window.cleanTouch.setWindowLayout('restore-micro')").catch(() => {});
    await waitFor(() => icon.isDestroyed() && main.isVisible());
    assert.equal(main.isVisible(), true);
    await main.webContents.executeJavaScript("window.cleanTouch.setWindowLayout('micro')");
    icon = await waitFor(() => BrowserWindow.getAllWindows().find(w => w !== main));
    await waitFor(() => !icon.webContents.isLoading() && icon.isVisible());
    assert.deepEqual(icon.getBounds(), anchor, 'Expand/fold must preserve the exact icon position.');
    verifyNative(icon);
    console.log(JSON.stringify({ fixedNativeSize: true, allFourEdges: true, transparentMarginPassesThrough: true, foldPositionPreserved: true, native }));
    app.quit();
  } catch (error) { console.error(error.stack); app.exit(1); }
});
