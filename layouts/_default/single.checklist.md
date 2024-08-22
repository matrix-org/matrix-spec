{{ .RawContent | replaceRE "\n- " "\n- [ ] " | replaceRE "<!--(.|\\s)*?-->\n?" "" }}
