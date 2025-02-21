# /bin/bash

# Usage: ./scripts/generate-changelog.sh v1.2 for changelogs of stable releases
# or: ./scripts/generate-changelog.sh vUNSTABLE for the unstable changelog.

set -e

VERSION="$1"

if [ -z "$VERSION" ]; then
    echo "ERROR: The version of the changelog must be provided"
    exit 1
fi

if [ "$VERSION" = "vUNSTABLE" ]; then
    TITLE="Changes since last release"
    LINKTITLE="Unstable"
    FILENAME="unstable.md"
else
    TITLE="$VERSION Changelog"
    LINKTITLE="$VERSION"
    FILENAME="$VERSION.md"
fi

cd `dirname $0`/../changelogs

# Pre-cleanup just in case it wasn't done on the last run
rm -f rendered.md

# Generate changelog
towncrier --yes

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
date: $(date -Idate)
EOF

    # Add the commit hash for the unstable versions. It is used to generate a
    # link to the commit on the repository.
    if [ "$VERSION" == "vUNSTABLE" ]; then
        echo "params:"
        echo "  commit: $(git rev-parse --short HEAD)"
    fi

    # Close the frontmatter.
    echo "---"

    # Remove trailing whitespace (such as our intentionally blank RST headings)
    sed -e "s/[ ]*$//" rendered.md
} > ../content/changelog/$FILENAME

# Cleanup
rm -v rendered.md
