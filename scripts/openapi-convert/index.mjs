"use strict";
import nopt from 'nopt';

import { convertDefinitions } from './convert-definitions.mjs';
import { applyStringFixes } from './string-fixes.mjs';

const opts = nopt({
    "help": Boolean,
    "data": String
}, {
    "h": "--help",
    "d": "--data"
});

console.log("params: {}", opts);
if (opts.help) {
    console.log(
        "Convert the definitions from Swagger 2.0 to OpenAPI 3.0\n" +
        "Usage:\n" +
        "  node index.mjs -d <data_folder>"
    );
    process.exit(0);
}
if (!opts.data) {
    console.error("No [d]ata dir specified.");
    process.exit(1);
}

console.log("Converting Swagger 2.0 definitions to OpenAPI 3.0 in %s...", opts.data);
try {
    await convertDefinitions(opts.data);

    console.log("Applying string fixes...");
    await applyStringFixes(opts.data);

    console.log("    ✅ Success");
} catch (err) {
    console.error('    ❌ {}', err);
    process.exit(1);
}
