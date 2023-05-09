"use strict";
import fs from 'node:fs/promises';
import converter from 'swagger2openapi';
import path_utils from 'node:path';
import yaml from 'yaml';

import { applyObjectFixes } from './object-fixes.mjs';

async function getStartComment(path) {
    const file = await fs.open(path);

    let start_comment = "";
    for await (const line of file.readLines()) {
        if (line.startsWith('#')) {
            start_comment += line + '\n';
        } else {
            break;
        }
    };

    await file.close();

    return start_comment
}

async function convertDefinitionsFile(path) {
    let relative_separator = path.lastIndexOf('/data/api');
    let short_path = path.slice(relative_separator + 1);
    console.log("%s", short_path);

    // Save the comments at the start of the file to not lose them.
    let start_comment = await getStartComment(path);

    // Convert.
    const options = await converter.convertFile(path, {
        // Patch fixable errors.
        patch: true,
        // Keep $ref siblings.
        refSiblings: 'preserve',
        // Don't deduplicate requestBodies.
        resolveInternal: true,
        // Write OpenAPI version 3.1.0, even if it's not completely true, it'll
        // be fixed later.
        targetVersion: '3.1.0',
    });

    // Apply fixes on object.
    const obj = applyObjectFixes(options.openapi);

    // Serialize.
    const doc = new yaml.Document(obj);
    const content = yaml.stringify(doc, {
        // Use "literal" blocks, like the input.
        blockQuote: "literal"
    });

    // Save to file.
    await fs.writeFile(path, start_comment + content);
}

export async function convertDefinitionsDir(path) {
    console.log("Converting files in %s", path);

    const files = await fs.readdir(path);

    for (const file of files) {
        if (file.endsWith(".yaml")) {
            await convertDefinitionsFile(path_utils.join(path, file));
        }
    }
}

// Convert Swagger 2.0 definitions to OpenAPI 3.0.0.
export async function convertDefinitions(path) {
    // We don't want to try to convert schemas in subdirectories, so we need to
    // call this separately for every directory inside `data/api`.
    let api_dir = path_utils.join(path, "api");
    const files = await fs.readdir(api_dir);

    for (const file of files) {
        await convertDefinitionsDir(path_utils.join(api_dir, file));
    }
}