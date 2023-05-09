"use strict";
import fs from 'node:fs/promises';
import path_utils from 'node:path';
import yaml from 'yaml';

const DEFAULT_INDENT = 2;

// Find the first child field with the given indentation in the given content.
//
// Returns the position at the end of the field's line.
function findYamlChildField(content, min_indent, field_name) {
    const min_indent_string = " ".repeat(min_indent);
    const field_line = min_indent_string + field_name + ":\n";
    let line_start_idx = 0;

    while (line_start_idx < content.length) {
        const content_end = content.slice(line_start_idx);
        const line_length = content_end.indexOf("\n") + 1;
        const line_end_idx = line_start_idx + line_length;
        const line = content_end.slice(0, line_length);

        if (line == field_line) {
            // This is the child we are looking for.
            return line_end_idx;
        }

        if (!line.startsWith(min_indent_string)) {
            // We changed the parent so we can't find the child anymore.
            return null;
        }

        line_start_idx = line_end_idx;
    }

    // We didn't find the child.
    return null;
}

// Find the end of the children with the given indentation in the YAML content.
//
// Returns the position at the end of the last child.
function findYamlChildrenEnd(content, min_indent) {
    const min_indent_string = " ".repeat(min_indent);
    let line_start_idx = 0;

    while (line_start_idx < content.length) {
        const content_end = content.slice(line_start_idx);

        if (content_end.startsWith(min_indent_string)) {
            const line_length = content_end.indexOf("\n") + 1;
            line_start_idx += line_length;
        } else {
            break;
        }
    }

    return line_start_idx;
}

// Convert and replace the YAML in the given content between start and end with JSON.
function replaceYamlWithJson(content, start, end, extra_indent) {
    console.log("Processing example", start, end);
    const example_yaml = content.slice(start, end);
    console.log("```" + example_yaml + "```");
    const example_obj = yaml.parse(example_yaml);
    const example_json = JSON.stringify(example_obj, null, DEFAULT_INDENT) + "\n";
    console.log("```" + example_json + "```");

    // Fix the indentation.
    let json_lines = example_json.split("\n");
    // The first and last line don't need the extra indent.
    for (let i = 1; i < json_lines.length - 1; i++) {
        json_lines[i] = " ".repeat(extra_indent) + json_lines[i];
    }
    const indented_example_json = json_lines.join("\n");

    // Put the opening bracket on the same line as the parent field.
    const replace_start = start - 1;
    content = content.slice(0, replace_start) + ' ' + indented_example_json + content.slice(end);

    return content;
}

/// Convert the examples under the given fields in the YAML content to JSON.
function convertExamplesToJson(content, parent_field, example_field) {
    const parent_field_regex_string = "( +)" + parent_field + ":\n";
    const parent_field_regex = RegExp(parent_field_regex_string, 'g');
    let match;
    let examples = [];

    while ((match = parent_field_regex.exec(content)) !== null) {
        console.log("Found parent field", parent_field, match.index);
        const indent_capture = match[1];
        const example_field_line_indent = indent_capture.length + DEFAULT_INDENT;
        const parent_field_line_end = parent_field_regex.lastIndex;
        let content_end = content.slice(parent_field_line_end);

        const example_field_line_end = findYamlChildField(content_end, example_field_line_indent, example_field);

        if (example_field_line_end == null) {
            continue;
        }

        const example_start = parent_field_line_end + example_field_line_end;
        content_end = content.slice(example_start);
        console.log("Found example at", example_start);
        const example_line_min_indent = example_field_line_indent + DEFAULT_INDENT;
        const example_length = findYamlChildrenEnd(content_end, example_line_min_indent);
        console.log("Example length", example_length);

        if (example_length > 0) {
            examples.push({
                start: example_start,
                end: example_start + example_length,
                extra_indent: example_field_line_indent,
            })
        }
    }

    for (const example of examples.reverse()) {
        content = replaceYamlWithJson(content, example.start, example.end, example.extra_indent);
    }

    return content;
}

async function applyStringFixesFile(path) {
    const relative_separator = path.lastIndexOf('/data/api');
    const short_path = path.slice(relative_separator + 1);
    console.log("%s", short_path);

    let content = await fs.readFile(path, "utf-8");

    // Fix occurrences of `*xx` status codes to `*XX`.
    content = content.replaceAll("3xx:", "\"3XX\":");
    content = content.replaceAll("4xx:", "\"4XX\":");

    // Fix occurrences of `_ref` to `$ref`.
    content = content.replaceAll("_ref:", "$ref:");

    // Fix occurrences of `x-example` to `example`.
    content = content.replaceAll("x-example:", "example:");

    // Convert examples back to JSON.
    // Response examples.
    content = convertExamplesToJson(content, "response", "value");
    // Schema examples.
    content = convertExamplesToJson(content, "schema", "example");

    await fs.writeFile(path, content);
}

// Fixes to apply to the string content of the files.
export async function applyStringFixes(path) {
    const stat = await fs.lstat(path);
    if (stat.isDirectory()) {
        const files = await fs.readdir(path);

        for (const file of files) {
            await applyStringFixes(path_utils.join(path, file))
        }
    } else if (stat.isFile()) {
        await applyStringFixesFile(path);
    }
}