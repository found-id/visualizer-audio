[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType = WindowsRuntime] | Out-Null
[Windows.Storage.Streams.IRandomAccessStreamWithContentType, Windows.Storage.Streams, ContentType = WindowsRuntime] | Out-Null
[Windows.Storage.Streams.IInputStream, Windows.Storage.Streams, ContentType = WindowsRuntime] | Out-Null
Add-Type -AssemblyName System.Runtime.WindowsRuntime

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
$cachedCover = ""
$coverHash = ""
$coverRefreshUntil = [DateTimeOffset]::MinValue
$coverVersion = 0
$tickCount = 0

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

while ($true) {
    try {
        $session = $mgr.GetCurrentSession()
        $cmd = $null
        $forceRefresh = $false
        while ($cmdQueue.TryDequeue([ref]$cmd)) {
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
                $pos = $tl.Position.TotalSeconds
                $dur = $tl.EndTime.TotalSeconds
                if ($status -eq "Playing" -and $tl.LastUpdatedTime -and $tl.LastUpdatedTime.Year -gt 2000) {
                    $elapsed = ([DateTimeOffset]::UtcNow - $tl.LastUpdatedTime).TotalSeconds
                    if ($elapsed -gt 0 -and $elapsed -lt 3600) {
                        $pos = [Math]::Min($dur, $pos + $elapsed)
                    }
                }
            }

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
                cover = $cachedCover
            }
            $json = $outObj | ConvertTo-Json -Compress
            [Console]::WriteLine("SMTC_JSON:$json")
        } else {
            [Console]::WriteLine('SMTC_JSON:{"active":false}')
        }
    } catch {
        [Console]::WriteLine('SMTC_JSON:{"active":false}')
    }
    Start-Sleep -Milliseconds 150
}
