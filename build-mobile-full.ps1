# Mobile App Build Script for BWL - FULL FEATURED
# Builds complete static version with all pages for Capacitor Android app

Write-Host "========================================"
Write-Host "BWL Mobile App Builder - FULL FEATURED"  
Write-Host "========================================"

# Clean up any previous builds
Write-Host "Cleaning up..."
if (Test-Path ".next") { Remove-Item -Recurse -Force .next }
if (Test-Path "out") { Remove-Item -Recurse -Force out }

# Temporarily move API and admin folders (these can't be static)
Write-Host "Preparing source files..."
$apiBackup = "api-backup"
$adminBackup = "admin-backup"

if (Test-Path "src/app/api") {
    Move-Item "src/app/api" $apiBackup -Force
}
if (Test-Path "src/app/(admin)") {
    Move-Item "src/app/(admin)" $adminBackup -Force
}

# Remove "use server" from stats.ts
$statsFile = "src/lib/actions/stats.ts"
$statsOriginal = Get-Content -LiteralPath $statsFile -Raw
$statsModified = $statsOriginal -replace '"use server";', ''
Set-Content -LiteralPath $statsFile $statsModified -NoNewline

# Remove dynamic exports from all public pages
$pages = Get-ChildItem -Path "src/app/(public)" -Recurse -Filter "page.tsx"
$originalPages = @()
foreach ($page in $pages) {
    $content = Get-Content -LiteralPath $page.FullName -Raw
    $originalPages += @{ Path = $page.FullName; Content = $content }
    $modified = $content -replace 'export const dynamic = "force-dynamic";', ''
    Set-Content -LiteralPath $page.FullName $modified -NoNewline
}

# Backup and switch next.config.ts
$originalConfig = Get-Content -LiteralPath "next.config.ts" -Raw
Copy-Item "next.config.ts" "next.config.ts.backup" -Force

$mobileConfig = 'import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  distDir: "out",
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
    ],
  },
};

export default nextConfig;
'
Set-Content -LiteralPath "next.config.ts" $mobileConfig -NoNewline

# Build
Write-Host "Building full featured app (this may take a while)..."
npm run build
$success = $?

# Restore everything
Write-Host "Restoring files..."

# Restore pages
foreach ($pageInfo in $originalPages) {
    Set-Content -LiteralPath $pageInfo.Path $pageInfo.Content -NoNewline
}

# Restore stats.ts
Set-Content -LiteralPath $statsFile $statsOriginal -NoNewline

# Restore config
Copy-Item "next.config.ts.backup" "next.config.ts" -Force
Remove-Item "next.config.ts.backup"

# Restore API and admin
if (Test-Path $apiBackup) {
    Move-Item $apiBackup "src/app/api" -Force
}
if (Test-Path $adminBackup) {
    Move-Item $adminBackup "src/app/(admin)" -Force
}

# Sync with Capacitor
if ($success) {
    Write-Host "Syncing with Capacitor..."
    npx cap sync
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "Build complete!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:"
    Write-Host "1. Open Android Studio: npx cap open android"
    Write-Host "2. Build APK: Build > Build Bundle(s) / APK(s) > Build APK(s)"
    Write-Host "   OR use: cd android && .\gradlew assembleDebug"
    Write-Host ""
    Write-Host "APK will be at: android/app/build/outputs/apk/debug/app-debug.apk"
} else {
    Write-Host "Build failed!" -ForegroundColor Red
    exit 1
}
