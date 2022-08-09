---
type: module
---

### Reference relations

{{% added-in v="1.4" %}}

Generically referencing another event can be done with a `rel_type` of `m.reference`
as a form of [relationship](#forming-relationships-between-events). There is no
implied meaning behind the reference, and is usually context-dependent. Such an
example is the [key verification framework](#key-verification-framework) which uses
reference relations to associate distinct events with a specific verification attempt.

When bundled, a reference relations appear as an object with a `chunk` field to
indicate all the events which `m.reference` the event (the parent). Currently,
only a single `event_id` field is present on the events in the `chunk`.

{{% boxes/note %}}
Clients which wish to use threads or replies are expected to use other relationship
types than references. References are typically used to associate data rather than
messages.
{{% /boxes/note %}}

An example `m.reference` would be:

```json5
{
  "content": {
    "m.relates_to": {
      "rel_type": "m.reference",
      "event_id": "$another_event"
    }
    // other content fields as required
  }
  // other fields as required by events
}
```

The [bundle](#aggregations) under `m.relations` would appear similar to the following:

```json5
{
  "m.reference": {
    "chunk": [
      { "event_id": "$one" },
      { "event_id": "$two" }
    ]
  }
}
```
