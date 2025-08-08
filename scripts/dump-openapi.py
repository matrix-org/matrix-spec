#!/usr/bin/env python3

# dump-openapi reads all of the OpenAPI docs used in spec generation and
# outputs a JSON file which merges them all, for use as input to an OpenAPI
# viewer.

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

import argparse
import errno
import helpers
import json
import logging
import os.path
import re
import sys
import yaml


scripts_dir = os.path.dirname(os.path.abspath(__file__))
api_dir = os.path.join(os.path.dirname(scripts_dir), "data", "api")

# Finds a Hugo shortcode in a string.
#
# A shortcode is defined as (newlines and whitespaces for presentation purpose):
#
# {{%
#     <zero or more whitespaces>
#     <name of shortcode>
#     (optional <one or more whitespaces><list of parameters>)
#     <zero or more whitespaces>
# %}}
#
# With:
#
# * <name of shortcode>: any word character and `-` and `/`. `re.ASCII` is used to only match
#   ASCII characters in the name.
# * <list of parameters>: any character except `}`, must not start or end with a
#   whitespace.
shortcode_regex = re.compile(r"""\{\{\%                                   # {{%
                                 \s*                                      # zero or more whitespaces
                                 (?P<name>[\w/-]+)                        # name of shortcode
                                 (?:\s+(?P<params>[^\s\}][^\}]+[^\s\}]))? # optional list of parameters
                                 \s*                                      # zero or more whitespaces
                                 \%\}\}                                   # %}}""", re.ASCII | re.VERBOSE)

# Parses the parameters of a Hugo shortcode.
#
# For simplicity, this currently only supports the `key="value"` format.
shortcode_params_regex = re.compile(r"(?P<key>\w+)=\"(?P<value>[^\"]+)\"", re.ASCII)

def prefix_absolute_path_references(text, base_url):
    """Adds base_url to absolute-path references.

    Markdown links in descriptions may be absolute-path references.
    These won’t work when the spec is not hosted at the root, such as
    https://spec.matrix.org/latest/
    This turns all `[foo](/bar)` found in text into
    `[foo](https://spec.matrix.org/latest/bar)`, with
    base_url = 'https://spec.matrix.org/latest/'
    """
    return text.replace("](/", "]({}/".format(base_url))

def replace_match(match, replacement):
    """Replaces the regex match by the replacement in the text."""
    return match.string[:match.start()] + replacement + match.string[match.end():]

def replace_shortcode(shortcode):
    """Replaces the shortcode by a Markdown fallback in the text.

    The supported shortcodes are:

    * boxes/note, boxes/rationale, boxes/warning
    * added-in, changed-in
    
    All closing tags (`{{ /shortcode }}`) are replaced with the empty string.
    """

    if shortcode['name'].startswith("/"):
        # This is the end of the shortcode, just remove it.
        return replace_match(shortcode, "")

    # Parse the parameters of the shortcode
    params = {}
    if shortcode['params']:
        for param in shortcode_params_regex.finditer(shortcode['params']):
            if param['key']:
                params[param['key']] = param['value']

    match shortcode['name']:
        case "boxes/note":
            return replace_match(shortcode, "**NOTE:** ")
        case "boxes/rationale":
            return replace_match(shortcode, "**RATIONALE:** ")
        case "boxes/warning":
            return replace_match(shortcode, "**WARNING:** ")
        case "added-in":
            version = params['v']
            if not version:
                raise ValueError("Missing parameter `v` for `added-in` shortcode")

            return replace_match(shortcode, f"**[Added in `v{version}`]** ")
        case "changed-in":
            version = params['v']
            if not version:
                raise ValueError("Missing parameter `v` for `changed-in` shortcode")

            return replace_match(shortcode, f"**[Changed in `v{version}`]** ")
        case _:
            raise ValueError("Unknown shortcode", shortcode['name'])


def find_and_replace_shortcodes(text):
    """Finds Hugo shortcodes and replaces them by a Markdown fallback.

    The supported shortcodes are:

    * boxes/note, boxes/rationale, boxes/warning
    * added-in, changed-in
    """
    # We use a `while` loop with `search` instead of a `for` loop with
    # `finditer`, because as soon as we start replacing text, the
    # indices of the match are invalid.
    while shortcode := shortcode_regex.search(text):
        text = replace_shortcode(shortcode)

    return text

def edit_descriptions(node, base_url):
    """Finds description nodes and apply fixes to them.

    The fixes that are applied are:

    * Make links absolute
    * Replace Hugo shortcodes
    """
    if isinstance(node, dict):
        for key in node:
            if isinstance(node[key], str):
                node[key] = prefix_absolute_path_references(node[key], base_url)
                node[key] = find_and_replace_shortcodes(node[key])
            else:
                edit_descriptions(node[key], base_url)
    elif isinstance(node, list):
        for item in node:
            edit_descriptions(item, base_url)


parser = argparse.ArgumentParser(
    "dump-openapi.py - assemble the OpenAPI specs into a single JSON file"
)
parser.add_argument(
    "--base-url", "-b",
    default="https://spec.matrix.org/unstable/",
    help="""The base URL to prepend to links in descriptions. Default:
    %(default)s""",
)
parser.add_argument(
    "--spec-release", "-r", metavar="LABEL",
    default="unstable",
    help="""The spec release version to generate for. Default:
    %(default)s""",
)
available_apis = {
    "client-server": "Matrix Client-Server API",
    "server-server": "Matrix Server-Server API",
    "application-service": "Matrix Application Service API",
    "identity": "Matrix Identity Service API",
    "push-gateway": "Matrix Push Gateway API",
}
parser.add_argument(
    "--api",
    default="client-server",
    choices=available_apis,
    help="""The API to generate for. Default: %(default)s""",
)
parser.add_argument(
    "-o", "--output",
    default=os.path.join(scripts_dir, "openapi", "api-docs.json"),
    help="File to write the output to. Default: %(default)s"
)
args = parser.parse_args()

output_file = os.path.abspath(args.output)
release_label = args.spec_release
selected_api = args.api

major_version = release_label
match = re.match("^(r\d+)(\.\d+)*$", major_version)
if match:
    major_version = match.group(1)

base_url = args.base_url.rstrip("/")

logging.basicConfig()

output = {
    # The servers value will be picked up by RapiDoc to provide a way
    # to switch API servers. Useful when one wants to test compliance
    # of their server with the API.
    "servers": [
        {
            "url": "https://matrix.org",
        },
        {
            "url": "https://{homeserver_address}",
            "variables": {
                "homeserver_address": {
                    "default": "matrix-client.matrix.org",
                    "description": "The base URL for your homeserver",
                }
            },
        }
    ],
    "info": {
        "title": available_apis[selected_api],
        "version": release_label,
    },
    "components": {
        "securitySchemes": {}
    },
    "paths": {},
    "openapi": "3.1.0",
}

selected_api_dir = os.path.join(api_dir, selected_api)
try:
    with open(os.path.join(selected_api_dir, 'definitions', 'security.yaml')) as f:
        output['components']['securitySchemes'] = yaml.safe_load(f)
except FileNotFoundError:
    print("No security definitions available for this API")

untagged = 0
for filename in os.listdir(selected_api_dir):
    if not filename.endswith(".yaml"):
        continue
    filepath = os.path.join(selected_api_dir, filename)

    print("Reading OpenAPI: %s" % filepath)
    with open(filepath, "r") as f:
        api = yaml.safe_load(f.read())
        api = helpers.resolve_references(filepath, api)

        basePath = api['servers'][0]['variables']['basePath']['default']
        for path, methods in api["paths"].items():
            path = basePath + path
            for method, spec in methods.items():
                if path not in output["paths"]:
                    output["paths"][path] = {}
                output["paths"][path][method] = spec
                if "tags" not in spec.keys():
                    print("Warning: {} {} is not tagged ({}).".format(method.upper(), path, filename))
                    untagged +=1
if untagged != 0:
    print("{} untagged operations, you may want to look into fixing that.".format(untagged))

edit_descriptions(output, base_url)

print("Generating %s" % output_file)

try:
    os.makedirs(os.path.dirname(output_file))
except OSError as e:
    if e.errno != errno.EEXIST:
        raise

with open(output_file, "w") as f:
    text = json.dumps(output, sort_keys=True, indent=4)
    text = text.replace("%CLIENT_RELEASE_LABEL%", release_label)
    f.write(text)
