
### User and room mentions

{{% changed-in v="1.7" %}}

{{% changed-in v="1.17" %}}: the legacy push rules that looked for mentions in
the `body` of the event were removed.

This module allows users to "mention" other users and rooms within a room event.
This is primarily used as an indicator that the recipient should receive a notification
about the event.
This is achieved by including metadata in the `m.mentions` content property of
the event to reference the entity being mentioned.

`m.mentions` is defined as follows:

{{% definition path="api/client-server/definitions/m.mentions" %}}

An event's content will then look like this:

```json
{
    "body": "Hello Alice!",
    "msgtype": "m.text",
    "format": "org.matrix.custom.html",
    "formatted_body": "Hello <a href='https://matrix.to/#/@alice:example.org'>Alice</a>!",
    "m.mentions": {
        "user_ids": ["@alice:example.org"]
    }
}
```

Additionally, see the [`.m.rule.is_user_mention`](#_m_rule_is_user_mention) and
[`.m.rule.is_room_mention`](#_m_rule_is_room_mention) push rules.
Users should not add their own Matrix ID to the `m.mentions` property as outgoing
messages cannot self-notify.

{{% boxes/warning %}}
If an encrypted event contains an `m.mentions` in its payload, it should be
encrypted as normal. To properly process mentions in encrypted rooms, events
must be decrypted first. See [receiving notifications](#receiving-notifications).
{{% /boxes/warning %}}

{{% boxes/note %}}
In previous versions of the specification, mentioning users was done by
including the user's display name or the localpart of their Matrix ID and room
mentions were done by including the string "@room" in the plaintext `body` of
the event. When the `m.mentions` field was introduced, those push rules were
disabled if the `m.mentions` field was present.

To avoid unintentional notifications with clients and servers that still use
those push rules, **it is recommended that clients still include a `m.mentions`
property on each event**. (If there are no mentions to include it can be an
empty object.)
{{% /boxes/note %}}

#### Client behaviour

Although it is possible to silently mention users, it is recommended to include a
[Matrix URI](/appendices/#uris) in the HTML body of  an [m.room.message](#mroommessage)
event. This applies only to [m.room.message](#mroommessage) events where the `msgtype` is
`m.text`, `m.emote`, or `m.notice`. The `format` for the event must be
`org.matrix.custom.html` and therefore requires a `formatted_body`.

Clients should use the following guidelines when adding a `Matrix URI`
representing a mention to events to be sent:

-   When linking to users, use the user's potentially ambiguous display
    name for the anchor's text. If the user does not have a display
    name, use the user's ID.
-   When linking to rooms, use the canonical alias for the room. If the
    room does not have a canonical alias, prefer one of the aliases
    listed on the room. If no alias can be found, fall back to the room
    ID. In all cases, use the alias/room ID being linked to as the
    anchor's text.

The text component of the anchor should be used in the event's `body`
where the link would normally be represented, as shown in the example
above.

Clients should display mentions differently from other elements. For
example, this may be done by changing the background color of the
mention to indicate that it is different from a normal link.

If the current user is mentioned in a message, the client should show that
mention differently from other mentions, such as by using a red
background color to signify to the user that they were mentioned. Note that
it is possible for a user to be mentioned without including their `Matrix URI`
in the event.

When clicked, the mention should navigate the user to the appropriate
user or room information.
