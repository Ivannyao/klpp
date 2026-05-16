# Runs after every Claude Code turn ends.
# If there are uncommitted changes in this repo, auto-commits + pushes them to origin/main.
# Errors are silently swallowed so a failing network/auth never breaks the Claude session.

$ErrorActionPreference = 'SilentlyContinue'
Set-Location -LiteralPath 'C:\IIG\klpp'

# Anything to commit?
$status = git status --porcelain 2>$null
if (-not $status) { exit 0 }

# Stage and commit using inline identity so the hook works regardless of global git config.
# Change these values once you set your global identity in GitHub Desktop or `git config --global`.
$gitEmail = 'temadengibitcoinfame@gmail.com'
$gitName  = 'tema'
$msg      = 'auto: claude session ' + (Get-Date -Format 'yyyy-MM-dd HH:mm:ss')

git add -A 2>$null | Out-Null
git -c "user.email=$gitEmail" -c "user.name=$gitName" commit -m $msg --quiet 2>$null | Out-Null

# Push best-effort. Failure (no network, no auth) is fine — next turn will retry.
git push origin main --quiet 2>$null | Out-Null

exit 0
