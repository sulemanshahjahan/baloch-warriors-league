# Mobile App Build Script for BWL
# Builds a minimal static version for Capacitor Android app

Write-Host "========================================"
Write-Host "BWL Mobile App Builder"  
Write-Host "========================================"

# Clean up any previous builds
Write-Host "Cleaning up..."
if (Test-Path ".next") { Remove-Item -Recurse -Force .next }
if (Test-Path "out") { Remove-Item -Recurse -Force out }

# Remove any leftover backup folders
Get-ChildItem -Path "src" -Recurse -Directory | Where-Object { $_.Name -match "mobilebackup" } | ForEach-Object {
    Remove-Item -Recurse -Force $_.FullName
}

# Temporarily move API and admin folders
Write-Host "Preparing source files..."
$apiBackup = "api-backup"
$adminBackup = "admin-backup"

if (Test-Path "src/app/api") {
    Move-Item "src/app/api" $apiBackup -Force
}
if (Test-Path "src/app/(admin)") {
    Move-Item "src/app/(admin)" $adminBackup -Force
}

# Move all dynamic/problematic routes
$dynamicBackups = @()
$dynamicRoutes = @(
    "src/app/(public)/matches/[id]",
    "src/app/(public)/matches",
    "src/app/(public)/news/[slug]",
    "src/app/(public)/players/[slug]",
    "src/app/(public)/teams/[slug]",
    "src/app/(public)/tournaments/[slug]",
    "src/app/(public)/tournaments/[slug]/stats",
    "src/app/(public)/stats"
)

foreach ($route in $dynamicRoutes) {
    if (Test-Path -LiteralPath $route) {
        $backup = ($route -replace "src/app/(public)/", "" -replace "/", "-") + "-backup"
        Move-Item -LiteralPath $route $backup -Force
        $dynamicBackups += @{ Original = $route; Backup = $backup }
    }
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
Write-Host "Building..."
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

# Restore dynamic routes
foreach ($routeInfo in $dynamicBackups) {
    Move-Item $routeInfo.Backup $routeInfo.Original -Force
}

# Sync with Capacitor
if ($success) {
    Write-Host "Syncing with Capacitor..."
    npx cap sync
    Write-Host "Build complete! Run: npx cap open android"
} else {
    Write-Host "Build failed!" -ForegroundColor Red
    exit 1
}
