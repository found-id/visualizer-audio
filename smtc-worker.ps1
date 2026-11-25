[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType = WindowsRuntime] | Out-Null
[Windows.Storage.Streams.IRandomAccessStreamWithContentType, Windows.Storage.Streams, ContentType = WindowsRuntime] | Out-Null
[Windows.Storage.Streams.IInputStream, Windows.Storage.Streams, ContentType = WindowsRuntime] | Out-Null
Add-Type -AssemblyName System.Runtime.WindowsRuntime
Add-Type -AssemblyName System.Drawing

$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -like 'IAsyncOperation*'
})[0]

$asStreamMethod = ([System.IO.WindowsRuntimeStreamExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsStreamForRead' -and $_.GetParameters().Count -eq 1
})[0]

function Await($WinRtTask, $ResultType) {
    $asTask = $asTaskGeneric.MakeGenericMethod($ResultType)
    $netTask = $asTask.Invoke($null, @($WinRtTask))
    $netTask.Wait(2000) | Out-Null
    if ($netTask.IsCompleted) { return $netTask.Result }
    return $null
}

$mgr = Await ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])
$lastTrackKey = ""
$lastAppId = ""
$preferredScope = "music"
$cachedCover = ""
$coverHash = ""
$coverRefreshUntil = [DateTimeOffset]::MinValue
$coverVersion = 0
$tickCount = 0
$emptyTitleStreak = 0

$cmdQueue = [System.Collections.Concurrent.ConcurrentQueue[string]]::new()
$stdinAction = {
    param($q)
    while ($true) {
        $line = [Console]::In.ReadLine()
        if ($null -eq $line) { break }
        if ($line.Trim().Length -gt 0) {
            $q.Enqueue($line.Trim())
        }
    }
}
$ps = [PowerShell]::Create().AddScript($stdinAction).AddArgument($cmdQueue)
$asyncStdin = $ps.BeginInvoke()

function Get-FriendlyAppLabel {
    param([string]$appId)
    if ([string]::IsNullOrWhiteSpace($appId)) { return "Unknown App" }
    $low = $appId.ToLowerInvariant()
    if ($low -match "spotify") { return "Spotify" }
    if ($low -match "youtubemusic|youtube music") { return "YouTube Music" }
    if ($low -match "applemusic|apple\.music") { return "Apple Music" }
    if ($low -match "tidal") { return "TIDAL" }
    if ($low -match "brave") { return "Brave" }
    if ($low -match "chrome") { return "Chrome" }
    if ($low -match "msedge") { return "Edge" }
    if ($low -match "firefox") { return "Firefox" }
    if ($low -match "vlc") { return "VLC" }
    if ($low -match "foobar") { return "foobar2000" }
    if ($low -match "aimp") { return "AIMP" }
    if ($low -match "musicbee") { return "MusicBee" }
    $clean = ($appId -split '!' | Select-Object -First 1)
    return [System.IO.Path]::GetFileNameWithoutExtension($clean)
}

function Score-MediaSession {
    param($pb, $props, $tl, [string]$appId, [string]$scope, [string]$stickyApp)
    $low = if ($appId) { $appId.ToLowerInvariant() } else { "" }
    $statusStr = if ($pb -and $pb.PlaybackStatus) { $pb.PlaybackStatus.ToString() } else { "Stopped" }
    $titleStr = if ($props -and $props.Title) { $props.Title } else { "" }
    $artistStr = if ($props -and $props.Artist) { $props.Artist } else { "" }
    $durSec = 0.0
    if ($tl) {
        $durSec = [Math]::Max(0.0, $tl.EndTime.TotalSeconds - $tl.StartTime.TotalSeconds)
    }

    if ($scope -ne "music" -and $scope -ne "auto") {
        if ($low -eq $scope.ToLowerInvariant() -or $low.Contains($scope.ToLowerInvariant())) {
            $s = 1000
            if ($statusStr -eq "Playing") { $s += 50 }
            if ($titleStr.Length -gt 0) { $s += 20 }
            return $s
        }
        return -9999
    }

    $score = 0
    if ($statusStr -eq "Playing") { $score += 35 }
    elseif ($statusStr -eq "Paused") { $score += 5 }
    else { $score -= 20 }

    if ($titleStr.Length -eq 0) { $score -= 100 }
    if ($appId -eq $stickyApp -and $statusStr -eq "Playing") { $score += 15 }

    if ($scope -eq "music") {
        $isMusicPlayer = $low -match "spotify|youtubemusic|youtube music|applemusic|apple\.music|itunes|tidal|foobar|aimp|musicbee|deezer|soundcloud|amazonmusic|vlc|potplayer|winamp|groove|zunemusic"
        $isBrowser = $low -match "brave|chrome|msedge|firefox|opera|vivaldi"
        if ($isMusicPlayer) {
            $score += 120
        } elseif ($isBrowser) {
            if (($durSec -ge 45.0) -or ($durSec -eq 0 -and $artistStr.Length -gt 0)) {
                $score += 45
            } elseif ($durSec -gt 0 -and $durSec -lt 25.0) {
                $score -= 50
            } else {
                $score += 15
            }
        } else {
            if ($durSec -gt 0 -and $durSec -lt 30.0) { $score -= 80 }
            elseif ($artistStr.Length -gt 0 -and $durSec -ge 45.0) { $score += 10 }
            else { $score -= 25 }
        }
    } else {
        if ($durSec -gt 0 -and $durSec -lt 15.0) { $score -= 40 }
    }

    return $score
}

while ($true) {
    try {
        $pendingCmds = @()
        $cmd = $null
        while ($cmdQueue.TryDequeue([ref]$cmd)) {
            if ($cmd.StartsWith("scope:")) {
                $newScope = $cmd.Substring(6).Trim()
                if ($newScope.Length -gt 0) { $preferredScope = $newScope }
            } else {
                $pendingCmds += $cmd
            }
        }

        $allSessions = $mgr.GetSessions()
        $session = $null
        $bestScore = -9000
        $sessionsList = @()

        if ($allSessions -and $allSessions.Count -gt 0) {
            foreach ($s in $allSessions) {
                $sAppId = if ($s.SourceAppUserModelId) { $s.SourceAppUserModelId } else { "" }
                $sPb = $s.GetPlaybackInfo()
                $sTl = $s.GetTimelineProperties()
                $sProps = Await ($s.TryGetMediaPropertiesAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties])
                $sStatus = if ($sPb -and $sPb.PlaybackStatus) { $sPb.PlaybackStatus.ToString() } else { "Stopped" }
                $sTitle = if ($sProps -and $sProps.Title) { $sProps.Title } else { "" }

                $sessionsList += @{
                    appId = $sAppId
                    label = Get-FriendlyAppLabel $sAppId
                    title = $sTitle
                    status = $sStatus
                }

                $sc = Score-MediaSession -pb $sPb -props $sProps -tl $sTl -appId $sAppId -scope $preferredScope -stickyApp $lastAppId
                if ($sc -gt $bestScore) {
                    $bestScore = $sc
                    $session = $s
                }
            }
        }

        if ($null -eq $session -and ($preferredScope -eq "music" -or $preferredScope -eq "auto")) {
            $session = $mgr.GetCurrentSession()
        }
        if ($null -ne $session -and $session.SourceAppUserModelId) {
            $lastAppId = $session.SourceAppUserModelId
        }

        $forceRefresh = $false
        foreach ($cmd in $pendingCmds) {
            if ($null -ne $session) {
                if ($cmd -eq "playpause") {
                    Await ($session.TryTogglePlayPauseAsync()) ([bool]) | Out-Null
                } elseif ($cmd -eq "play") {
                    Await ($session.TryPlayAsync()) ([bool]) | Out-Null
                } elseif ($cmd -eq "pause") {
                    Await ($session.TryPauseAsync()) ([bool]) | Out-Null
                } elseif ($cmd -eq "next") {
                    Await ($session.TrySkipNextAsync()) ([bool]) | Out-Null
                    $coverRefreshUntil = [DateTimeOffset]::UtcNow.AddSeconds(4)
                } elseif ($cmd -eq "prev") {
                    Await ($session.TrySkipPreviousAsync()) ([bool]) | Out-Null
                    $coverRefreshUntil = [DateTimeOffset]::UtcNow.AddSeconds(4)
                } elseif ($cmd -eq "refresh") {
                    $forceRefresh = $true
                    $coverRefreshUntil = [DateTimeOffset]::UtcNow.AddSeconds(3)
                } elseif ($cmd.StartsWith("seek:")) {
                    $sec = [double]::Parse($cmd.Substring(5), [System.Globalization.CultureInfo]::InvariantCulture)
                    $ticks = [int64]($sec * 10000000.0)
                    Await ($session.TryChangePlaybackPositionAsync($ticks)) ([bool]) | Out-Null
                }
            }
        }

        if ($null -ne $session) {
            $props = Await ($session.TryGetMediaPropertiesAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties])
            $tl = $session.GetTimelineProperties()
            $pb = $session.GetPlaybackInfo()

            $title = if ($props -and $props.Title) { $props.Title } else { "" }
            $artist = if ($props -and $props.Artist) { $props.Artist } else { "" }
            $album = if ($props -and $props.AlbumTitle) { $props.AlbumTitle } else { "" }
            $appId = if ($session.SourceAppUserModelId) { $session.SourceAppUserModelId } else { "" }
            $status = if ($pb -and $pb.PlaybackStatus) { $pb.PlaybackStatus.ToString() } else { "Stopped" }

            $pos = 0.0
            $dur = 0.0
            if ($tl) {
                $startSec = $tl.StartTime.TotalSeconds
                $pos = [Math]::Max(0.0, $tl.Position.TotalSeconds - $startSec)
                $dur = [Math]::Max(0.0, $tl.EndTime.TotalSeconds - $startSec)
                if ($status -eq "Playing" -and $tl.LastUpdatedTime -and $tl.LastUpdatedTime.Year -gt 2000) {
                    $elapsed = ([DateTimeOffset]::UtcNow - $tl.LastUpdatedTime).TotalSeconds
                    if ($elapsed -gt 0 -and $elapsed -lt 3600) {
                        $pos = if ($dur -gt 0) { [Math]::Min($dur, $pos + $elapsed) } else { $pos + $elapsed }
                    }
                }
            }

            if ($title.Length -eq 0 -and $lastTrackKey.Length -gt 0 -and $emptyTitleStreak -lt 4) {
                $emptyTitleStreak++
                Start-Sleep -Milliseconds 140
                continue
            }
            $emptyTitleStreak = 0

            $trackKey = "$title|$artist"
            $now = [DateTimeOffset]::UtcNow
            $tickCount++

            if ($trackKey -ne $lastTrackKey -and $title.Length -gt 0) {
                $lastTrackKey = $trackKey
                $cachedCover = ""
                $coverHash = ""
                $coverVersion++
                $coverRefreshUntil = $now.AddSeconds(3.5)
                $forceRefresh = $true
            }

            $coverChangedNow = $false
            # Re-read thumbnail right on track change, during the 3.5s settle window (for Brave/Spotify delayed thumbnails), or every ~2s
            $shouldCheckCover = $forceRefresh -or ($now -lt $coverRefreshUntil) -or (($tickCount % 14) -eq 0)
            if ($shouldCheckCover -and $props -and $props.Thumbnail) {
                try {
                    $winStream = Await ($props.Thumbnail.OpenReadAsync()) ([Windows.Storage.Streams.IRandomAccessStreamWithContentType])
                    if ($winStream) {
                        $netStream = $asStreamMethod.Invoke($null, @($winStream))
                        $ms = New-Object System.IO.MemoryStream
                        $netStream.CopyTo($ms)
                        $bytes = $ms.ToArray()
                        if ($bytes.Length -gt 0) {
                            $sha = [System.Security.Cryptography.SHA256]::Create()
                            $hashBytes = $sha.ComputeHash($bytes)
                            $newHash = [BitConverter]::ToString($hashBytes)
                            $sha.Dispose()
                            if ($newHash -ne $coverHash) {
                                $coverHash = $newHash
                                $mime = if ($winStream.ContentType) { $winStream.ContentType } else { "image/jpeg" }
                                $b64 = [Convert]::ToBase64String($bytes)
                                $cachedCover = "data:$mime;base64,$b64"
                                $coverVersion++
                                $coverChangedNow = $true

                                # Decode and downscale to 96x96 raw RGBA for the Rust Game Overlay
                                try {
                                    $ms.Position = 0
                                    $srcBmp = [System.Drawing.Bitmap]::FromStream($ms)
                                    $dstBmp = New-Object System.Drawing.Bitmap(96, 96, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
                                    $g = [System.Drawing.Graphics]::FromImage($dstBmp)
                                    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
                                    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
                                    $cropSize = [Math]::Min($srcBmp.Width, $srcBmp.Height)
                                    $cropX = [int](($srcBmp.Width - $cropSize) / 2)
                                    $cropY = [int](($srcBmp.Height - $cropSize) / 2)
                                    $srcRect = New-Object System.Drawing.Rectangle($cropX, $cropY, $cropSize, $cropSize)
                                    $dstRect = New-Object System.Drawing.Rectangle(0, 0, 96, 96)
                                    $g.DrawImage($srcBmp, $dstRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
                                    $g.Dispose()
                                    $rect = New-Object System.Drawing.Rectangle(0, 0, 96, 96)
                                    $bmpData = $dstBmp.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadOnly, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
                                    $strideLen = 96 * 96 * 4
                                    $bgra = New-Object byte[] $strideLen
                                    [System.Runtime.InteropServices.Marshal]::Copy($bmpData.Scan0, $bgra, 0, $strideLen)
                                    $dstBmp.UnlockBits($bmpData)
                                    $dstBmp.Dispose()
                                    $srcBmp.Dispose()
                                    # Convert BGRA -> RGBA in-place
                                    for ($pi = 0; $pi -lt $strideLen; $pi += 4) {
                                        $tmp = $bgra[$pi]
                                        $bgra[$pi] = $bgra[$pi + 2]
                                        $bgra[$pi + 2] = $tmp
                                    }
                                    $rgbaPath = Join-Path $PSScriptRoot ".overlay-cover.rgba"
                                    [System.IO.File]::WriteAllBytes($rgbaPath, $bgra)
                                } catch {}
                            }
                        }
                        $ms.Dispose()
                        $netStream.Dispose()
                        $winStream.Dispose()
                    }
                } catch {}
            }

            $outObj = @{
                active = $true
                title = $title
                artist = $artist
                album = $album
                sourceApp = $appId
                status = $status
                position = [Math]::Round($pos, 2)
                duration = [Math]::Round($dur, 2)
                trackKey = $trackKey
                coverVersion = $coverVersion
                cover = if ($coverChangedNow) { $cachedCover } else { "" }
                hasCover = ($cachedCover.Length -gt 0)
                scope = $preferredScope
                sessions = $sessionsList
            }
            $json = $outObj | ConvertTo-Json -Compress -Depth 4
            [Console]::WriteLine("SMTC_JSON:$json")
        } else {
            $noSessObj = @{
                active = $false
                scope = $preferredScope
                sessions = $sessionsList
            }
            $json = $noSessObj | ConvertTo-Json -Compress -Depth 4
            [Console]::WriteLine("SMTC_JSON:$json")
        }
    } catch {
        [Console]::WriteLine('SMTC_JSON:{"active":false}')
    }
    Start-Sleep -Milliseconds 150
}
