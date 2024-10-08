# /bin/bash

# Usage: ./scripts/generate-changelog.sh v1.2 "April 01, 2021"
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
outputs:
  - html
  - checklist
date: $(date -Iseconds)
---
EOF
    if [ "$VERSION" != "vUNSTABLE" ]; then
        sed -e "s/VERSION/$1/g" -e "s/DATE/$2/g" header.md
    fi

    # Remove trailing whitespace (such as our intentionally blank RST headings)
    sed -e "s/[ ]*$//" rendered.md
} > ../content/changelog/$FILENAME

# Cleanup
rm -v rendered.md
