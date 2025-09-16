
### Rich replies

Rich replies are a
special kind of [relationship](#forming-relationships-between-events) which
effectively quotes the referenced event for the client to render/process how
it wishes. They are normally used with [`m.room.message`](#mroommessage) events.

{{% boxes/note %}}
{{% changed-in v="1.3" %}}
Until v1.3 of the spec, rich replies were limited to `m.room.message` events
which could represent an HTML-formatted body. As of v1.3 this is now expanded
to *all* event types by dropping the requirement that an HTML-formatted body
be included.

Additionally, a rich reply can reference any other event type as of v1.3.
Previously, a rich reply could only reference another `m.room.message` event.
{{% /boxes/note %}}

{{% boxes/note %}}
{{% changed-in v="1.13" %}}
In previous versions of the specification, rich replies could include a fallback
representation of the original message message in the `body` (using a prefix
sequence) and `formatted_body` (using a custom HTML element) for clients that do
not support rich replies. This is no longer the case, but clients SHOULD still
remove this fallback before rendering the event.

To strip the fallback on the `body`, the client should iterate over each
line of the string, removing any lines that start with the fallback
prefix sequence (`> `, including the trailing space) and stopping when
a line is encountered without the prefix.

To strip the fallback on the `formatted_body` of an `m.room.message` event with
a `format` of `org.matrix.custom.html`: if the`formatted_body` begins with an
`<mx-reply>` start tag, the client  should remove the entirety of the
`<mx-reply>` element.
{{% /boxes/note %}}

Though rich replies form a relationship to another event, they do not
use `rel_type` to create this relationship. Instead, a subkey named `m.in_reply_to`
is used to describe the reply's relationship, leaving the other properties of
`m.relates_to` to describe the primary relationship of the event. This means
that if an event is simply in reply to another event, without further relationship,
the `rel_type` and `event_id` properties of `m.relates_to` become *optional*.

An example reply would be:

```json
{
  "content": {
    "m.relates_to": {
      "m.in_reply_to": {
        "event_id": "$another_event"
      }
    },
    "body": "That sounds like a great idea!"
  },
  // other fields as required by events
}
```

Note that the `event_id` of the `m.in_reply_to` object has the same requirements
as if it were to be under `m.relates_to` directly instead.

#### Mentioning the replied to user

In order to notify users of the reply, it MAY be desirable to include the `sender`
of the replied to event. See [user and room mentions](#user-and-room-mentions) for
additional information.

An example including mentioning the original sender:

```json
{
  "content": {
    "m.relates_to": {
      "m.in_reply_to": {
        "event_id": "$another_event"
      }
    },
    "body": "That sounds like a great idea!",
    "m.mentions": {
      "user_ids": [
        // The sender of $another_event.
        "@alice:example.org",
      ]
    }
  },
  // other fields as required by events
}
```
