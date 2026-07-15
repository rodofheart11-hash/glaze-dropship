# PowerShell Script to compile and create a clean, orphan shopify-theme branch for GitHub Sync
$ErrorActionPreference = "Stop"

# 1. Start on master and compile the theme into the UNTRACKED shopify-theme folder
git checkout master --force
node build_shopify_theme.js

# 2. Delete any existing shopify-theme branch locally if it exists
if (git branch --list "shopify-theme") {
    git branch -D shopify-theme
}

# 3. Create a clean orphan branch (no history, completely empty index)
git checkout --orphan shopify-theme

# 4. Clean only tracked files (untracked temp-shopify-theme folder will remain completely intact on disk!)
git rm -rf . --ignore-unmatch

# 5. Copy the compiled theme structure from the untracked temp-shopify-theme folder to the root
Copy-Item -Path .\temp-shopify-theme\* -Destination .\ -Recurse -Force
Remove-Item -Path .\temp-shopify-theme -Recurse -Force

# 6. Create a clean, simple .gitignore
Set-Content -Path .gitignore -Value @"
node_modules/
dist/
*.log
"@

# 7. Stage and commit ONLY the Shopify theme folders and gitignore
git add layout/ templates/ sections/ config/ .gitignore
git commit -m "chore: initial shopify theme release"

# 8. Switch back to master
git checkout master --force

Write-Host "=================================================="
Write-Host "SUCCESS: Restructured shopify-theme branch created!"
Write-Host "Only theme folders are tracked on the shopify-theme branch."
Write-Host "Your master workspace has been cleaned and restored."
Write-Host "=================================================="
