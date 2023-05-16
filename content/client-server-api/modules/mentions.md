
### User and room mentions

{{< changed-in v="1.7" >}}

This module allows users to "mention" other users and rooms within a room event.
This is primarily used as an indicator that the recipient should receive a notification
about the event.
This is achieved by including metadata in the `m.mentions` content property of
the event to reference the entity being mentioned.

`m.mentions` is defined as follows:

{{% definition path="api/client-server/definitions/m.mentions" %}}

Although it is possible to silently mention users, it is recommended to include a
[Matrix URI](/appendices/#uris) in the HTML body of  an [m.room.message](#mroommessage)
event. This applies only to [m.room.message](#mroommessage) events where the `msgtype` is
`m.text`, `m.emote`, or `m.notice`. The `format` for the event must be
`org.matrix.custom.html` and therefore requires a `formatted_body`.

Similarly, the entire room can be mentioned:

```json
{
    "body": "Hello @room!",
    "msgtype": "m.text",
    "format": "org.matrix.custom.html",
    "formatted_body": "Hello @room!",
    "m.mentions": {
        "room": true
    }
}
```

Additionally, see the [`.m.rule.is_user_mention`](#_m_rule_is_user_mention) and
[`.m.rule.is_room_mention`](#_m_rule_is_room_mention) push rules.
Users should not add their own Matrix ID to the `m.mentions` property as outgoing
messages cannot self-notify.

To disable legacy behaviour of notifications occurring due to matching against
the localpart of Matrix IDs and display names it is recommended that clients include
a `m.mentions` property on each event. If there are no mentions to include it can
be an empty object.

#### Client behaviour

In addition to using the appropriate `Matrix URI` for the mention,
clients should use the following guidelines when making mentions in
events to be sent:

-   When mentioning users, use the user's potentially ambiguous display
    name for the anchor's text. If the user does not have a display
    name, use the user's ID.
-   When mentioning rooms, use the canonical alias for the room. If the
    room does not have a canonical alias, prefer one of the aliases
    listed on the room. If no alias can be found, fall back to the room
    ID. In all cases, use the alias/room ID being linked to as the
    anchor's text.

The text component of the anchor should be used in the event's `body`
where the mention would normally be represented, as shown in the example
above.

Clients should display mentions differently from other elements. For
example, this may be done by changing the background color of the
mention to indicate that it is different from a normal link.

If the current user is mentioned in a message, the client should show that
mention differently from other mentions, such as by using a red
background color to signify to the user that they were mentioned.

When clicked, the mention should navigate the user to the appropriate
user or room information.
