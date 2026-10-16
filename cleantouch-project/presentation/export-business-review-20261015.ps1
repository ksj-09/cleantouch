$ErrorActionPreference='Stop'
$reviewStem='CleanTouch_사업화_현황진단_및_확장전략_20261015'
$reviewInput=Join-Path $PSScriptRoot ($reviewStem+'.pptx')
$reviewPdf=Join-Path $PSScriptRoot ($reviewStem+'.pdf')
$reviewRender=Join-Path $PSScriptRoot 'review-business-20261015'
New-Item -ItemType Directory -Path $reviewRender -Force | Out-Null
$reviewApp=New-Object -ComObject PowerPoint.Application
$reviewPresentation=$null
$reviewIssues=New-Object System.Collections.Generic.List[object]
try {
 $reviewPresentation=$reviewApp.Presentations.Open($reviewInput,-1,0,0)
 foreach($reviewSlide in $reviewPresentation.Slides){
  foreach($reviewShape in $reviewSlide.Shapes){
   if($reviewShape.HasTextFrame -eq -1 -and $reviewShape.TextFrame.HasText -eq -1){
    $reviewFrame=$reviewShape.TextFrame2
    $reviewHeight=$reviewFrame.TextRange.BoundHeight
    $reviewAvailable=$reviewShape.Height-$reviewFrame.MarginTop-$reviewFrame.MarginBottom
    if($reviewHeight -gt $reviewAvailable+4){$reviewIssues.Add([pscustomobject]@{slide=$reviewSlide.SlideIndex;shape=$reviewShape.Name;needed=$reviewHeight;available=$reviewAvailable;text=$reviewFrame.TextRange.Text.Substring(0,[Math]::Min(65,$reviewFrame.TextRange.Text.Length))})}
   }
  }
  $reviewSlide.Export((Join-Path $reviewRender ('slide-{0:D2}.png' -f $reviewSlide.SlideIndex)),'PNG',1600,900)
 }
 $reviewPresentation.SaveAs($reviewPdf,32)
 [pscustomobject]@{slides=$reviewPresentation.Slides.Count;pdf=$reviewPdf;textOverflow=@($reviewIssues.ToArray())}|ConvertTo-Json -Depth 4
}finally{
 if($reviewPresentation){$reviewPresentation.Close();[void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($reviewPresentation)}
 [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($reviewApp)
}
