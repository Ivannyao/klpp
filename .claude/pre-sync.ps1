# Runs once at Claude Code session start.
# Pulls latest changes from origin/main so Claude sees what other agents (Antigravity, friend)
# committed in the meantime. Uses --rebase --autostash to safely interleave with any
# uncommitted local edits.
#
# Errors are silent — if there's no network, no remote, or a real conflict, just continue.
# The user will see the conflict markers in the working tree when they look at files.

$ErrorActionPreference = 'SilentlyContinue'
Set-Location -LiteralPath 'C:\IIG\klpp'

# Make sure we have a remote/branch
$branch = git rev-parse --abbrev-ref HEAD 2>$null
if (-not $branch -or $branch -eq 'HEAD') { exit 0 }

# Fetch silently
git fetch origin --quiet 2>$null | Out-Null

# Are we behind / diverged?
$status = git status --porcelain=v2 --branch 2>$null | Select-String '^# branch.ab'
$behind = 0
if ($status) {
  # Line format: "# branch.ab +<ahead> -<behind>"
  if ($status -match '\-(\d+)$') { $behind = [int]$matches[1] }
}

if ($behind -eq 0) { exit 0 }

# Pull with rebase + autostash so uncommitted edits don't block
git pull origin $branch --rebase --autostash --quiet 2>$null | Out-Null

# If rebase ended up in conflict, abort it so the working tree stays usable.
# The user will see we're still behind on the next sync attempt.
if (Test-Path '.git\rebase-merge' -or Test-Path '.git\rebase-apply') {
  git rebase --abort 2>$null | Out-Null
}

exit 0
