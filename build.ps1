npm run compile
npm run package
code --uninstall-extension RanaXtacks.git-alpha
code --install-extension git-alpha-0.0.5.vsix --force
Write-Host "============================================="
Write-Host "SUCCESS! Now RELOAD VS CODE window (F1 -> Developer: Reload Window)"
Write-Host "============================================="
