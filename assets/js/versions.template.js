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

// Determine the current version as defined in hugo.toml. This will either be
// "unstable" or "vX.X" and doesn't depend on the current URL.
//
// The oddity below is an attempt at producing a readable Hugo template while
// avoiding JS syntax errors in your IDE.
const currentVersion = `{{ if eq .Site.Params.version.status "unstable" }}
    {{- /**/ -}}
    unstable
    {{- /**/ -}}
{{ else }}
    {{- /**/ -}}
    {{ printf "v%s.%s" .Site.Params.version.major .Site.Params.version.minor }}
    {{- /**/ -}}
{{ end }}`;

// Determine the current version segment by regex matching the URL. This will either
// be "unstable", "latest", "vX.X" (production) or undefined (local & netlify).
const href = window.location.href;
const segmentMatches = href.match(/(?<=\/)unstable|latest|v\d+.\d+(?=\/)/);
const currentSegment = segmentMatches ? segmentMatches[0] : undefined;

// Determine the selected menu element. If we were able to obtain the version
// segment from the URL (production), use that. Otherwise (local & netlify),
// fall back to the version as defined in Hugo.
const selected = currentSegment ?? currentVersion;

function appendVersion(parent, name, url) {
    // The list item
    const li = document.createElement("li");
    if (name === selected) {
        li.classList.add("selected");
    }
    if (name === "latest") {
        li.classList.add("latest");
    }
    parent.appendChild(li);

    // The link
    const a = document.createElement("a");
    a.classList.add("dropdown-item");
    a.setAttribute("href", url);
    li.appendChild(a);

    // Handle clicks manually to preserve the current path / fragment
    a.addEventListener("click", (ev) => {
        // If the URL is a relative link (i.e. the historical versions changelog), just
        // let the browser load it
        if (url.startsWith("/")) {
            return;
        }

        // If we couldn't determine the current segment, we cannot safely replace
        // it and have to let the browser load the (root) URL instead
        if (!currentSegment) {
            return;
        }

        // Otherwise, stop further event handling and replace the segment
        ev.preventDefault();
        ev.stopPropagation();
        window.location.href = href.replace(`/${currentSegment}/`, `/${name}/`);
    });

    // The link text
    const text = document.createTextNode(name);
    a.appendChild(text);
}

// If we're in the unstable version, we're the latest thing and can just load
// versions.json from our own resources. Otherwise, we fall back to loading it
// from /unstable/versions.json, assuming we are on the spec.matrix.org deployment.
const url = currentVersion === "unstable"
    ? '{{ .Site.Home.Permalink }}versions.json'
    : "/unstable/versions.json";

fetch(url)
    .then(r => r.json())
    .then(versions => {
        // Find the surrounding list element
        const ul = document.querySelector("ul#version-selector");
        if (!ul) {
            console.error("Cannot populate version selector: ul element not found");
            return;
        }

        // Add a entries for the unstable version and the "latest" shortcut
        appendVersion(ul, "unstable", "https://spec.matrix.org/unstable");
        appendVersion(ul, "latest", "https://spec.matrix.org/latest");

        // Add an entry for each proper version
        for (const version of versions) {
            appendVersion(ul, version.name, `https://spec.matrix.org/${version.name}`);
        }

        // For historical versions, simply link to the changelog
        appendVersion(ul, "historical", '{{ (site.GetPage "changelog/historical").RelPermalink }}');
    });
