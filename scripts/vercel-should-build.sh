#!/usr/bin/env bash
# Vercel "Ignored Build Step" command.
# Exit 0 = SKIP build. Exit 1 = PROCEED with build.
#
# Skips builds when only non-web files changed (docs, Android shell,
# CI config, scripts not used in build, etc.).
#
# To wire up: Vercel dashboard -> Project -> Settings -> Git
#   -> Ignored Build Step -> "Run my own command":
#   bash scripts/vercel-should-build.sh

# No git context (manual deploy) - build.
if [ -z "$VERCEL_GIT_COMMIT_SHA" ]; then
  echo "No git commit context - building."
  exit 1
fi

# Shallow clone may not have HEAD^ - if missing, build to be safe.
if ! git rev-parse HEAD^ >/dev/null 2>&1; then
  echo "No parent commit available - building."
  exit 1
fi

# Compare against previous commit. If diff is empty after excluding
# the paths below, skip the build.
CHANGED=$(git diff --name-only HEAD^ HEAD -- \
  ':(exclude)*.md' \
  ':(exclude)android/**' \
  ':(exclude).github/**' \
  ':(exclude).claude/**' \
  ':(exclude)build-mobile.ps1' \
  ':(exclude)capacitor.config.ts' \
  ':(exclude)generate-icons.py' \
  ':(exclude)bwl-release.keystore' \
  ':(exclude)dist-cap/**' \
  ':(exclude)*.sql' \
  ':(exclude).env.example' \
  ':(exclude).gitignore' \
  ':(exclude)scripts/seed-dummy-league.ts' \
  ':(exclude)scripts/backfill-elo.ts' \
  ':(exclude)scripts/fix-pubg-standings.ts' \
  ':(exclude)scripts/migrate-photos-to-cloudinary.ts' \
  ':(exclude)scripts/vercel-should-build.sh' \
  ':(exclude)tests/**' \
  ':(exclude)fix-rounds.ts' \
  ':(exclude)fix-final-round.sql' \
)

if [ -z "$CHANGED" ]; then
  echo "No production-relevant changes - skipping build."
  exit 0
fi

echo "Production-relevant changes detected:"
echo "$CHANGED"
exit 1
