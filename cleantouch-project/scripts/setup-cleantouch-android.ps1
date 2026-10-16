$ErrorActionPreference = 'Stop'

$workspace = Split-Path -Parent $PSScriptRoot
$toolchain = Join-Path $workspace '.local\android-toolchain'
$jdkArchive = Join-Path $toolchain 'jdk17.zip'
$jdkRoot = Join-Path $toolchain 'jdk'
$sdkRoot = Join-Path $toolchain 'sdk'
$commandToolsArchive = Join-Path $toolchain 'cmdline-tools.zip'
$commandToolsLatest = Join-Path $sdkRoot 'cmdline-tools\latest'
$commandToolsUrl = 'https://dl.google.com/android/repository/commandlinetools-win-15859902_latest.zip'
$commandToolsSha256 = '90ae805d20434428bffcb699c290860f19bb5f66a67e6b330067e3de801fb04a'

New-Item -ItemType Directory -Force -Path $toolchain | Out-Null

if (-not (Test-Path -LiteralPath $jdkRoot)) {
    Write-Host 'JDK 17을 내려받습니다.'
    curl.exe -L --fail 'https://api.adoptium.net/v3/binary/latest/17/ga/windows/x64/jdk/hotspot/normal/eclipse' -o $jdkArchive
    Expand-Archive -LiteralPath $jdkArchive -DestinationPath $jdkRoot
}

if (-not (Test-Path -LiteralPath $commandToolsLatest)) {
    Write-Host 'Android 명령줄 도구를 내려받습니다.'
    curl.exe -L --fail $commandToolsUrl -o $commandToolsArchive
    $actualHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $commandToolsArchive).Hash.ToLowerInvariant()
    if ($actualHash -ne $commandToolsSha256) {
        throw "Android 명령줄 도구의 SHA-256이 일치하지 않습니다: $actualHash"
    }
    $extracted = Join-Path $toolchain 'cmdline-tools-extracted'
    Expand-Archive -LiteralPath $commandToolsArchive -DestinationPath $extracted
    New-Item -ItemType Directory -Force -Path $commandToolsLatest | Out-Null
    Copy-Item -Recurse -Force (Join-Path $extracted 'cmdline-tools\*') $commandToolsLatest
}

$jdk = Get-ChildItem -LiteralPath $jdkRoot -Directory | Select-Object -First 1
if (-not $jdk) { throw 'JDK 압축 해제 폴더를 찾지 못했습니다.' }

$env:JAVA_HOME = $jdk.FullName
$env:ANDROID_HOME = $sdkRoot
$userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
$javaPathToken = '%JAVA_HOME%\bin'
[Environment]::SetEnvironmentVariable('JAVA_HOME', $jdk.FullName, 'User')
if (($userPath -split ';') -notcontains $javaPathToken) {
    $updatedUserPath = if ([string]::IsNullOrWhiteSpace($userPath)) { $javaPathToken } else { "$javaPathToken;$userPath" }
    [Environment]::SetEnvironmentVariable('Path', $updatedUserPath, 'User')
}
$sdkManager = Join-Path $commandToolsLatest 'bin\sdkmanager.bat'

Write-Host ''
Write-Host '이제 Google Android SDK 라이선스가 표시됩니다.'
Write-Host '내용을 읽고 동의하는 경우에만 y를 입력하세요.'
& $sdkManager --sdk_root=$sdkRoot 'platforms;android-36' 'build-tools;35.0.0' 'platform-tools'

$localProperties = Join-Path $workspace 'cleantouch-android\local.properties'
# Forward slashes avoid Windows property escaping problems in Android lint.
$propertyPath = $sdkRoot.Replace('\', '/').Replace(':', '\:')
"sdk.dir=$propertyPath" | Set-Content -Encoding ascii -NoNewline -LiteralPath $localProperties

Push-Location (Join-Path $workspace 'cleantouch-android')
try {
    .\gradlew.bat assembleDebug --no-daemon
} finally {
    Pop-Location
}

Write-Host ''
Write-Host 'APK 생성 위치: cleantouch-android\app\build\outputs\apk\debug\app-debug.apk'
