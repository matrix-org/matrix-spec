
### Reference relations

{{% added-in v="1.5" %}}

Generically referencing another event can be done with a `rel_type` of `m.reference`
as a form of [relationship](#forming-relationships-between-events). There is no
implied meaning behind the reference, and is usually context-dependent. One
example is the [key verification framework](#key-verification-framework) which uses
reference relations to associate distinct events with a specific verification attempt.

{{% boxes/note %}}
Clients which wish to use threads or replies are expected to use other relationship
types than references. References are typically used to associate data rather than
messages.
{{% /boxes/note %}}

#### Server behaviour

##### Server-side aggregation of `m.reference`

The [aggregation](#aggregations-of-child-events) format of `m.reference`
relations consists of a single `chunk` property, which lists all the events
which `m.reference` the event (the parent). Currently, only a single `event_id`
field is present on the events in the `chunk`.

For example, given an event with the following `m.reference` relationship:

```json
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

The aggregation would appear similar to the following:

```json
{
  "m.reference": {
    "chunk": [
      { "event_id": "$one" },
      { "event_id": "$two" }
    ]
  }
}
```
