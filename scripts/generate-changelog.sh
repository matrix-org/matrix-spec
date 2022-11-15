# /bin/bash

# Usage: ./scripts/generate-changelog.sh v1.2 "April 01, 2021"
# or: ./scripts/generate-changelog.sh vUNSTABLE

set -e

VERSION="$1"
DATE="$2"

cd `dirname $0`/../changelogs

# Pre-cleanup just in case it wasn't done on the last run
rm -f rendered.md

# Reversed order so that room versions ends up on the bottom
towncrier --name "Internal Changes/Tooling" --dir "./internal" --config "./pyproject.toml" --yes
towncrier --name "Appendices" --dir "./appendices" --config "./pyproject.toml" --yes
towncrier --name "Room Versions" --dir "./room_versions" --config "./pyproject.toml" --yes
towncrier --name "Push Gateway API" --dir "./push_gateway" --config "./pyproject.toml" --yes
towncrier --name "Identity Service API" --dir "./identity_service" --config "./pyproject.toml" --yes
towncrier --name "Application Service API" --dir "./application_service" --config "./pyproject.toml" --yes
towncrier --name "Server-Server API" --dir "./server_server" --config "./pyproject.toml" --yes
towncrier --name "Client-Server API" --dir "./client_server" --config "./pyproject.toml" --yes

{
    # Prepare the header
    # We include the generation date in the front matter so that we can use it
    # to sort the changelogs at build time.
    cat <<EOF
---
date: $(date -Iseconds)
---
EOF
    if [ "$VERSION" = "vUNSTABLE" ]; then
        echo "## Changes since last release"
    else
        sed -e "s/VERSION/$1/g" -e "s/DATE/$2/g" header.md
    fi

    # Remove trailing whitespace (such as our intentionally blank RST headings)
    sed -e "s/[ ]*$//" rendered.md
} > ../content/changelog/$VERSION.md

# Cleanup
rm -v rendered.md
