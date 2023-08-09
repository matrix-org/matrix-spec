
### Event replacements

{{% added-in v="1.4" %}}

Event replacements, or "message edit events", are events that use an [event
relationship](#forming-relationships-between-events)
with a `rel_type` of `m.replace`, which indicates that the original event is
intended to be replaced.

An example of a message edit event might look like this:

```json
{
    "type": "m.room.message",
    "content": {
        "body": "* Hello! My name is bar",
        "msgtype": "m.text",
        "m.new_content": {
            "body": "Hello! My name is bar",
            "msgtype": "m.text"
        },
        "m.relates_to": {
            "rel_type": "m.replace",
            "event_id": "$some_event_id"
        }
    },
    // ... other fields required by events
}
```

The `content` of the replacement must contain a `m.new_content` property which
defines the replacement `content`. The normal `content` properties (`body`,
`msgtype` etc.) provide a fallback for clients which do not understand
replacement events.

`m.new_content` can include any properties that would normally be found in
an event's content property, such as `formatted_body` (see [`m.room.message`
`msgtypes`](#mroommessage-msgtypes)).

#### Validity of replacement events

There are a number of requirements on replacement events, which must be satisfied for the replacement to be considered valid:

 * As with all event relationships, the original event and replacement event
   must have the same `room_id` (i.e. you cannot send an event in
   one room and then an edited version in a different room).

 * The original event and replacement event must have the same `sender`
   (i.e. you cannot edit someone else's messages).

 * The replacement and original events must have the same `type` (i.e. you
   cannot change the original event's type).

 * The replacement and original events must not have a `state_key` property
   (i.e. you cannot edit state events at all).

 * The original event must not, itself, have a `rel_type` of `m.replace`
   (i.e. you cannot edit an edit — though you can send multiple edits for a
   single original event).

 * The replacement event (once decrypted, if appropriate) must have an
   `m.new_content` property.

If any of these criteria are not satisfied, implementations should ignore the
replacement event (the content of the original should not be replaced, and the
edit should not be included in the server-side aggregation).

Note that the [`msgtype`](#mroommessage-msgtypes) property of replacement
`m.room.message` events does *not* need to be the same as in the original event. For
example, it is legitimate to replace an `m.text` event with an `m.emote`.

#### Editing encrypted events

If the original event was [encrypted](#end-to-end-encryption), the replacement
should be too. In that case, `m.new_content` is placed in the content of the
encrypted payload. As with all event relationships, the `m.relates_to` property
must be sent in the unencrypted (cleartext) part of the event.

For example, a replacement for an encrypted event might look like this:

```json
{
    "type": "m.room.encrypted",
    "content": {
        "m.relates_to": {
            "rel_type": "m.replace",
            "event_id": "$some_event_id"
        },
        "algorithm": "m.megolm.v1.aes-sha2",
        "sender_key": "<sender_curve25519_key>",
        "device_id": "<sender_device_id>",
        "session_id": "<outbound_group_session_id>",
        "ciphertext": "<encrypted_payload_base_64>"
    }
    // irrelevant fields not shown
}
```

... and, once decrypted, the payload might look like this:

```json
{
    "type": "m.room.<event_type>",
    "room_id": "!some_room_id",
    "content": {
        "body": "* Hello! My name is bar",
        "msgtype": "m.text",
        "m.new_content": {
            "body": "Hello! My name is bar",
            "msgtype": "m.text"
        }
    }
}
```

Note that:

 * There is no `m.relates_to` property in the encrypted payload. If there was, it would be ignored.
 * There is no `m.new_content` property in the cleartext content of the `m.room.encrypted` event. As above, if there was then it would be ignored.

{{% boxes/note %}}
The payload of an encrypted replacement event must be encrypted as normal, including
ratcheting any [Megolm](#mmegolmv1aes-sha2) session as normal. The original Megolm
ratchet entry should **not** be re-used.
{{% /boxes/note %}}


#### Applying `m.new_content`

When applying a replacement, the `content` of the original event is treated as
being overwritten entirely by `m.new_content`, with the exception of `m.relates_to`,
which is left *unchanged*. Any `m.relates_to` property within `m.new_content`
is ignored.

For example, given a pair of events:

```json
{
    "event_id": "$original_event",
    "type": "m.room.message",
    "content": {
        "body": "I really like cake",
        "msgtype": "m.text",
        "formatted_body": "I really like cake",
    }
}
```

```json
{
    "event_id": "$edit_event",
    "type": "m.room.message",
    "content": {
        "body": "* I really like *chocolate* cake",
        "msgtype": "m.text",
        "m.new_content": {
            "body": "I really like *chocolate* cake",
            "msgtype": "m.text",
            "com.example.extension_property": "chocolate"
        },
        "m.relates_to": {
            "rel_type": "m.replace",
            "event_id": "$original_event_id"
        }
    }
}
```

... then the end result is an event as shown below:

```json
{
    "event_id": "$original_event",
    "type": "m.room.message",
    "content": {
        "body": "I really like *chocolate* cake",
        "msgtype": "m.text",
        "com.example.extension_property": "chocolate"
    }
}
```

Note that `formatted_body` is now absent, because it was absent in the
replacement event.

#### Server behaviour

##### Server-side aggregation of `m.replace` relationships

{{< changed-in v="1.7" >}}

Note that there can be multiple events with an `m.replace` relationship to a
given event (for example, if an event is edited multiple times). These should
be [aggregated](#aggregations-of-child-events) by the homeserver.

The aggregation format of `m.replace` relationships gives the **most recent**
replacement event, formatted [as normal](#room-event-format).

The most recent event is determined by comparing `origin_server_ts`; if two or
more replacement events have identical `origin_server_ts`, the event with the
lexicographically largest `event_id` is treated as more recent.

As with any other aggregation of child events, the `m.replace` aggregation is
included under the `m.relations` property in `unsigned` for any event that is
the target of an `m.replace` relationship. For example:

```json
{
  "event_id": "$original_event_id",
  "type": "m.room.message",
  "content": {
    "body": "I really like cake",
    "msgtype": "m.text",
    "formatted_body": "I really like cake"
  },
  "unsigned": {
    "m.relations": {
      "m.replace": {
        "event_id": "$latest_edit_event_id",
        "origin_server_ts": 1649772304313,
        "sender": "@editing_user:localhost"
        "type": "m.room.message",
        "content": {
          "body": "* I really like *chocolate* cake",
          "msgtype": "m.text",
          "m.new_content": {
            "body": "I really like *chocolate* cake",
            "msgtype": "m.text"
          },
          "m.relates_to": {
            "rel_type": "m.replace",
            "event_id": "$original_event_id"
          }
        }
      }
    }
  }
  // irrelevant fields not shown
}
```

If the original event is [redacted](#redactions), any
`m.replace` relationship should **not** be bundled with it (whether or not any
subsequent replacements are themselves redacted). Note that this behaviour is
specific to the `m.replace` relationship. See also [redactions of edited
events](#redactions-of-edited-events) below.

**Note:** the `content` of the original event is left intact. In particular servers
should **not** replace the content with that of the replacement event.

{{% boxes/rationale %}}
In previous versions of the specification, servers were expected to replace the
content of an edited event whenever it was served to clients (with the
exception of the
[`GET /_matrix/client/v3/rooms/{roomId}/event/{eventId}`](#get_matrixclientv3roomsroomideventeventid)
endpoint).  However, that behaviour made reliable client-side implementation
difficult, and servers should no longer make this replacement.
{{% /boxes/rationale %}}

#### Client behaviour

Since the server will not replace the content of any edited events, clients
should take note of any replacement events they receive, and apply the
replacement whenever possible and appropriate.

Client authors are reminded to take note of the requirements for [Validity of
replacement events](#validity-of-replacement-events), and to ignore any
invalid replacement events that are received.

##### Permalinks

When creating [links](/appendices/#uris) to events (also known as permalinks),
clients build links which reference the event that the creator of the permalink
is viewing at that point (which might be a message edit event).

The client viewing the permalink should resolve this reference to the original
event, and then display the most recent version of that event.

#### Redactions of edited events

When an event using a `rel_type` of `m.replace` is [redacted](#redactions), it
removes that edit revision. This has little effect if there were subsequent
edits. However, if it was the most recent edit, the event is in effect
reverted to its content before the redacted edit.

Redacting the *original* message in effect removes the message, including all
subsequent edits, from the visible timeline. In this situation, homeservers
will return an empty `content` for the original event as with any other
redacted event, and as
[above](#server-side-aggregation-of-mreplace-relationships) the replacement
events will not be included in the aggregation bundled with the original
event. Note that the subsequent edits are not actually redacted themselves:
they simply serve no purpose within the visible timeline.

#### Edits of events with mentions

When editing an event with [user and room mentions](#user-and-room-mentions) the
replacement event will have two `m.mentions` properties:

* One at the top-level of the `content`, which should contain mentions due to
  this edit revision.
* One inside the `m.new_content` property, which should contain the resolved mentions
  for the final version of the event.

The difference between these properties ensures that users will not be notified
for each edit revision of an event, but allows for new users to be mentioned (or
for re-notifying if the sending client feels a large enough revision was made).

For example, if there is an event mentioning Alice:

```json5
{
    "event_id": "$original_event",
    "type": "m.room.message",
    "content": {
        "body": "Hello Alice!",
        "m.mentions": {
            "user_ids": ["@alice:example.org"]
        }
    }
}
```

And an edit to also mention Bob:

```json5
{
  "content": {
    "body": "* Hello Alice & Bob!",
    "m.mentions": {
      "user_ids": [
        // Include only the newly mentioned user.
        "@bob:example.org"
      ]
    },
    "m.new_content": {
      "body": "Hello Alice & Bob!",
      "m.mentions": {
        "user_ids": [
          // Include all of the mentioned users.
          "@alice:example.org",
          "@bob:example.org"
        ]
      },
    },
    "m.relates_to": {
      "rel_type": "m.replace",
      "event_id": "$original_event"
    }
  },
  // other fields as required by events
}
```

If an edit revision removes a user's mention then that user's Matrix ID should be
included in neither `m.mentions` property.

Clients may also wish to modify the [client behaviour](#user-and-room-mentions) of
determining if an event mentions the current user by checking the `m.mentions`
property under `m.new_content`.

#### Edits of replies

Some particular constraints apply to events which replace a
[reply](#rich-replies). In particular:

 * In contrast to the original reply, there should be no `m.in_reply_to`
   property in the the `m.relates_to` object, since it would be redundant (see
   [Applying `m.new_content`](#applying-mnew_content) above, which notes that
   the original event's `m.relates_to` is preserved), as well as being contrary
   to the spirit of the event relationships mechanism which expects only one
   "parent" per event.

 * `m.new_content` should **not** contain any [reply
   fallback](#fallbacks-for-rich-replies),
   since it is assumed that any client which can handle edits can also display
   replies natively. However, the `content` of the replacement event should provide
   fallback content for clients which support neither rich replies nor edits.

An example of an edit to a reply is as follows:

```json
{
  "type": "m.room.message",
  // irrelevant fields not shown
  "content": {
    "body": "> <@alice:example.org> question\n\n* reply",
    "msgtype": "m.text",
    "format": "org.matrix.custom.html",
    "formatted_body": "<mx-reply><blockquote><a href=\"https://matrix.to/#/!somewhere:example.org/$event:example.org\">In reply to</a> <a href=\"https://matrix.to/#/@alice:example.org\">@alice:example.org</a><br />question</blockquote></mx-reply>* reply",
    "m.new_content": {
      "body": "reply",
      "msgtype": "m.text",
      "format": "org.matrix.custom.html",
      "formatted_body": "reply"
    },
    "m.relates_to": {
      "rel_type": "m.replace",
      "event_id": "$original_reply_event"
    }
  }
}
```
