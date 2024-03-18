#!/usr/bin/env python

# Validates the examples under `../data/event_schemas` against their JSON
# schemas. In the process, the JSON schemas are validated against the JSON
# Schema 2020-12 specification.

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

import helpers
import sys
import json
import os
import traceback


def import_error(module, package, debian, error):
    sys.stderr.write((
        "Error importing %(module)s: %(error)r\n"
        "To install %(module)s run:\n"
        "  pip install %(package)s\n"
        "or on Debian run:\n"
        "  sudo apt-get install python-%(debian)s\n"
    ) % locals())
    if __name__ == '__main__':
        sys.exit(1)

try:
    import jsonschema
except ImportError as e:
    import_error("jsonschema", "jsonschema", "jsonschema", e)
    raise

try:
    import yaml
except ImportError as e:
    import_error("yaml", "PyYAML", "yaml", e)
    raise


def check_example_file(examplepath, schemapath):
    with open(examplepath) as f:
        example = helpers.resolve_references(examplepath, json.load(f))

    with open(schemapath) as f:
        schema = yaml.safe_load(f)

    fileurl = "file://" + os.path.abspath(schemapath)
    schema["id"] = fileurl
    resolver = jsonschema.RefResolver(fileurl, schema, handlers={"file": helpers.load_file_from_uri})

    print ("Checking schema for: %r %r" % (examplepath, schemapath))
    try:
        validator = jsonschema.Draft202012Validator(schema, resolver)
        validator.validate(example)
    except Exception as e:
        raise ValueError("Error validating JSON schema for %r %r" % (
            examplepath, schemapath
        ), e)


def check_example_dir(exampledir, schemadir):
    errors = []
    for root, dirs, files in os.walk(exampledir):
        for filename in files:
            if filename.startswith("."):
                # Skip over any vim .swp files.
                continue
            if filename.endswith(".json"):
                # Skip over any explicit examples (partial event definitions)
                continue
            cwd = os.path.basename(os.path.dirname(os.path.join(root, filename)))
            if cwd == "core":
                # Skip checking the underlying definitions
                continue
            examplepath = os.path.join(root, filename)
            schemapath = examplepath.replace(exampledir, schemadir)
            if schemapath.find("$") >= 0:
                schemapath = schemapath[:schemapath.find("$")]
            # Automatically correct for file extension being stripped off
            if not schemapath.endswith(".yaml"):
                schemapath += ".yaml"
            if not examplepath.endswith(".yaml"):
                examplepath += ".yaml"
            try:
                check_example_file(examplepath, schemapath)
            except Exception as e:
                errors.append(sys.exc_info())
    for (exc_type, exc_value, exc_trace) in errors:
        traceback.print_exception(exc_type, exc_value, exc_trace)
    if errors:
        raise ValueError("Error validating examples")


if __name__ == '__main__':
    # Get the directory that this script is residing in
    script_directory = os.path.dirname(os.path.realpath(__file__))

    # Resolve the directories to check, relative to the script path
    examples_directory = os.path.join(script_directory, "../data/event-schemas/examples")
    schema_directory = os.path.join(script_directory, "../data/event-schemas/schema")

    try:
        check_example_dir(examples_directory, schema_directory)
    except:
        sys.exit(1)
