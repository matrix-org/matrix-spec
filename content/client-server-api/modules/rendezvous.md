
### Rendezvous Sessions

{{% added-in v="1.20" %}}

This module allows two devices to establish an ephemeral, bi-directional
communication session via a homeserver, over which they can exchange small
amounts of data. The name "rendezvous" is used because the session is the
designated place where the two devices meet.

A rendezvous session provides neither end-to-end confidentiality nor
authenticity by itself. Protocols which make use of a rendezvous session are
responsible for layering these properties on top of it where they are needed.

Support for this module is optional for homeservers. A homeserver which does
not offer rendezvous sessions responds to the endpoints of this module with a
`404` HTTP status code and an `errcode` of `M_UNRECOGNIZED`, as it would for any
other endpoint that it does not implement.

#### Overview {id="rendezvous-sessions-overview"}

Suppose that Device A wants to establish communications with Device B. Device A
can do so by creating a *rendezvous session* via a call to
[`POST /_matrix/client/v1/rendezvous`](#post_matrixclientv1rendezvous) on an
appropriate homeserver. The response includes a *rendezvous ID* which, along
with the [base URL](#getwell-knownmatrixclient) of the homeserver, Device A
then shares with Device B by some out-of-band means.

The rendezvous ID points to a piece of arbitrary data on the homeserver, called
the *payload*, which is initially populated using the data from Device A's
`POST` request. The payload is a string of limited size.

Anyone who is able to reach the homeserver and who has the rendezvous ID,
whether that is Device A, Device B or a third party, can then *receive* the
payload by polling
[`GET /_matrix/client/v1/rendezvous/{rendezvousId}`](#get_matrixclientv1rendezvousrendezvousid),
and *send* a new payload using
[`PUT /_matrix/client/v1/rendezvous/{rendezvousId}/{txnId}`](#put_matrixclientv1rendezvousrendezvousidtxnid).
In this way, Device A and Device B can communicate by repeatedly inspecting and
updating the payload of the rendezvous session.

Note that a rendezvous session is not a channel over which two devices can send
a sequence of messages to each other, but rather a single shared mutable spot
whose contents can be inspected and overwritten by either party. Each
successful send replaces the previous payload entirely. The homeserver retains
no history of prior payloads, so once a new payload has been sent there is no
way to retrieve the previous one.

This has consequences for how clients use the session: a client cannot tell
from the session alone whether the payload that it sent has been received by
the other device, until the other device itself sends a new payload and the
client observes the change. This favours a "ping-pong" style of protocol, where
a device sends a message, waits for a reply, and only then sends its next
message. If a device needs to send several messages in a row without an
intervening reply, it could update the payload to contain a list of those
messages rather than overwriting it repeatedly. Alternatively, a protocol built
on top of the session could rely on some out-of-band signal that the other
device has read the payload.

The following is an example of how two devices might use a rendezvous session
on the homeserver at `https://matrix.example.com`:

1. Device A creates the session, supplying the initial payload, by sending
   `{"data": "Hello from A"}` to `POST /_matrix/client/v1/rendezvous`. The
   homeserver responds with
   `{"id": "abc-def-123-456", "sequence_token": "1", "expires_in_ms": 300000}`.
2. Device A shares the rendezvous ID `abc-def-123-456` and the base URL
   `https://matrix.example.com` with Device B out-of-band, for example by
   displaying them in a QR code which Device B scans.
3. Device A starts polling `GET /_matrix/client/v1/rendezvous/abc-def-123-456`.
   For as long as the response contains the `sequence_token` of `1`, Device A
   knows that no new payload has been sent.
4. Device B makes a request to
   `GET /_matrix/client/v1/rendezvous/abc-def-123-456` and receives
   `{"data": "Hello from A", "sequence_token": "1", "expires_in_ms": 240000}`.
5. Device B replies by sending `{"sequence_token": "1", "data": "Hello from B"}`
   to `PUT /_matrix/client/v1/rendezvous/abc-def-123-456/{txnId}`, using a newly
   generated transaction ID. The homeserver responds with
   `{"sequence_token": "2"}`. Device B then starts polling the session, waiting
   for the `sequence_token` to change from `2`.
6. The next time that Device A polls the session, it receives
   `{"data": "Hello from B", "sequence_token": "2", "expires_in_ms": 235000}`.
   The changed `sequence_token` tells it that this is a new payload.
7. Device A replies by sending
   `{"sequence_token": "2", "data": "Hello again from A"}` in a `PUT` request
   with a new transaction ID, to which the homeserver responds with
   `{"sequence_token": "3"}`. Device B then receives this payload the next time
   that it polls the session.

#### Sending payloads {id="rendezvous-sessions-sending-payloads"}

Each revision of the payload is identified by a `sequence_token`, which the
homeserver changes every time that a payload is successfully sent to the
session.

Every request to
[`PUT /_matrix/client/v1/rendezvous/{rendezvousId}/{txnId}`](#put_matrixclientv1rendezvousrendezvousidtxnid)
carries the `sequence_token` of the payload that the sending device last saw.
This is the one from the last `GET` response that it received or, for the
device that created the session, the one from the initial `POST` response. The
homeserver accepts the request only if that token still matches
the current revision of the payload, and otherwise rejects it with an
`M_CONCURRENT_WRITE` error. This prevents concurrent writes, and means that a
device which has fallen behind needs to receive the current payload before it
can send a new one.

Whether a client can recover from an `M_CONCURRENT_WRITE` error is determined
by the protocol which is layered on top of the rendezvous session. Where
recovery is permitted, the client can make a `GET` request to fetch the latest
payload and `sequence_token`, and then send again using a new transaction ID.

Each `PUT` request also carries a client-generated
[transaction ID](#transaction-identifiers) in its path, which the homeserver
uses to make retries idempotent. This allows a client which did not receive
the response to a request, and so does not know whether it succeeded, to safely
repeat the same request without first making a `GET` request.

A transaction ID identifies a single attempt to send rather than a payload: a
client which changes the `data` or `sequence_token` that it is sending MUST use
a new transaction ID. If a client re-uses a transaction ID from an earlier
request which succeeded, the homeserver returns the response to that earlier
request without considering the new request.

Unlike elsewhere in the Client-Server API, transaction IDs here are not scoped
to a single device. A rendezvous session is unauthenticated and is shared
between two devices, so a transaction ID is scoped to the rendezvous session as
a whole. Clients MUST therefore generate transaction IDs that are unlikely to
collide with those of the other device. For example, a random value of at least
128 bits is suitable whereas a counter starting at zero is not. A homeserver
which sees a colliding transaction ID will respond with the response that it
gave to the other device, and will silently discard the payload.

#### Expiry {id="rendezvous-sessions-expiry"}

A rendezvous session, and therefore its payload, only exists for a limited
period of time. The time remaining is communicated to clients via the
`expires_in_ms` property of the responses to
[`POST /_matrix/client/v1/rendezvous`](#post_matrixclientv1rendezvous) and
[`GET /_matrix/client/v1/rendezvous/{rendezvousId}`](#get_matrixclientv1rendezvousrendezvousid).
Once the session has expired, any further attempts to receive or send a payload
fail.

Either device can also end the session early by cancelling it with
[`DELETE /_matrix/client/v1/rendezvous/{rendezvousId}`](#delete_matrixclientv1rendezvousrendezvousid).

#### Authentication {id="rendezvous-sessions-authentication"}

Once a rendezvous session has been created, sending payloads to it, receiving
payloads from it and cancelling it do not require authentication. The two
devices are anonymous to the homeserver, and one of them will often have no
access token at all.

However, a homeserver MAY require authentication in order to *create* a
rendezvous session. Clients SHOULD therefore supply their access token when
making requests to
[`GET /_matrix/client/v1/rendezvous`](#get_matrixclientv1rendezvous) and
[`POST /_matrix/client/v1/rendezvous`](#post_matrixclientv1rendezvous) if they
have one for that homeserver.

Because authentication on those two endpoints is optional rather than absent, a
homeserver which receives a request to one of them with an access token that is
invalid or has expired MUST respond as it would for any endpoint that requires
authentication: with a `401` HTTP status code and the applicable
[common error code](#common-error-codes), such as `M_UNKNOWN_TOKEN`. The
homeserver MUST NOT instead treat such a request as if it had been made without
authentication. This allows a client to distinguish an access token which merely
needs [refreshing](#refreshing-access-tokens) from a homeserver policy which
does not permit it to create a rendezvous session, as the latter results in a
`create_available: false` response.

#### Client behaviour {id="rendezvous-sessions-client-behaviour"}

A client can check whether a homeserver offers rendezvous sessions, and whether
the client is permitted to create one there, by calling
[`GET /_matrix/client/v1/rendezvous`](#get_matrixclientv1rendezvous).

It is ultimately up to the client to decide which homeserver to use when
creating a rendezvous session. However, it is suggested that clients choose the
homeserver using the following order of preference:

1. If the client is already logged in, the homeserver that it is logged in to.
2. If the client is not logged in, but knows which homeserver the user wants to
   connect to, that homeserver.
3. Otherwise, a default homeserver.

A client MUST NOT send its access token to any homeserver other than its own.
Consequently, a homeserver that requires authentication in order to create a
rendezvous session cannot be used for that purpose by clients which do not have
an account on it.

Clients SHOULD handle the rendezvous session expiring or being cancelled at any
time.

#### Server behaviour {id="rendezvous-sessions-server-behaviour"}

##### Payload size

Homeservers MUST enforce a maximum size of 4096 bytes on the `data` of a
payload, rejecting requests that exceed it with a `413` HTTP status code and an
`errcode` of `M_TOO_LARGE`.

##### Sequence tokens

A `sequence_token` MUST comply with the
[opaque identifier grammar](/appendices/#opaque-identifiers).

Each successful send MUST produce a `sequence_token` that has not previously
been used by that rendezvous session, even if the `data` is the same as before.
This allows the two devices to distinguish between identical payloads sent by
either device.

A recommended implementation is the decimal representation of a counter, scoped
to the rendezvous session, which is incremented on each successful send. The
`sequence_token` is only used to detect concurrent writes and to identify a
particular revision of the payload, so it does not need to be unguessable.

##### Session lifetime

Homeservers MUST enforce a timeout on each rendezvous session, after which the
session expires. Once a session has expired or been cancelled, all requests to
receive from, send to or cancel the session MUST fail with a `404` HTTP status
code and an `errcode` of `M_NOT_FOUND`.

A session needs to last for long enough for the user to complete whatever
operation the devices are using it for, including any steps where they are
waiting for input from the user. When choosing a timeout, homeservers SHOULD
use a value of:

- at least 120 seconds, for usability.
- at most 300 seconds, for security.

{{% http-api spec="client-server" api="rendezvous" %}}

#### Security considerations {id="rendezvous-sessions-security-considerations"}

##### Denial of service

Because rendezvous sessions allow for the storage of arbitrary data, possibly
by unauthenticated requesters, it is possible to use them as a denial of
service attack surface.

As such, homeserver implementations and administrators might deem mitigations
such as the following to be appropriate:

- rate limiting of requests.
- limiting the number of concurrent sessions.
- limiting the number of transaction IDs that are remembered for each session,
  given that a normal exchange only needs a handful.

The maximum payload size also helps to limit the impact of such an attack.

##### Data exfiltration

Because rendezvous sessions allow for the storage of arbitrary data, it is
possible to use them to circumvent firewalls and other network security
measures.

Homeserver administrators might want to block their own production IP addresses
from being able to make requests to the endpoints of this module, in order to
avoid attackers using a rendezvous session as a dead-drop for exfiltrating
data.

##### Unsafe content {id="rendezvous-sessions-unsafe-content"}

Because requests to send and receive payloads are not authenticated, it is
possible for an attacker to use a rendezvous session to distribute malicious
content. This could lead to reputational problems for the domain or IP
addresses of the homeserver, as well as potentially causing harm to users.

This is mitigated by:

- the low maximum size of a payload.
- the payload being restricted to a string.
- rendezvous sessions being short-lived.
- homeservers using the `Sec-Fetch-*` request headers to avoid returning the
  payload when a web browser has navigated to the URL of a session, as
  described in
  [`GET /_matrix/client/v1/rendezvous/{rendezvousId}`](#get_matrixclientv1rendezvousrendezvousid).
