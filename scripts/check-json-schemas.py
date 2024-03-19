#!/usr/bin/env python3

# Validates the JSON schemas under `../data`. The schemas are validated against
# the JSON Schema 2020-12 specification, and their inline examples and default
# values are validated against the schema.

# Copyright 2023 Kévin Commaille
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

try:
    import jsonpath
except ImportError as e:
    import_error("jsonpath", "python-jsonpath", "jsonpath", e)
    raise

try:
    import attrs
except ImportError as e:
    import_error("attrs", "attrs", "attrs", e)
    raise

@attrs.define
class SchemaDirReport:
    files: int = 0
    errors: int = 0

    def add(self, other_report):
        self.files += other_report.files
        self.errors += other_report.errors
        
def check_example(path, schema, example):
    # URI with scheme is necessary to make RefResolver work.
    fileurl = "file://" + os.path.abspath(path)
    resolver = jsonschema.RefResolver(fileurl, schema, handlers={"file": helpers.load_file_from_uri})
    validator = jsonschema.Draft202012Validator(schema, resolver)

    validator.validate(example)

def check_schema_examples(path, full_schema):
    """Search objects with inline examples in the schema and check they validate
    against the object's definition.
    """
    errors = []
    matches = jsonpath.finditer(
        # Recurse through all objects and filter out those that don't have an
        # `example`, `examples` or `default` field.
        "$..[?(@.example != undefined || @.examples != undefined || @.default != undefined)]",
        full_schema
    )

    for match in matches:
        schema = match.obj
        if "example" in schema:
            try:
                check_example(path, schema, schema["example"])
            except Exception as e:
                example_path = f"{match.path}['example']"
                print(f"Failed to validate example at {example_path}: {e}")
                errors.append(e)

        if "examples" in schema:
            for index, example in enumerate(schema["examples"]):
                try:
                    check_example(path, schema, example)
                except Exception as e:
                    example_path = f"{match.path}['examples'][{index}]"
                    print(f"Failed to validate example at {example_path}: {e}")
                    errors.append(e)

        if "default" in schema:
            try:
                check_example(path, schema, schema["default"])
            except Exception as e:
                example_path = f"{match.path}['default']"
                print(f"Failed to validate example at {example_path}: {e}")
                errors.append(e)
    
    if len(errors) > 0:
        raise Exception(errors)


def check_schema_file(schema_path):
    with open(schema_path) as f:
        schema = yaml.safe_load(f)

    print(f"Checking schema: {schema_path}")

    # Check schema is valid.
    try:
        validator = jsonschema.Draft202012Validator
        validator.check_schema(schema)
    except Exception as e:
        print(f"Failed to validate JSON schema: {e}")
        raise
    
    # Check schema examples are valid.
    check_schema_examples(schema_path, schema)

def check_schema_dir(schemadir: str) -> SchemaDirReport:
    report = SchemaDirReport()
    for root, dirs, files in os.walk(schemadir):
        for schemadir in dirs:
            dir_report = check_schema_dir(os.path.join(root, schemadir))
            report.add(dir_report)
        for filename in files:
            if filename.startswith("."):
                # Skip over any vim .swp files.
                continue
            if filename.endswith(".json"):
                # Skip over any explicit examples (partial event definitions)
                continue
            try:
                report.files += 1
                check_schema_file(os.path.join(root, filename))
            except Exception as e:
                report.errors += 1
    return report

# The directory that this script is residing in.
script_dir = os.path.dirname(os.path.realpath(__file__))
# The directory of the project.
project_dir = os.path.abspath(os.path.join(script_dir, "../"))
print(f"Project dir: {project_dir}")

# Directories to check, relative to the data folder.
schema_dirs = [
    "api/application-service/definitions",
    "api/client-server/definitions",
    "api/identity/definitions",
    "api/server-server/definitions",
    "event-schemas/schema",
    "schemas",
]

report = SchemaDirReport()
for schema_dir in schema_dirs:
    dir_report = check_schema_dir(os.path.join(project_dir, "data", schema_dir))
    report.add(dir_report)

print(f"Found {report.errors} errors in {report.files} files")

if report.errors:
    sys.exit(1)
    
