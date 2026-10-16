$ErrorActionPreference='Stop'
$planPath = Join-Path $PSScriptRoot 'CleanTouch_기획서_20261006.pptx'
$planPdf = Join-Path $PSScriptRoot 'CleanTouch_기획서_20261006.pdf'
$planRender = Join-Path $PSScriptRoot 'rendered-plan-20261006'
New-Item -ItemType Directory -Path $planRender -Force | Out-Null
$planPowerPoint = New-Object -ComObject PowerPoint.Application
$planPresentation = $null
try {
  $planPresentation = $planPowerPoint.Presentations.Open($planPath,-1,0,0)
  $planPresentation.SaveAs($planPdf,32)
  foreach ($planSlide in $planPresentation.Slides) {
    $planSlide.Export((Join-Path $planRender ('slide-{0:D2}.png' -f $planSlide.SlideIndex)),'PNG',1600,900)
  }
  Write-Output ('Slides: '+$planPresentation.Slides.Count)
  Write-Output $planPdf
} finally {
  if ($planPresentation) { $planPresentation.Close() }
  [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($planPowerPoint)
}
Add-Type -AssemblyName System.Drawing
$planContact = New-Object System.Drawing.Bitmap 1280,1080
$planG = [System.Drawing.Graphics]::FromImage($planContact)
$planG.Clear([System.Drawing.Color]::FromArgb(220,226,232))
$planImages = Get-ChildItem -LiteralPath $planRender -Filter '*.png' | Sort-Object Name
for($i=0;$i -lt $planImages.Count;$i++) {
 $planPic=[System.Drawing.Image]::FromFile($planImages[$i].FullName)
 $planG.DrawImage($planPic,([int]($i%3)*426),([int][Math]::Floor($i/3)*270),420,236)
 $planPic.Dispose()
}
$planContact.Save((Join-Path $PSScriptRoot 'CleanTouch_기획서_미리보기_20261006.png'),[System.Drawing.Imaging.ImageFormat]::Png)
$planG.Dispose();$planContact.Dispose()
