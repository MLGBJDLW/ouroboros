#!/bin/bash
# generate-changelog.sh - Auto-generate CHANGELOG entries from git commits
#
# Usage:
#   ./.github/scripts/generate-changelog.sh           # Generate since last tag
#   ./.github/scripts/generate-changelog.sh v3.0.1    # Generate since specific tag
#
# Requires: Conventional Commits format
#   feat: add new feature
#   fix: bug fix
#   docs: documentation
#   refactor: code refactoring
#   test: add tests
#   chore: maintenance

set -e

# Get the tag to compare from
if [ -n "$1" ]; then
    SINCE_TAG="$1"
else
    SINCE_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "")
fi

if [ -z "$SINCE_TAG" ]; then
    echo "No tags found. Showing all commits."
    RANGE="HEAD"
else
    echo "Generating changelog since $SINCE_TAG"
    RANGE="$SINCE_TAG..HEAD"
fi

DATE=$(date +%Y-%m-%d)

echo ""
echo "## [Unreleased] - $DATE"
echo ""

echo "### Added"
git log $RANGE --pretty=format:"%s" | grep -E "^feat(\(.+\))?:" | sed 's/^feat\(.*\): /- /' || true
echo ""

echo "### Fixed"
git log $RANGE --pretty=format:"%s" | grep -E "^fix(\(.+\))?:" | sed 's/^fix\(.*\): /- /' || true
echo ""

echo "### Changed"
git log $RANGE --pretty=format:"%s" | grep -E "^(refactor|chore)(\(.+\))?:" | sed 's/^[a-z]*\(.*\): /- /' || true
echo ""

echo "### Documentation"
git log $RANGE --pretty=format:"%s" | grep -E "^docs(\(.+\))?:" | sed 's/^docs\(.*\): /- /' || true
