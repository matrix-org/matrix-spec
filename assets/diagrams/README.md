# Spec diagrams

Non-ascii diagrams for the spec can be placed here for reference in the actual spec.
Please include source material so the diagram can be recreated by a future editor.

https://www.diagrams.net/ is a great ([open source](https://github.com/jgraph/drawio))
tool for these sorts of things - include your `.drawio` file next to your diagram.

Suggested settings for diagrams.net:
* Export as WebP.
* 200% size.
* `20` for a border width.
* Light appearance.
* No shadow, or grid.

To reference a diagram, use the `diagram` shortcode. For example:

```
{{% diagram name="membership" alt="Diagram presenting the possible membership state transitions" %}}
```

Where `name` is the file name without extension, and `alt` is a textual
replacement for the image, useful for accessibility.
