---
toc_hide: true
---

{{% added-in this=true %}} `m.room.member` events now keep `join_authorised_via_users_server`
in addition to other keys in `content` when being redacted.

{{% boxes/rationale %}}
Without the `join_authorised_via_users_server` property, redacted join events
can become invalid when verifying the auth chain of a given event, thus creating
a split-brain scenario where the user is able to speak from one server's
perspective but most others will continually reject their events.

This can theoretically be worked around with a rejoin to the room, being careful
not to use the faulty events as `prev_events`, though instead it is encouraged
to use v9 rooms over v8 rooms to outright avoid the situation.

[Issue #3373](https://github.com/matrix-org/matrix-doc/issues/3373) has further
information.
{{% /boxes/rationale %}}

The full redaction algorithm follows.

Upon receipt of a redaction event, the server must strip off any keys
not in the following list:

-   `event_id`
-   `type`
-   `room_id`
-   `sender`
-   `state_key`
-   `content`
-   `hashes`
-   `signatures`
-   `depth`
-   `prev_events`
-   `prev_state`
-   `auth_events`
-   `origin`
-   `origin_server_ts`
-   `membership`

The content object must also be stripped of all keys, unless it is one
of one of the following event types:

-   `m.room.member` allows keys `membership`, `join_authorised_via_users_server`.
-   `m.room.create` allows key `creator`.
-   `m.room.join_rules` allows keys `join_rule`, `allow`.
-   `m.room.power_levels` allows keys `ban`, `events`, `events_default`,
    `kick`, `redact`, `state_default`, `users`, `users_default`.
-   `m.room.history_visibility` allows key `history_visibility`.