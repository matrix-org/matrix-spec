#!/usr/bin/env bash

# Script to generate OpenAPI typescript definitions for the Matrix APIs

set -e

RELEASE="${npm_package_version%.*}"
SPEC_DIR="v${RELEASE}"
if [ "$RELEASE" == "0.0" ]; then
  RELEASE="unstable"
  SPEC_DIR="/unstable"
fi

BASE_URL="https://spec.matrix.org/$SPEC_DIR"

for api in application-service client-server push-gateway server-server; do
  # Combine the docs for the API into a single file for openapi-typescript to consume
  combined_doc="$api-api.json"
  ../../scripts/dump-openapi.py \
    --base-url "$BASE_URL" \
    --api "$api" \
    -r "$RELEASE" \
    -o "$FILE"

  yarn openapi-typescript "$combined_doc" --output "$api.d.ts"

  # We remove these lines to workaround https://github.com/drwpow/openapi-typescript/issues/1055
  sed -i.bak "/\[key: string\]: Record<string, never> \| undefined;/d" client-server.d.ts
  # The sed line above is compatible with both BSD and GNU sed which means we have to manually remove the backup file
  rm "$api.d.ts.bak"

  rm "$combined_doc"
done
