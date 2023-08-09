
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

-   [`m.room.member`](/client-server-api#mroommember) allows keys `membership`, `join_authorised_via_users_server`.
    Additionally, it allows the `signed` key of the `third_party_invite` key.
-   [`m.room.create`](/client-server-api#mroomcreate) allows all keys.
-   [`m.room.join_rules`](/client-server-api#mroomjoin_rules) allows keys `join_rule`, `allow`.
-   [`m.room.power_levels`](/client-server-api#mroompower_levels) allows keys
    `ban`, `events`, `events_default`, `invite`, `kick`, `redact`, `state_default`,
    `users`, `users_default`.
-   [`m.room.history_visibility`](/client-server-api#mroomhistory_visibility)
    allows key `history_visibility`.
-   [`m.room.redaction`](/client-server-api#mroomredaction) allows key `redacts`.