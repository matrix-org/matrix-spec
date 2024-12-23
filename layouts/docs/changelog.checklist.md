{{- /*

    Template to render a page with a `changelog` layout as a markdown checklist.

    This transforms the markdown source of the changelog to change list items,
    which in turn are them transformed into a rendered checklist.

    Stable releases will additionally have a table at the top of the page with
    information about the release, including:

    * A link to the matrix-spec repository at the time of the release, with the
      version taken from the `linkTitle` in the frontmatter of the page.
    * The date of the release, taken from the `date` in the frontmatter of the
      page.

*/ -}}

{{ $version := lower .LinkTitle -}}
# Matrix Specification {{ .Title }}

{{ if ne $version "unstable" -}}
{{- /*

    Most markdown parsers require the header to recognize a markdown table,
    so add an empty header.

*/ -}}
|   |   | 
|---|---|
| Git commit | {{ printf "https://github.com/matrix-org/matrix-spec/tree/%s" $version }} |
| Release date | {{ .Date | time.Format ":date_long" }} |
{{ end -}}

{{ .RawContent | replaceRE "\n- " "\n- [ ] " }}
