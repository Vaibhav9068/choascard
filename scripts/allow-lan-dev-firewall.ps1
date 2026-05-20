# Run in PowerShell as Administrator to allow LAN access to dev servers.
# Usage: Right-click PowerShell -> Run as administrator, then:
#   Set-Location "C:\Users\vaibh\Desktop\Cards"
#   .\scripts\allow-lan-dev-firewall.ps1

$ErrorActionPreference = 'Stop'

$rules = @(
  @{ DisplayName = 'Cards-Next-Dev-3000'; Port = 3000 },
  @{ DisplayName = 'Cards-Backend-5000'; Port = 5000 }
)

foreach ($r in $rules) {
  $existing = Get-NetFirewallRule -DisplayName $r.DisplayName -ErrorAction SilentlyContinue
  if ($existing) {
    Write-Host "Already exists: $($r.DisplayName)"
    continue
  }
  New-NetFirewallRule `
    -DisplayName $r.DisplayName `
    -Direction Inbound `
    -Action Allow `
    -Protocol TCP `
    -LocalPort $r.Port `
    -Profile Private | Out-Null
  Write-Host "Created: $($r.DisplayName) (TCP $($r.Port), Private profile)"
}

Write-Host ""
Write-Host "Also ensure Node.js is allowed on Private networks:"
Write-Host "  Windows Security -> Firewall -> Allow an app -> Node.js (Private checked)"
