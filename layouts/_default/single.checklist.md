{{ .RawContent
    | replaceRE "\n- " "\n- [ ] "
    | replaceRE "<!--(.|\\s)*?-->\n?" ""
    | replaceRE "<tr><th>Checklist.*\n" "" }}
