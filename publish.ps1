Write-Host "============================================="
Write-Host "GIT-Alpha!! Publishing Script"
Write-Host "============================================="
Write-Host ""
Write-Host "This script will publish version 0.0.5 to BOTH major marketplaces."
Write-Host ""

# Install required CLI tools
Write-Host "1/3 Installing Publisher Tools (vsce & ovsx)..."
npm install -g @vscode/vsce ovsx

# Ensure it's packaged
Write-Host "2/3 Packaging the extension..."
npm run package

Write-Host ""
Write-Host "============================================="
Write-Host "PUBLISH TO MICROSOFT VS CODE MARKETPLACE"
Write-Host "============================================="
Write-Host "You need a Personal Access Token (PAT) from Azure DevOps."
Write-Host "(Get it here: https://aka.ms/vscodemarketplace-pat)"
$msToken = Read-Host "Paste your Microsoft PAT (or press Enter to skip)"

if ($msToken -ne "") {
    vsce publish -p $msToken
    Write-Host "Published to Microsoft Marketplace successfully!"
} else {
    Write-Host "Skipped Microsoft Marketplace."
}

Write-Host ""
Write-Host "============================================="
Write-Host "PUBLISH TO OPEN VSX REGISTRY"
Write-Host "============================================="
Write-Host "You need an Access Token from Open VSX."
Write-Host "(Get it here: https://open-vsx.org/user-settings/tokens)"
$ovsxToken = Read-Host "Paste your Open VSX Token (or press Enter to skip)"

if ($ovsxToken -ne "") {
    ovsx publish -p $ovsxToken --packagePath git-alpha-0.0.5.vsix
    Write-Host "Published to Open VSX Registry successfully!"
} else {
    Write-Host "Skipped Open VSX."
}

Write-Host ""
Write-Host "ALL DONE!"
