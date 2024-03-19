#!/usr/bin/env python3

# Helpers to resolve $ref recursively in OpenAPI and JSON schemas.

# Copyright 2016 OpenMarket Ltd
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import json
import os
import os.path
import urllib.parse
import yaml

def resolve_references(path, schema):
    """Recurse through a given schema until we find a $ref key. Upon doing so,
    check that the referenced file exists, then load it up and check all of the
    references in that file. Continue on until we've hit all dead ends.

    $ref values are deleted from schemas as they are validated, to prevent
    duplicate work.
    """
    if isinstance(schema, dict):
        # do $ref first
        if '$ref' in schema:
            # Pull the referenced URI from the schema
            ref_uri = schema['$ref']

            # Join the referenced URI with the URI of the file, to resolve
            # relative URIs
            full_ref_uri = urllib.parse.urljoin("file://" + path, ref_uri)

            # Separate the fragment.
            (full_ref_uri, fragment) = urllib.parse.urldefrag(full_ref_uri)

            # Load the referenced file
            ref = load_file_from_uri(full_ref_uri)

            if fragment:
                # The fragment should be a JSON Pointer
                keys = fragment.strip('/').split('/')
                for key in keys:
                    ref = ref[key]

            # Check that the references in *this* file are valid
            result = resolve_references(urllib.parse.urlsplit(full_ref_uri).path, ref)

            # They were valid, and so were the sub-references. Delete
            # the reference here to ensure we don't pass over it again
            # when checking other files
            del schema['$ref']
        else:
            result = {}

        for key, value in schema.items():
            result[key] = resolve_references(path, value)
        return result
    elif isinstance(schema, list):
        return [resolve_references(path, value) for value in schema]
    else:
        return schema


def load_file_from_uri(path):
    """Load a JSON or YAML file from a file:// URI.
    """
    print("Loading reference: %s" % path)
    if not path.startswith("file://"):
        raise Exception("Bad ref: %s" % (path,))
    path = path[len("file://"):]
    with open(path, "r") as f:
        if path.endswith(".json"):
            return json.load(f)
        else:
            # We have to assume it's YAML because some of the YAML examples
            # do not have file extensions.
            return yaml.safe_load(f)