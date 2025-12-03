/*
Copyright 2025 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

// This oddity is an attempt at producing a readable Hugo template while avoiding
// JS syntax errors in your IDE
const currentVersion = `{{ if eq .Site.Params.version.status "unstable" }}
    {{- /**/ -}}
    unstable
    {{- /**/ -}}
{{ else }}
    {{- /**/ -}}
    {{ printf "v%s.%s" .Site.Params.version.major .Site.Params.version.minor }}
    {{- /**/ -}}
{{ end }}`;

function appendVersion(parent, name, url) {
    // The list item
    const li = document.createElement("li");
    if (name === currentVersion) {
        li.classList.add("selected")
    }
    parent.appendChild(li);

    // The link
    const a = document.createElement("a");
    a.classList.add("dropdown-item")
    a.setAttribute("href", url);
    li.appendChild(a);

    // Handle clicks manually to preserve the current path / fragment
    a.addEventListener("click", (ev) => {
        // If the URL is a relative link (i.e. the historical versions changelog), just
        // let the browser load it
        if (url.startsWith("/")) {
            return;
        }

        // Stop further event handling
        ev.preventDefault();
        ev.stopPropagation();

        // Try to find the current version segment
        const href = window.location.href;
        const matches = href.match(/\/unstable\/|\/latest\/|\/v\d+.\d+\//g);
        if (!matches) {
            window.location.href = url;
            return;
        }

        // Replace the segment
        window.location.href = href.replace(matches[0], `/${name}/`);
    });

    // The link text
    const text = document.createTextNode(name);
    a.appendChild(text);
}

// TODO: Load /latest/versions.json
fetch("/versions.json")
    .then(r => r.json())
    .then(versions => {
        // Find the surrounding list element
        const ul = document.querySelector("ul#version-selector");
        if (!ul) {
            console.error("Cannot populate version selector: ul element not found");
            return;
        }

        // Add an entry for the unstable version
        appendVersion(ul, "unstable", "https://spec.matrix.org/unstable");

        // Add an entry for each proper version
        for (const version of versions) {
            appendVersion(ul, version.name, `https://spec.matrix.org/${version.name}`);
        }

        // For historical versions, simply link to the changelog
        appendVersion(ul, "historical", '{{ (site.GetPage "changelog/historical").RelPermalink }}');
    });
