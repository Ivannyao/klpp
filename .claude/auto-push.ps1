# Runs after every Claude Code turn ends.
# 1. If local working tree has changes -> stage + commit them with auto identity.
# 2. Fetch + rebase onto origin/main so we don't race with concurrent work (Antigravity / friend).
# 3. Push. Errors are silently swallowed so a failing network/auth never breaks the Claude session.

$ErrorActionPreference = 'SilentlyContinue'
Set-Location -LiteralPath 'C:\IIG\klpp'

# Identity used for hook-driven commits. Change after setting your global git config.
$gitEmail = 'temadengibitcoinfame@gmail.com'
$gitName  = 'tema'

# 1) Commit any local changes
$status = git status --porcelain 2>$null
if ($status) {
  $msg = 'auto: claude session ' + (Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
  git add -A 2>$null | Out-Null
  git -c "user.email=$gitEmail" -c "user.name=$gitName" commit -m $msg --quiet 2>$null | Out-Null
}

# 2) Fetch + rebase to stay on top of remote (in case Antigravity / friend pushed)
$branch = git rev-parse --abbrev-ref HEAD 2>$null
if (-not $branch -or $branch -eq 'HEAD') { exit 0 }

git fetch origin --quiet 2>$null | Out-Null
git pull origin $branch --rebase --autostash --quiet 2>$null | Out-Null

# If rebase produced a conflict, bail out cleanly — commit stays local, user resolves next session.
if ((Test-Path '.git\rebase-merge') -or (Test-Path '.git\rebase-apply')) {
  git rebase --abort 2>$null | Out-Null
  exit 0
}

# 3) Push best-effort.
git push origin $branch --quiet 2>$null | Out-Null

exit 0
