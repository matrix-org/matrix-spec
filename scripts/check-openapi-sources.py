#! /usr/bin/env python

# Validates the OpenAPI definitions under `../data/api`. Checks the request
# parameters and body, and response body. The schemas are validated against the
# JSON Schema 2020-12 specification and the examples are validated against those
# schemas.

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

import sys
import json
import os


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


def check_schema(filepath, example, schema):
    example = resolve_references(filepath, example)
    schema = resolve_references(filepath, schema)
    resolver = jsonschema.RefResolver(filepath, schema, handlers={"file": load_file})
    validator = jsonschema.Draft202012Validator(schema, resolver)
    validator.validate(example)


def check_parameter(filepath, request, parameter):
    schema = parameter.get('schema')
    example = parameter.get('example')

    if not example:
        example = schema.get('example')

    if example and schema:
        try:
            print("Checking schema for request parameter: %r %r %r" % (
                filepath, request, parameter.get("name")
            ))
            check_schema(filepath, example, schema)
        except Exception as e:
            raise ValueError("Error validating JSON schema for %r" % (
                request
            ), e)

def check_request_body(filepath, request, body):
    schema = body.get('schema')
    example = body.get('example')

    if not example:
        example = schema.get('example')

    if example and schema:
        try:
            print("Checking schema for request body: %r %r" % (
                filepath, request,
            ))
            check_schema(filepath, example, schema)
        except Exception as e:
            raise ValueError("Error validating JSON schema for %r" % (
                request
            ), e)


def check_response(filepath, request, code, response):
    schema = response.get('schema')
    if schema:
        for name, example in response.get('examples', {}).items():
            value = example.get('value')
            if value:
                try:
                    print ("Checking response schema for: %r %r %r %r" % (
                        filepath, request, code, name
                    ))
                    check_schema(filepath, value, schema)
                except jsonschema.SchemaError as error:
                    for suberror in sorted(error.context, key=lambda e: e.schema_path):
                        print(list(suberror.schema_path), suberror.message, sep=", ")
                    raise ValueError("Error validating JSON schema for %r %r" % (
                        request, code
                    ), e)
                except Exception as e:
                    raise ValueError("Error validating JSON schema for %r %r" % (
                        request, code
                    ), e)


def check_openapi_file(filepath):
    with open(filepath) as f:
        openapi = yaml.safe_load(f)

    openapi_version = openapi.get('openapi')
    if not openapi_version:
        # This is not an OpenAPI file, skip.
        return
    elif openapi_version != '3.1.0':
        raise ValueError("File %r is not using the proper OpenAPI version: expected '3.1.0', got %r" % (filepath, openapi_version))

    for path, path_api in openapi.get('paths', {}).items():

        for method, request_api in path_api.items():
            request = "%s %s" % (method.upper(), path)
            for parameter in request_api.get('parameters', ()):
                check_parameter(filepath, request, parameter)
            
            json_body = request_api.get('requestBody', {}).get('content', {}).get('application/json')
            if json_body:
                check_request_body(filepath, request, json_body)

            try:
                responses = request_api['responses']
            except KeyError:
                raise ValueError("No responses for %r" % (request,))
            for code, response in responses.items():
                json_response = response.get('content', {}).get('application/json')

                if json_response:
                    check_response(filepath, request, code, json_response)


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
            # Pull the referenced filepath from the schema
            referenced_file = schema['$ref']

            # Referenced filepaths are relative, so take the current path's
            # directory and append the relative, referenced path to it.
            inner_path = os.path.join(os.path.dirname(path), referenced_file)

            # Then convert the path (which may contiain '../') into a
            # normalised, absolute path
            inner_path = os.path.abspath(inner_path)

            # Load the referenced file
            ref = load_file("file://" + inner_path)

            # Check that the references in *this* file are valid
            result = resolve_references(inner_path, ref)

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


def load_file(path):
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


if __name__ == '__main__':
    # Get the directory that this script is residing in
    script_directory = os.path.dirname(os.path.realpath(__file__))

    # Resolve the directory containing the OpenAPI sources,
    # relative to the script path
    source_files_directory = os.path.realpath(os.path.join(script_directory, "../data/api"))

    # Walk the source path directory, looking for YAML files to check
    for (root, dirs, files) in os.walk(source_files_directory):
        for filename in files:
            if not filename.endswith(".yaml"):
                continue

            path = os.path.join(root, filename)

            try:
                check_openapi_file(path)
            except Exception as e:
                raise ValueError("Error checking file %s" % (path,), e)
