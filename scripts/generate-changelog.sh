# /bin/bash

# Usage: ./scripts/generate-changelog.sh v1.2 2021-04-01
# or: ./scripts/generate-changelog.sh vUNSTABLE

set -e

VERSION="$1"
DATE="$2"

cd `dirname $0`/../changelogs

# Pre-cleanup just in case it wasn't done on the last run
rm -f rendered.md

# Generate changelog
towncrier --yes

if [ "$VERSION" = "vUNSTABLE" ]; then
    TITLE="Changes since last release"
    LINKTITLE="Unstable"
    FILENAME="unstable.md"
    DATE=$(date -Iseconds)
else
    TITLE="$VERSION Changelog"
    LINKTITLE="$VERSION"
    FILENAME="$VERSION.md"
fi

{
    # Prepare the header
    # We include the generation date in the front matter so that we can use it
    # to sort the changelogs at build time.
    cat <<EOF
---
title: $TITLE
linkTitle: $LINKTITLE
type: docs
layout: changelog
outputs:
  - html
  - checklist
date: $DATE
---
EOF
    # Remove trailing whitespace (such as our intentionally blank RST headings)
    sed -e "s/[ ]*$//" rendered.md
} > ../content/changelog/$FILENAME

# Cleanup
rm -v rendered.md
