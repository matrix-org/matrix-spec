### Delayed Events

{{% added-in v="1.20" %}}

This module allows clients to schedule events to be sent into a room by the homeserver
after a specific delay.

#### Client behaviour

Clients SHOULD consult the [`m.delayed_events`](#mdelayed_events-capability) capability before
attempting to use delayed events as the server MAY apply usage limits, including disabling delayed
events entirely. Depending on the server-side capability, clients MAY schedule delayed events via
[`PUT /rooms/{roomId}/delayed_event/{eventType}/{txnId}`](#put_matrixclientv3roomsroomiddelayed_eventeventtypetxnid).
This requires supplying a specific delay duration and, if successful, returns a unique identifier
for the delayed event. This identifier can be used to inspect and manage the delayed event using
one of the following endpoints:

- [`GET /delayed_events/{delayId}`](#get_matrixclientv1delayed_eventsdelayid) returns
  details of the delayed event.
- [`POST /delayed_events/{delayId}/send`](#post_matrixclientv1delayed_eventsdelayidsend)
  sends the delayed event immediately instead of waiting for its scheduled send time.
- [`POST /delayed_events/{delayId}/cancel`](#post_matrixclientv1delayed_eventsdelayidcancel)
  cancels the delayed event so that it is never sent.
- [`POST /delayed_events/{delayId}/restart`](#post_matrixclientv1delayed_eventsdelayidrestart)
  resets the delayed event's timer so that the delay starts anew.

{{% http-api spec="client-server" api="delayed_events" %}}

#### Server behaviour

##### Limits for scheduling delayed events

Homeservers MUST enforce a maximum allowed delay for delayed events as well as a limit on
the number of delayed events that a user can have scheduled at once. Both limits MUST be
advertised to clients via the [`m.delayed_events`](#mdelayed_events-capability) capability.
The exact limits to use are deliberately left as an implementation detail.

##### Sending delayed events

Homeservers MUST NOT send a delayed event before its scheduled send time, except in
response to a request to
[`POST /delayed_events/{delayId}/send`](#post_matrixclientv1delayed_eventsdelayidsend).
Homeservers MAY send a delayed event up to 30 seconds after its scheduled send time.

When a homeserver sends a delayed event, it MUST construct the final event based on the
state of the room at the time of sending rather than at the time of scheduling, as if the
client itself had sent the event. In particular, the homeserver MUST check that the event
is authorised to be sent based on the room state.

If a delayed event cannot be sent at its scheduled send time, for example because the
sender is no longer authorised to send it, the homeserver MUST cancel the delayed event
and store the error with it. This allows clients to retrieve the error via
[`GET /delayed_events/{delayId}`](#get_matrixclientv1delayed_eventsdelayid).

In addition to the rate limiting on the endpoints of this module, homeservers MUST also
apply rate limiting at the time of sending delayed events. If a delayed event cannot be
sent at its scheduled send time because of event sending rate limits, homeservers SHOULD
NOT retry sending it and instead cancel the delayed event.

The `delay_id` of a sent delayed event MUST be included in the `unsigned` data of the
resulting event if, and only if, the client that the event is served to is authenticated
as the event's sender.

Since a delayed event is uniquely identified by its sender and `delay_id`, the resulting
event SHOULD NOT include the [transaction ID](#transaction-identifiers) used to schedule
it in its `unsigned` data.

##### Retention of finalised delayed events

Homeservers SHOULD retain delayed events that have been sent or cancelled for up to 7 days
or up to 1000 events per user, whichever limit is reached first. This allows clients to retrieve
these events via [`GET /delayed_events/{delayId}`](#get_matrixclientv1delayed_eventsdelayid).
