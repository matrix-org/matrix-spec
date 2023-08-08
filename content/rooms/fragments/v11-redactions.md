---
---

{{% added-in this=true %}} The top-level `origin`, `membership`, and `prev_state` properties
are no longer protected from redaction. The `m.room.create` event now keeps the entire `content` property. The `m.room.redaction` event keeps the
`redacts` property under `content`. The `m.room.power_levels` event keeps the `invite` property
under `content`.

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
-   `auth_events`
-   `origin_server_ts`

The content object must also be stripped of all keys, unless it is one
of the following event types:

-   `m.room.member` allows keys `membership`, `join_authorised_via_users_server`.
    Additionally, it allows the `signed` key of the `third_party_invite` key.
-   `m.room.create` allows all keys.
-   `m.room.join_rules` allows keys `join_rule`, `allow`.
-   `m.room.power_levels` allows keys `ban`, `events`, `events_default`,
    `invite`, `kick`, `redact`, `state_default`, `users`, `users_default`.
-   `m.room.history_visibility` allows key `history_visibility`.
-   `m.room.redaction` allows key `redacts`.