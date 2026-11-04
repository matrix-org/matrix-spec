
### Sticky Events

{{% added-in v="1.20" %}}

Sticky events are a primitive that allows clients to share temporary state
within a room without having to rely on state events. A sticky event is a
message event which is "stuck" to the room timeline (like a sticky note stuck
to a screen) for a limited amount of ime. During this time, the event is reliably
delivered to all joined users and servers regardless of gaps in syncing.

#### Client behaviour

##### Sending sticky events

Clients MAY send sticky events by setting the `sticky_duration_ms` query
parameter on [`PUT /_matrix/client/v3/rooms/{roomId}/send/{eventType}/{txnId}`](#put_matrixclientv3roomsroomidsendeventtypetxnid)
to the desired sticky duration in milliseconds.

Since servers expire sticky events [after at most one hour](#determining-whether-an-event-is-sticky),
clients need to send new events if they require more than one hour of stickiness.

Clients MAY [encrypt](#end-to-end-encryption) sticky events like any other
message events.

##### Receiving sticky events

Clients receive sticky events like other regular message events over the
various endpoints that return events. Additionally, the response of
[`/sync`](#get_matrixclientv3sync) includes unexpired sticky events that
fall outside the timeline limit, as described in [Extensions to /sync](#sticky-events-extensions-to-sync).

Within the [event format](#room-event-format) of every room version, a message
event is marked as sticky by a top-level `sticky` object with a `duration_ms`
property that contains the total sticky duration requested by the sender. Unexpired
sticky events additionally include a `sticky_duration_remaining_ms` property in
their `unsigned` object which indicates how many milliseconds remain until the
stickiness expires.

```json
{
  "type": "org.example.event",
  "sticky": {
    "duration_ms": 600000
  },
  "sender": "@alice:example.com",
  "room_id": "!foo:example.com",
  "origin_server_ts": 1757920344000,
  "content": { ... },
  "unsigned": {
    "sticky_duration_remaining_ms": 289170
  }
}
```

{{% boxes/warning %}}
The [expiry calculation](#determining-whether-an-event-is-sticky) for sticky
events depends on the server-side time of receipt which is unknown to clients.
Therefore, clients MUST use the value of `sticky_duration_remaining_ms`, rather
than `origin_server_ts` and `sticky.duration_ms`, to determine when a sticky
event expires.
{{% /boxes/warning %}}

##### Redacting sticky events

The `sticky` property is not protected from redaction. As a result, an event's
stickiness is lost when it is redacted. This can create divergence between clients
that have received the redaction (and stopped treating the event as sticky) and
clients that have not yet received the redaction (and still treat the event as
sticky). To avoid this, clients SHOULD NOT redact sticky events unless they send
the `m.room.redaction` event itself as a sticky event with a sticky duration at
least as large as the sticky duration of the event being redacted.

##### Building ephemeral state-like maps

In order to enable clients to use sticky events to share temporary state within
a room, a generic algorithm to build state-like maps of sticky events is defined
in the following. Clients are _not_ required to implement this algorithm outside
of features in this specification that use the algorithm.

Events are only considered for the ephemeral map if they have a top-level property
`sticky_key` of type string in their `content` object.

```json
{
    "type": "org.example.event",
    "sticky": {
        "duration_ms": 300000
    },
    "sender": "@alice:example.com",
    "room_id": "!foo:example.com",
    "origin_server_ts": 1757920344000,
    "content": {
        "sticky_key": "LAPTOPXX123",
        ...
    }
}
```

Clients that receive such events, MUST store them in a local map, keyed by the
4-tuple `(room_id, sender, type, content.sticky_key)`. 

{{% boxes/note %}}
Note that `type` in the key tuple of the ephemeral map is the event type _after_
decryption.
{{% /boxes/note %}}

Adding events into the map will result in collisions when the same user sends
multiple events with the same event type and `sticky_key` into a room. To
deterministically tie-break between such events, clients MUST perform the
following steps:

1. Pick the event with the highest `origin_server_ts + sticky.duration_ms`.
   (This is the event that the sender's homeserver has intended to expire last.)
2. If there is still a tie, pick the event with the highest event ID when
   compared lexicographically (`A` < `Z`).

When clients send multiple events with the same event type and `sticky_key`,
they SHOULD use at least the same sticky duration as the previous sticky event.
Otherwise, an event with a shorter duration may never replace the previous event
on other clients, as it has a lower intended expiry time and loses the tie-break.

{{% boxes/note %}}
The algorithm deliberately doesn't tie-break based on the order in which sticky
events were returned by `/sync` as this order may not match the order in which the
events were sent.
{{% /boxes/note %}}

{{% boxes/warning %}}
If a client sends two sticky events with the same event type and `sticky_key`
in the same millisecond, the second event may unintentionally be replaced by
the first if the first event has the higher event ID. To protect against this,
clients SHOULD wait at least one millisecond between sending sticky events with the
same event type and `sticky_key`.
{{% /boxes/warning %}}

Clients SHOULD expire sticky events in the map when their remaining sticky
duration, as given by `unsigned.sticky_duration_remaining_ms`, has elapsed.

To invalidate an entry in the map before its scheduled expiry, clients SHOULD
send another sticky event with the same event type and `sticky_key` but all
other application-specific properties omitted. Alternatively, clients MAY
redact the event but SHOULD send the redaction itself as a sticky event as
described [previously](#redacting-sticky-events).

Clients MAY implement access control in the map based on the room's power
levels. If they do so, they MUST accept all writes to the map, regardless
of whether the sender was authorised and MUST only decide whether or not to
use a given map entry based on the current power levels at that time.

{{% boxes/note %}}
To understand why this is required, consider the case where Alice sets a key
which requires power level 100 concurrently with being granted power level 100.
Clients which see the write before the power levels change would otherwise
discard it, whereas clients which see the power levels change first would
accept it. By always updating the map, the arrival order does not affect the
end result.
{{% /boxes/note %}}

#### Server behaviour

##### Determining whether an event is sticky

Servers MUST use the following steps to calculate whether a sticky event is
still sticky:

1. Calculate the start time as `min(received_ts, origin_server_ts)`, where
   `received_ts` is the server's own clock at the instant the event
   was received over the network, or created locally.
2. Calculate the end time as `start_time + min(sticky.duration_ms, 3_600_000)`.
3. If the end time is in the future, the event remains sticky. Otherwise it
   has expired.

##### Delivery

When exposing an unexpired sticky event to clients through any Client-Server
API endpoint, servers MUST set the `sticky_duration_remaining_ms` property in
the event's `unsigned` object to the remaining time in milliseconds until
the server considers the event to be expired. For sticky events that have
expired, servers MUST omit the `sticky_duration_remaining_ms` property.

Servers MUST NOT apply [history visibility](#room-history-visibility) checks
to unexpired sticky events. This ensures that newly joined users and servers
can see sticky events sent before they joined the room, regardless of the history
visibility setting.

Servers MUST apply [Policy Servers](#policy-servers) and similar
homeserver-specific anti-spam techniques, for example custom spam checker
modules, to sticky events. If any of these techniques classifies a sticky
event as spam, the event MUST be treated as a regular non-sticky event.

##### Rate limiting

Since unexpired sticky events are sent to clients regardless of the timeline
limit, care needs to be taken to ensure that other room participants cannot
send large volumes of sticky events.

Servers MAY limit the number of unexpired sticky events per sender. If a sender
exceeds the server's limit, the server MAY expire the sender's existing sticky
events, oldest first, to ensure that no more than the limit are unexpired at any
given point.

Additionally, servers MAY apply rate limits to local users sending sticky events
at a high rate on the Client-Server API, for instance by using the existing
[`M_LIMIT_EXCEEDED`](#rate-limiting) error response. For cases of extreme
load, servers MAY use normal load-shedding mechanisms, such as responding to
`/send` with a non-`200` response code to cause the sender to back off.

#### Protocol definitions

##### Extensions to /sync {#sticky-events-extensions-to-sync}

This module adds the following property to the
[Joined Room](#get_matrixclientv3sync_response-200_joined-room) section of
the [`/sync`](#get_matrixclientv3sync) response:

| Parameter | Type   | Description                                                                                            |
|-----------|--------|--------------------------------------------------------------------------------------------------------|
| sticky    | Sticky | Optional. Unexpired sticky events in the room which occurred before the first event in the `timeline.events` section. |


`Sticky`

| Parameter | Type                                             | Description                                    |
|-----------|--------------------------------------------------|------------------------------------------------|
| events    | [[ClientEventWithoutRoomID](#room-event-format)] | **Required.** List of unexpired sticky events. |

Example response:

```json
{
  "next_batch": "s72595_4483_1934",
  "rooms": {
    "join": {
      "!726s6s6q:example.com": {
        "timeline": { ... },
        "sticky": {
          "events": [{
            "event_id": "$143273582443QsuJk:example.org",
            "type": "org.example.event",
            "sticky": {
              "duration_ms": 600000
            },
            "sender": "@example:example.org",
            "origin_server_ts": 1432735824653,
            "content": { ... },
            "unsigned": {
              "age": 341830,
              "sticky_duration_remaining_ms": 258170
            }
          }]
        }
      }
    }
  }
}
```

Servers MUST ensure that unexpired sticky events outside the `timeline` limit
are delivered to clients via the `sticky.events` section. If there are too
many unexpired sticky events to deliver at once, servers MAY spread them over
several subsequent `/sync` responses. A RECOMMENDED limit is 100 sticky events
per response.

When a user joins a room, the server MUST include all unexpired sticky
events of that room in their subsequent `/sync` response(s).

If a sticky event appears in the `timeline.events` section of a response, it
MUST NOT be included in the `sticky.events` section of that response. The `state`
and `timeline` properties of the [`RoomFilter`](#post_matrixclientv3useruseridfilter_request_roomfilter)
MUST NOT be applied to the `sticky.events` section. However, the `timeline` filter
MUST be applied before applying the de-duplication between the `timeline.events`
and `sticky.events` sections. In other words, if a sticky event would normally
appear in both the `timeline.events` and the `sticky.events` section, but is
filtered out by the `timeline` filter, the sticky event MUST appear in `sticky.events`.

Where technically feasible, servers SHOULD avoid delivering the same sticky
event in the `timeline.events` section of one `/sync` response and then again
in the `sticky.events` section of a later `/sync` response, or vice versa.
As this may not always be possible, clients MUST tolerate such behaviour and
SHOULD de-duplicate these events based on their event ID.

Apart from this, sticky events follow the same "stream-like" behaviour as the
`timeline.events` section. This means clients receive a given sticky event only
once and subsequent requests with an advanced `since` token do not return the
same sticky event again.

Events in the `sticky.events` section MUST still be sticky, meaning they MUST
have a positive `unsigned.sticky_duration_remaining_ms` property. Servers should
take care that timing issues, such as sticky events expiring during request
processing, or response caching do not break this property.

Servers MUST omit sticky events sent by [ignored users](#ignoring-users)
from the `sticky.events` section.

Servers MUST treat sticky events the same as timeline events for the
purposes of calculating which [lazy-loaded membership
events](#lazy-loading-room-members) to include in the response.
