#!/usr/bin/env bash

# Script to generate OpenAPI typescript definitions for the Matrix APIs

RELEASE="${npm_package_version%.0}"
SPEC_DIR="v${RELEASE}"
if [ "$RELEASE" == "0.0" ]; then
  RELEASE="unstable"
  SPEC_DIR="/unstable"
fi

BASE_URL="https://spec.matrix.org/$SPEC_DIR"

for api in application-service client-server push-gateway server-server; do
  FILE="$api-api.json"
  ../../scripts/dump-openapi.py \
    --base-url "$BASE_URL" \
    --api "$api" \
    -r "$RELEASE" \
    -o "$FILE"

  yarn openapi-typescript "$FILE" --output "$api.d.ts"
  # We remove these lines to workaround dodgy types
  sed -i.bak "/\[key: string\]: Record<string, never> \| undefined;/d" client-server.d.ts
  rm "$api.d.ts.bak"

  rm "$FILE"
done
