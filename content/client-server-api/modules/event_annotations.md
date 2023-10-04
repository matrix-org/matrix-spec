### Event annotations and reactions

{{% added-in v="1.7" %}}

#### `m.annotation` relationship type

Annotations are events that use an [event
relationship](#forming-relationships-between-events) with a `rel_type` of
`m.annotation`.

Annotations are normally used for "reactions": for example, if the user wants
to react to an event with a thumbs-up, then the client sends an annotation
event with the corresponding emoji (👍). Another potential usage is to allow
bots to send an event indicating the success or failure of a command.

Along with the normal properties `event_id` and `rel_type`, an `m.relates_to`
property with `rel_type: m.annotation` should contain a `key` that indicates the
annotation being applied. For example, when reacting with emojis, the key
contains the emoji being used.

An example `m.annotation` relationship is shown below:

```json
"m.relates_to": {
    "rel_type": "m.annotation",
    "event_id": "$some_event_id",
    "key": "👍"
}
```

{{% boxes/note %}}
Any `type` of event is eligible for an annotation, including state events.
{{% /boxes/note %}}

#### Events

{{% event event="m.reaction" %}}

#### Client behaviour {id="annotations-client-behaviour"}

The intention of annotations is that they are counted up, rather than being
displayed individually.  Clients must keep count of the number of annotations
with a given event `type` and annotation `key` they observe for each event;
these counts are typically presented alongside the event in the timeline.

When performing this count:

 * Each event `type` and annotation `key` should normally be counted
   separately, though whether to actually do so is an implementation decision.

 * Annotation events sent by [ignored users](#ignoring-users) should be
   excluded from the count.

 * Multiple identical annotations (i.e., with the same event `type` and
   annotation `key`) from the same user (i.e., events with the same `sender`)
   should be treated as a single annotation.

 * Implementations should ignore any annotation event which refers to an event
   which itself has an `m.relates_to` with `rel_type: m.annotation` or
   `rel_type: m.replace`. In other words, it is not possible to annotate a
   [replacement event](#event-replacements) or an annotation.  Annotations should
   instead refer to the original event.

 * When an annotation is redacted, it is removed from the count.

{{% boxes/note %}}
It is not possible to edit a reaction, since replacement events do not change
`m.relates_to` (see [Applying `m.new_content`](#applying-mnew_content)), and
there is no other meaningful content within `m.reaction`.  If a user wishes to
change their reaction, the original reaction should be redacted and a new one
sent in its place.
{{% /boxes/note %}}

{{% boxes/note %}}
The `key` field in `m.reaction` can be any string so clients must take care to
render long reactions in a sensible manner. For example, clients can elide
overly-long reactions.
{{% /boxes/note %}}

#### Server behaviour

##### Avoiding duplicate annotations

Homeservers should prevent users from sending a second annotation for a given
event with identical event `type` and annotation `key` (unless the first event
has been redacted).

Attempts to send such an annotation should be rejected with a 400 error and an
error code of `M_DUPLICATE_ANNOTATION`.

Note that this does not guarantee that duplicate annotations will not arrive
over federation. Clients are responsible for deduplicating received
annotations when [counting annotations](#annotations-client-behaviour).

##### Server-side aggregation of `m.annotation` relationships

`m.annotation` relationships are *not*
[aggregated](#aggregations-of-child-events) by the server. In other words,
`m.annotation` is not included in the `m.relations` property.
