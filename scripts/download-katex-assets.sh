#!/bin/bash
#
# Download the KaTeX fonts and CSS, and copy them into `static`.
set -e

root=$(dirname "$0")/..

# Check that the caller supplied a version.
version=$1
if [[ -z $1 || $1 = "-h" || $1 = "--help" ]]; then
    >&2 echo "Usage: download-katex-assets.sh VERSION (e.g. v0.16.23)"
    >&2 echo
    >&2 echo "Downloads KaTeX fonts and CSS from the specified release"
    >&2 echo "on GitHub and puts the files into static/."
    exit 1
fi

# Create a temporary directory and register a handler to clean it up on exit.
tmp_dir=$(mktemp -d)
clean_up () {
    rm -rf "$tmp_dir"
} 
trap clean_up EXIT

# Fetch the release archive.
archive=$tmp_dir/katex.tar.gz
url=https://github.com/KaTeX/KaTeX/releases/download/$version/katex.tar.gz
echo "GET $url"
curl -L --output "$archive" "$url"

# Unpack the archive.
tar -xzvf "$archive" -C "$tmp_dir"

# Move the CSS file into place.
install -vm644 "$tmp_dir/katex/katex.min.css" "$root/static/css/katex.min.css"

# Remove any existing fonts and move the new ones into place.
rm -rvf "$root"/static/css/fonts/KaTeX*
while read -r file; do
    install -vm644 "$file" "$root/static/css/fonts"
done < <(find "$tmp_dir/katex/fonts" -maxdepth 1 -name "KaTeX*.woff2")
