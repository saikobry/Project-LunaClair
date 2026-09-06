param(
    [string]$SessionId
)

if (-not $SessionId) {
    # Resolve the latest active Freebuff session automatically from agentsview
    try {
        $raw = agentsview session list --limit 10 --json 2>$null
        $json = $raw | ConvertFrom-Json
        $freebuffSession = $json.sessions | Where-Object { $_.agent -eq 'freebuff' -or $_.id -like 'freebuff:*' } | Select-Object -First 1
        if ($freebuffSession) {
            $SessionId = $freebuffSession.id
        }
    } catch {
        # Fallback to human parsing if JSON conversion fails
        $lines = agentsview session list --limit 10 2>$null
        $match = $lines | Select-String "freebuff:[^\s]+" | Select-Object -First 1
        if ($match) {
            $SessionId = $match.Matches[0].Value
        }
    }
}

if (-not $SessionId) {
    Write-Error "Could not resolve a Freebuff session ID from agentsview."
    exit 1
}

# Fetch the single final assistant report (summary only, no bloated traces)
agentsview session messages $SessionId --role assistant --direction desc --limit 1
