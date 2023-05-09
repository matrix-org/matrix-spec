"use strict";
import { URL } from 'node:url';

// Refactor `servers` field to be able to access `basePath` easily.
function refactorServers(obj) {
    if (!obj.servers) {
        return;
    }

    let server = {
        url: "",
        variables: {
            protocol: {},
            hostname: {
                default: ""
            },
            basePath: {
                default: ""
            }
        }
    }

    const url = new URL(obj.servers[0].url);

    if (obj.servers.length > 1) {
        // In our case several URLs always mean both http and https for the same
        // host.
        obj.servers.pop()
    }

    server.url = "{protocol}://{hostname}{basePath}"
    server.variables.protocol = {
        enum: ["http", "https"],
        default: "https",
    }
    server.variables.hostname.default = url.host
    server.variables.basePath.default = url.pathname

    obj.servers[0] = server;

    return obj;
}

// Fixes to apply to a converted schema object.
export function applyObjectFixes(obj) {
    obj = refactorServers(obj);

    return obj;
}