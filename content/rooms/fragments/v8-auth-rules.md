
Events must be signed by the server denoted by the `sender` property.

The types of state events that affect authorization are:

-   [`m.room.create`](/client-server-api#mroomcreate)
-   [`m.room.member`](/client-server-api#mroommember)
-   [`m.room.join_rules`](/client-server-api#mroomjoin_rules)
-   [`m.room.power_levels`](/client-server-api#mroompower_levels)
-   [`m.room.third_party_invite`](/client-server-api#mroomthird_party_invite)

{{% boxes/note %}}
Power levels are inferred from defaults when not explicitly supplied.
For example, mentions of the `sender`'s power level can also refer to
the default power level for users in the room.
{{% /boxes/note %}}

{{% boxes/note %}}
`m.room.redaction` events are subject to auth rules in the same way as any other event.
In practice, that means they will normally be allowed by the auth rules, unless the
`m.room.power_levels` event sets a power level requirement for `m.room.redaction`
events via the `events` or `events_default` properties. In particular, the _redact
level_ is **not** considered by the auth rules.

The ability to send a redaction event does not mean that the redaction itself should
be performed. Receiving servers must perform additional checks, as described in
the [Handling Redactions](#handling-redactions) section.
{{% /boxes/note %}}

The rules are as follows:

1.  If type is `m.room.create`:
    1.  If it has any `prev_events`, reject.
    2.  If the domain of the `room_id` does not match the domain of the
        `sender`, reject.
    3.  If `content.room_version` is present and is not a recognised
        version, reject.
    4.  If `content` has no `creator` property, reject.
    5.  Otherwise, allow.
2.  Considering the event's `auth_events`:
    1.  If there are duplicate entries for a given `type` and `state_key` pair,
        reject.
    2.  If there are entries whose `type` and `state_key` don't match those
        specified by the [auth events
        selection](/server-server-api#auth-events-selection)
        algorithm described in the server specification, reject.
    3.  If there are entries which were themselves rejected under the [checks
        performed on receipt of a
        PDU](/server-server-api/#checks-performed-on-receipt-of-a-pdu), reject.
    4. If there is no `m.room.create` event among the entries, reject.
3. If the `content` of the `m.room.create` event in the room state has the
   property `m.federate` set to `false`, and the `sender` domain of the event
   does not match the `sender` domain of the create event, reject.
4.  If type is `m.room.member`:
    1.  If there is no `state_key` property, or no `membership` property in
        `content`, reject.
    2.  {{% added-in v=8 %}}
        If `content` has a `join_authorised_via_users_server` property:
        1.  If the event is not validly signed by the homeserver of the user ID denoted
            by the key, reject.
    3.  If `membership` is `join`:
        1.  If the only previous event is an `m.room.create` and the
            `state_key` is the creator, allow.
        2.  If the `sender` does not match `state_key`, reject.
        3.  If the `sender` is banned, reject.
        4.  If the `join_rule` is `invite` or `knock` then allow if
            membership state is `invite` or `join`.
        5.  {{% added-in v=8 %}}
            If the `join_rule` is `restricted`:
            1.  If membership state is `join` or `invite`, allow.
            2.  If the `join_authorised_via_users_server` key in `content`
                is not a user with sufficient permission to invite other
                users, reject.
            3.  Otherwise, allow.
        6.  If the `join_rule` is `public`, allow.
        7.  Otherwise, reject.
    4.  If `membership` is `invite`:
        1.  If `content` has a `third_party_invite` property:
            1.  If *target user* is banned, reject.
            2.  If `content.third_party_invite` does not have a `signed`
                property, reject.
            3.  If `signed` does not have `mxid` and `token` properties,
                reject.
            4.  If `mxid` does not match `state_key`, reject.
            5.  If there is no `m.room.third_party_invite` event in the
                current room state with `state_key` matching `token`,
                reject.
            6.  If `sender` does not match `sender` of the
                `m.room.third_party_invite`, reject.
            7.  If any signature in `signed` matches any public key in
                the `m.room.third_party_invite` event, allow. The public
                keys are in `content` of `m.room.third_party_invite` as:
                1.  A single public key in the `public_key` property.
                2.  A list of public keys in the `public_keys` property.
            8.  Otherwise, reject.
        2.  If the `sender`'s current membership state is not `join`,
            reject.
        3.  If *target user*'s current membership state is `join` or
            `ban`, reject.
        4.  If the `sender`'s power level is greater than or equal to
            the *invite level*, allow.
        5.  Otherwise, reject.
    5.  If `membership` is `leave`:
        1.  If the `sender` matches `state_key`, allow if and only if
            that user's current membership state is `invite`, `join`,
            or `knock`.
        2.  If the `sender`'s current membership state is not `join`,
            reject.
        3.  If the *target user*'s current membership state is `ban`,
            and the `sender`'s power level is less than the *ban level*,
            reject.
        4.  If the `sender`'s power level is greater than or equal to
            the *kick level*, and the *target user*'s power level is
            less than the `sender`'s power level, allow.
        5.  Otherwise, reject.
    6.  If `membership` is `ban`:
        1.  If the `sender`'s current membership state is not `join`,
            reject.
        2.  If the `sender`'s power level is greater than or equal to
            the *ban level*, and the *target user*'s power level is less
            than the `sender`'s power level, allow.
        3.  Otherwise, reject.
    7. If `membership` is `knock`:
        1.  If the `join_rule` is anything other than `knock`, reject.
        2.  If `sender` does not match `state_key`, reject.
        3.  If the `sender`'s current membership is not `ban`, `invite`,
            or `join`, allow.
        4.  Otherwise, reject.
    8.  Otherwise, the membership is unknown. Reject.
5.  If the `sender`'s current membership state is not `join`, reject.
6.  If type is `m.room.third_party_invite`:
    1.  Allow if and only if `sender`'s current power level is greater
        than or equal to the *invite level*.
7.  If the event type's *required power level* is greater than the
    `sender`'s power level, reject.
8.  If the event has a `state_key` that starts with an `@` and does not
    match the `sender`, reject.
9. If type is `m.room.power_levels`:
    1.  If the `users` property in `content` is not an object with keys that
        are valid user IDs with values that are integers (or a string
        that is an integer), reject.
    2.  If there is no previous `m.room.power_levels` event in the room,
        allow.
    3.  For the properties `users_default`, `events_default`, `state_default`,
        `ban`, `redact`, `kick`, `invite` check if they were added,
        changed or removed. For each found alteration:
        1.  If the current value is higher than the `sender`'s current
            power level, reject.
        2.  If the new value is higher than the `sender`'s current power
            level, reject.
    4.  For each entry being changed in, or removed from, the `events` or
        `notifications` properties:
        1.  If the current value is greater than the `sender`'s current
            power level, reject.
    5.  For each entry being added to, or changed in the `events` or
        `notifications` properties:
        1.  If the new value is greater than the `sender`'s current power
            level, reject.
    6.  For each entry being changed in, or removed from, the `users` property,
        other than the `sender`'s own entry:
        1.  If the current value is greater than or equal to the `sender`'s
            current power level, reject.
    7.  For each entry being added to, or changed in, the `users` property:
        1.  If the new value is greater than the `sender`'s current power
            level, reject.
    8. Otherwise, allow.
10. Otherwise, allow.

{{% boxes/note %}}
Some consequences of these rules:

-   Unless you are a member of the room, the only permitted operations
    (apart from the initial create/join) are: joining a public room;
    accepting or rejecting an invitation to a room.
-   To unban somebody, you must have power level greater than or equal
    to both the kick *and* ban levels, *and* greater than the target
    user's power level.
{{% /boxes/note %}}
