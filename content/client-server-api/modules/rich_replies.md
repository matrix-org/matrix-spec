
### Rich replies

{{% changed-in v="1.3" %}}

Rich replies are a
special kind of [relationship](#forming-relationships-between-events) which
effectively quotes the referenced event for the client to render/process how
it wishes. They are normally used with [`m.room.message`](#mroommessage) events.

{{% boxes/note %}}
Until v1.3 of the spec, rich replies were limited to `m.room.message` events
which could represent an HTML-formatted body. As of v1.3 this is now expanded
to *all* event types by dropping the requirement that an HTML-formatted body
be included.

Additionally, a rich reply can reference any other event type as of v1.3.
Previously, a rich reply could only reference another `m.room.message` event.
{{% /boxes/note %}}

When possible, events SHOULD include a [fallback representation](#fallbacks-for-rich-replies)
to allow clients which do not render rich replies to still see something which
appears to be a quoted reply.

Though rich replies form a relationship to another event, they do not
use `rel_type` to create this relationship. Instead, a subkey named `m.in_reply_to`
is used to describe the reply's relationship, leaving the other properties of
`m.relates_to` to describe the primary relationship of the event. This means
that if an event is simply in reply to another event, without further relationship,
the `rel_type` and `event_id` properties of `m.relates_to` become *optional*.

An example reply would be:

```json5
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

#### Fallbacks for rich replies

Some clients may not have support for rich replies and therefore need a
fallback to use instead. Clients that do not support rich replies should
render the event as if rich replies were not special.

Clients that do support rich replies SHOULD provide the fallback format on
replies, and MUST strip the fallback before rendering the reply. The
specific fallback text is different for each `msgtype`, however the
general format for the `body` is:

```text
> <@alice:example.org> This is the first line of the original body
> This is the second line

This is where the reply goes
```

The `formatted_body`, if present and using an associated `format` of
`org.matrix.custom.html`, should use the following template:

```html
<mx-reply>
  <blockquote>
    <a href="https://matrix.to/#/!somewhere:example.org/$event:example.org">In reply to</a>
    <a href="https://matrix.to/#/@alice:example.org">@alice:example.org</a>
    <br />
    <!-- This is where the related event's HTML would be. -->
  </blockquote>
</mx-reply>
This is where the reply goes.
```

If the related event does not have a `formatted_body`, the event's
`body` should be considered after encoding any HTML special characters.
Note that the `href` in both of the anchors use a [matrix.to
URI](/appendices#matrixto-navigation).

##### Stripping the fallback

Clients which support rich replies MUST strip the fallback from the
event before rendering the event. This is because the text provided in
the fallback cannot be trusted to be an accurate representation of the
event. After removing the fallback, clients are recommended to represent
the event referenced by `m.in_reply_to` similar to the fallback's
representation, although clients do have creative freedom for their user
interface. Clients should prefer the `formatted_body` over the `body`,
just like with other `m.room.message` events.

To strip the fallback on the `body`, the client should iterate over each
line of the string, removing any lines that start with the fallback
prefix ("&gt; ", including the space, without quotes) and stopping when
a line is encountered without the prefix. This prefix is known as the
"fallback prefix sequence".

To strip the fallback on the `formatted_body`, the client should remove
the entirety of the `mx-reply` tag.

##### Fallback for `m.text`, `m.notice`, and unrecognised message types

Using the prefix sequence, the first line of the related event's `body`
should be prefixed with the user's ID, followed by each line being
prefixed with the fallback prefix sequence. For example:

```text
> <@alice:example.org> This is the first line
> This is the second line

This is the reply
```

The `formatted_body` uses the template defined earlier in this section.

##### Fallback for `m.emote`

Similar to the fallback for `m.text`, each line gets prefixed with the
fallback prefix sequence. However an asterisk should be inserted before
the user's ID, like so:

```text
> * <@alice:example.org> feels like today is going to be a great day

This is the reply
```

The `formatted_body` has a subtle difference for the template where the
asterisk is also inserted ahead of the user's ID:

```html
<mx-reply>
  <blockquote>
    <a href="https://matrix.to/#/!somewhere:example.org/$event:example.org">In reply to</a>
    * <a href="https://matrix.to/#/@alice:example.org">@alice:example.org</a>
    <br />
    <!-- This is where the related event's HTML would be. -->
  </blockquote>
</mx-reply>
This is where the reply goes.
```

##### Fallback for `m.image`, `m.video`, `m.audio`, and `m.file`

The related event's `body` would be a file name, which may not be very
descriptive. The related event should additionally not have a `format`
or `formatted_body` in the `content` - if the event does have a `format`
and/or `formatted_body`, those fields should be ignored. Because the
filename alone may not be descriptive, the related event's `body` should
be considered to be `"sent a file."` such that the output looks similar
to the following:

```text
> <@alice:example.org> sent a file.

This is the reply
```
```html
<mx-reply>
  <blockquote>
    <a href="https://matrix.to/#/!somewhere:example.org/$event:example.org">In reply to</a>
    <a href="https://matrix.to/#/@alice:example.org">@alice:example.org</a>
    <br />
    sent a file.
  </blockquote>
</mx-reply>
This is where the reply goes.
```

For `m.image`, the text should be `"sent an image."`. For `m.video`, the
text should be `"sent a video."`. For `m.audio`, the text should be
`"sent an audio file"`.

#### Mentioning the replied to user

In order to notify users of the reply, it may be desirable to include the `sender`
of the replied to event and any users mentioned in that event. See
[user and room mentions](#user-and-room-mentions) for additional information.

An example including mentioning the original sender and other users:

```json5
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
        // Another Matrix ID copied from the m.mentions property of $another_event.
        "@bob:example.org"
      ]
    }
  },
  // other fields as required by events
}
```
