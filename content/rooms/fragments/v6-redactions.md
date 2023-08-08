
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
of the following event types:

-   [`m.room.member`](/client-server-api#mroommember) allows key `membership`.
-   [`m.room.create`](/client-server-api#mroomcreate) allows key `creator`.
-   [`m.room.join_rules`](/client-server-api#mroomjoin_rules) allows key `join_rule`.
-   [`m.room.power_levels`](/client-server-api#mroompower_levels) allows keys
    `ban`, `events`, `events_default`, `kick`, `redact`, `state_default`, `users`,
    `users_default`.
-   [`m.room.history_visibility`](/client-server-api#mroomhistory_visibility) allows
    key `history_visibility`.
