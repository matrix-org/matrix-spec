---
title: "Application Service API"
weight: 30
type: docs
---

The Matrix client-server API and server-server APIs provide the means to
implement a consistent self-contained federated messaging fabric.
However, they provide limited means of implementing custom server-side
behaviour in Matrix (e.g. gateways, filters, extensible hooks etc). The
Application Service API (AS API) defines a standard API to allow such
extensible functionality to be implemented irrespective of the
underlying homeserver implementation.

## Application Services

Application services are passive and can only observe events from the
homeserver. They can inject events into rooms they are participating in.
They cannot prevent events from being sent, nor can they modify the
content of the event being sent. In order to observe events from a
homeserver, the homeserver needs to be configured to pass certain types
of traffic to the application service. This is achieved by manually
configuring the homeserver with information about the application
service.

### Registration

{{% boxes/note %}}
Previously, application services could register with a homeserver via
HTTP APIs. This was removed as it was seen as a security risk. A
compromised application service could re-register for a global `*` regex
and sniff *all* traffic on the homeserver. To protect against this,
application services now have to register via configuration files which
are linked to the homeserver configuration file. The addition of
configuration files allows homeserver admins to sanity check the
registration for suspicious regex strings.
{{% /boxes/note %}}

Application services register "namespaces" of user IDs, room aliases and
room IDs. An application service is said to be "interested" in a given event
if it matches any of the namespaces.

An application service can also state whether they should be the only
ones who can manage a specified namespace. This is referred to as an
"exclusive" namespace. An exclusive namespace prevents humans and other
application services from creating/deleting entities in that namespace.
Typically, exclusive namespaces are used when the rooms represent real
rooms on another service (e.g. IRC). Non-exclusive namespaces are used
when the application service is merely augmenting the room itself (e.g.
providing logging or searching facilities).

The registration is represented by a series of key-value pairs, which
is normally encoded as an object in a YAML file. It has the following structure:

{{% definition path="api/application-service/definitions/registration" %}}

Exclusive user and alias namespaces should begin with an underscore
after the sigil to avoid collisions with other users on the homeserver.
Application services should additionally attempt to identify the service
they represent in the reserved namespace. For example, `@_irc_.*` would
be a good namespace to register for an application service which deals
with IRC.

An example registration file for an IRC-bridging application service is
below:

```yaml
id: "IRC Bridge"
url: "http://127.0.0.1:1234"
as_token: "30c05ae90a248a4188e620216fa72e349803310ec83e2a77b34fe90be6081f46"
hs_token: "312df522183efd404ec1cd22d2ffa4bbc76a8c1ccf541dd692eef281356bb74e"
sender_localpart: "_irc_bot" # Will result in @_irc_bot:example.org
namespaces:
  users:
    - exclusive: true
      regex: "@_irc_bridge_.*"
  aliases:
    - exclusive: false
      regex: "#_irc_bridge_.*"
  rooms: []
```

{{% boxes/note %}}
For the `users` namespace, application services can only register interest in
*local* users (i.e., users whose IDs end with the `server_name` of the local
homeserver). Events affecting users on other homeservers are not sent to an application
service, even if the user happens to match the one of the `users` namespaces (unless,
of course, the event affects a room that the application service is interested in
for another room - for example, because there is another user in the room that the
application service is interested in).

For the `rooms` and `aliases` namespaces, all events in a matching room will be
sent to the application service.
{{% /boxes/note %}}

{{% boxes/warning %}}
If the homeserver in question has multiple application services, each
`as_token` and `id` MUST be unique per application service as these are
used to identify the application service. The homeserver MUST enforce
this.
{{% /boxes/warning %}}

### Homeserver -&gt; Application Service API

#### Authorization

{{% changed-in v="1.4" %}}

Homeservers MUST include an `Authorization` header, containing the `hs_token`
from the application service's registration, when making requests to the
application service. Application services MUST verify that the provided
`Bearer` token matches their known `hs_token`, failing the request with
an `M_FORBIDDEN` error if it does not match.

The format of the `Authorization` header is similar to the [Client-Server API](/client-server-api/#client-authentication):
`Bearer TheHSTokenGoesHere`.

{{% boxes/note %}}
In previous versions of this specification, an `access_token` query
parameter was used instead. Servers should only send this query parameter
if supporting legacy versions of the specification.

If sending the `query_string`, it is encouraged to send it alongside
the `Authorization` header for maximum compatibility.

Application services should ensure both match if both are provided.
{{% /boxes/note %}}

#### Legacy routes

Previous drafts of the application service specification had a mix of
endpoints that have been used in the wild for a significant amount of
time. The application service specification now defines a version on all
endpoints to be more compatible with the rest of the Matrix
specification and the future.

Homeservers should attempt to use the specified endpoints first when
communicating with application services. However, if the application
service receives an HTTP status code that does not indicate success
(i.e.: 404, 500, 501, etc) then the homeserver should fall back to the
older endpoints for the application service.

The older endpoints have the exact same request body and response
format, they just belong at a different path. The equivalent path for
each is as follows:

-   `/_matrix/app/v1/transactions/{txnId}` should fall back to
    `/transactions/{txnId}`
-   `/_matrix/app/v1/users/{userId}` should fall back to
    `/users/{userId}`
-   `/_matrix/app/v1/rooms/{roomAlias}` should fall back to
    `/rooms/{roomAlias}`
-   `/_matrix/app/v1/thirdparty/protocol/{protocol}` should fall back to
    `/_matrix/app/unstable/thirdparty/protocol/{protocol}`
-   `/_matrix/app/v1/thirdparty/user/{user}` should fall back to
    `/_matrix/app/unstable/thirdparty/user/{user}`
-   `/_matrix/app/v1/thirdparty/location/{location}` should fall back to
    `/_matrix/app/unstable/thirdparty/location/{location}`
-   `/_matrix/app/v1/thirdparty/user` should fall back to
    `/_matrix/app/unstable/thirdparty/user`
-   `/_matrix/app/v1/thirdparty/location` should fall back to
    `/_matrix/app/unstable/thirdparty/location`

Homeservers should periodically try again for the newer endpoints
because the application service may have been updated.

#### Unknown routes

If a request for an unsupported (or unknown) endpoint is received then the server
must respond with a 404 `M_UNRECOGNIZED` error.

Similarly, a 405 `M_UNRECOGNIZED` error is used to denote an unsupported method
to a known endpoint.

#### Pushing events

The application service API provides a transaction API for sending a
list of events. Each list of events includes a transaction ID, which
works as follows:

```
    Typical
    HS ---> AS : Homeserver sends events with transaction ID T.
       <---    : Application Service sends back 200 OK.
```

```
    AS ACK Lost
    HS ---> AS : Homeserver sends events with transaction ID T.
       <-/-    : AS 200 OK is lost.
    HS ---> AS : Homeserver retries with the same transaction ID of T.
       <---    : Application Service sends back 200 OK. If the AS had processed these
                 events already, it can NO-OP this request (and it knows if it is the
                 same events based on the transaction ID).
```

The events sent to the application service should be linearised, as if
they were from the event stream. The homeserver MUST maintain a queue of
transactions to send to the application service. If the application
service cannot be reached, the homeserver SHOULD backoff exponentially
until the application service is reachable again. As application
services cannot *modify* the events in any way, these requests can be
made without blocking other aspects of the homeserver. Homeservers MUST
NOT alter (e.g. add more) events they were going to send within that
transaction ID on retries, as the application service may have already
processed the events.

{{% http-api spec="application-service" api="transactions" %}}

##### Pushing ephemeral data

{{% added-in v="1.13" %}}

If the `receive_ephemeral` settings is enabled in the [registration](#registration)
file, homeservers MUST send ephemeral data that is relevant to the application
service via the transaction API, using the `ephemeral` property of the request's
body. This property is an array that is effectively a combination of the
`presence` and `ephemeral` sections of the client-server [`/sync`](/client-server-api/#get_matrixclientv3sync)
API.

There are currently three event types that can be delivered to an application
service:

- **[`m.presence`](/client-server-api/#mpresence)**: MUST be sent to the
application service if the data would apply contextually. For example, a
presence update for a user an application service shares a room with, or
matching one of the application service's namespaces.
- **[`m.typing`](/client-server-api/#mtyping)**: MUST be sent to the application
service under the same rules as regular events, meaning that the application
service must have registered interest in the room itself, or in a user that is
in the room. The data MUST use the same format as the client-server API, with
the addition of a `room_id` property at the top level to identify the room that
they were sent in.
- **[`m.receipt`](/client-server-api/#mreceipt)**: MUST be sent to the
application service under the same rules as regular events, meaning that the
application service must have registered interest in the room itself, or in a
user that is in the room. The data MUST use the same format as the client-server
API, with the addition of a `room_id` property at the top level to identify the
room that they were sent in. [Private read receipts](/client-server-api/#private-read-receipts)
MUST only be sent for users matching one of the application service's
namespaces. Normal read receipts and threaded read receipts are always sent.

#### Pinging

{{% added-in v="1.7" %}}

The application service API includes a ping mechanism to allow
appservices to ensure that the homeserver can reach the appservice.
Appservices may use this mechanism to detect misconfigurations and
report them appropriately.

Implementations using this mechanism should take care to not fail
entirely in the event of temporary issues, e.g. gracefully handling
cases where the appservice is started before the homeserver.

The mechanism works as follows (note: the human-readable `error` fields
have been omitted for brevity):

**Typical**

```
AS ---> HS : /_matrix/client/v1/appservice/{appserviceId}/ping {"transaction_id": "meow"}
    HS ---> AS : /_matrix/app/v1/ping {"transaction_id": "meow"}
    HS <--- AS : 200 OK {}
AS <--- HS : 200 OK {"duration_ms": 123}
```

**Incorrect `hs_token`**

```
AS ---> HS : /_matrix/client/v1/appservice/{appserviceId}/ping {"transaction_id": "meow"}
    HS ---> AS : /_matrix/app/v1/ping {"transaction_id": "meow"}
    HS <--- AS : 403 Forbidden {"errcode": "M_FORBIDDEN"}
AS <--- HS : 502 Bad Gateway {"errcode": "M_BAD_STATUS", "status": 403, "body": "{\"errcode\": \"M_FORBIDDEN\"}"}
```

**Can't connect to appservice**

```
AS ---> HS : /_matrix/client/v1/appservice/{appserviceId}/ping {"transaction_id": "meow"}
    HS -/-> AS : /_matrix/app/v1/ping {"transaction_id": "meow"}
AS <--- HS : 502 Bad Gateway {"errcode": "M_CONNECTION_FAILED"}
```

The `/_matrix/app/v1/ping` endpoint is described here. The
[`/_matrix/client/v1/appservice/{appserviceId}/ping`](#post_matrixclientv1appserviceappserviceidping)
endpoint is under the Client-Server API extensions section below.

{{% http-api spec="application-service" api="ping" %}}

#### Querying

The application service API includes two querying APIs: for room aliases
and for user IDs. The application service SHOULD create the queried
entity if it desires. During this process, the application service is
blocking the homeserver until the entity is created and configured. If
the homeserver does not receive a response to this request, the
homeserver should retry several times before timing out. This should
result in an HTTP status 408 "Request Timeout" on the client which
initiated this request (e.g. to join a room alias).

{{% boxes/rationale %}}
Blocking the homeserver and expecting the application service to create
the entity using the client-server API is simpler and more flexible than
alternative methods such as returning an initial sync style JSON blob
and get the HS to provision the room/user. This also meant that there
didn't need to be a "backchannel" to inform the application service
about information about the entity such as room ID to room alias
mappings.
{{% /boxes/rationale %}}

{{% http-api spec="application-service" api="query_user" %}}

{{% http-api spec="application-service" api="query_room" %}}

#### Third-party networks

Application services may declare which protocols they support via their
registration configuration for the homeserver. These networks are
generally for third-party services such as IRC that the application
service is managing. Application services may populate a Matrix room
directory for their registered protocols, as defined in the
Client-Server API Extensions.

Each protocol may have several "locations" (also known as "third-party
locations" or "3PLs"). A location within a protocol is a place in the
third-party network, such as an IRC channel. Users of the third-party
network may also be represented by the application service.

Locations and users can be searched by fields defined by the application
service, such as by display name or other attribute. When clients
request the homeserver to search in a particular "network" (protocol),
the search fields will be passed along to the application service for
filtering.

{{% http-api spec="application-service" api="protocols" %}}

### Client-Server API Extensions

Application services can use a more powerful version of the
client-server API by identifying itself as an application service to the
homeserver.

Endpoints defined in this section MUST be supported by homeservers in
the client-server API as accessible only by application services.

#### Identity assertion

The client-server API infers the user ID from the `access_token`
provided in every request. To avoid the application service from having
to keep track of each user's access token, the application service
should identify itself to the Client-Server API by providing its
`as_token` for the `access_token` alongside the user the application
service would like to masquerade as.

Inputs:
-   Application service token (`as_token`)
-   User ID in the AS namespace to act as.

Notes:
-   This applies to all aspects of the Client-Server API, except for
    Account Management.
-   The `as_token` is inserted into `access_token` which is usually
    where the client token is, such as via the query string or
    `Authorization` header. This is done on purpose to allow application
    services to reuse client SDKs.
-   The `access_token` should be supplied through the `Authorization`
    header where possible to prevent the token appearing in HTTP request
    logs by accident.

The application service may specify the virtual user to act as through
use of a `user_id` query string parameter on the request. The user
specified in the query string must be covered by one of the application
service's `user` namespaces. If the parameter is missing, the homeserver
is to assume the application service intends to act as the user implied
by the `sender_localpart` property of the registration.

An example request would be:

    GET /_matrix/client/v3/account/whoami?user_id=@_irc_user:example.org
    Authorization: Bearer YourApplicationServiceTokenHere

#### Timestamp massaging

{{% added-in v="1.3" %}}

Application services can alter the timestamp associated with an event, allowing
the application service to better represent the "real" time an event was sent
at. While this doesn't affect the server-side ordering of the event, it can allow
an application service to better represent when an event would have been sent/received
at, such as in the case of bridges where the remote network might have a slight
delay and the application service wishes to bridge the proper time onto the message.

When authenticating requests as an application service, the caller can append a `ts`
query string argument to change the `origin_server_ts` of the resulting event. Attempting
to set the timestamp to anything other than what is accepted by `origin_server_ts` should
be rejected by the server as a bad request.

When not present, the server's behaviour is unchanged: the local system time of the server
will be used to provide a timestamp, representing "now".

The `ts` query string argument is only valid on the following endpoints:

* [`PUT /rooms/{roomId}/send/{eventType}/{txnId}`](/client-server-api/#put_matrixclientv3roomsroomidsendeventtypetxnid)
* [`PUT /rooms/{roomId}/state/{eventType}/{stateKey}`](/client-server-api/#put_matrixclientv3roomsroomidstateeventtypestatekey)

Other endpoints, such as `/kick`, do not support `ts`: instead, callers can use the
`PUT /state` endpoint to mimic the behaviour of the other APIs.

{{% boxes/warning %}}
Changing the time of an event does not change the server-side (DAG) ordering for the
event. The event will still be appended at the tip of the DAG as though the timestamp
was set to "now". Future MSCs, like [MSC2716](https://github.com/matrix-org/matrix-spec-proposals/pull/2716),
are expected to provide functionality which can allow DAG order manipulation (for history
imports and similar behaviour).
{{% /boxes/warning %}}

#### Server admin style permissions

The homeserver needs to give the application service *full control* over
its namespace, both for users and for room aliases. This means that the
AS should be able to manage any users and room alias in its namespace. No additional API
changes need to be made in order for control of room aliases to be
granted to the AS.

Creation of users needs API changes in order to:

-   Work around captchas.
-   Have a 'passwordless' user.

This involves bypassing the registration flows entirely. This is
achieved by including the `as_token` on a `/register` request, along
with a login type of `m.login.application_service` to set the desired
user ID without a password.

    POST /_matrix/client/v3/register
    Authorization: Bearer YourApplicationServiceTokenHere

    Content:
    {
      type: "m.login.application_service",
      username: "_irc_example"
    }

Similarly, logging in as users needs API changes in order to allow the AS to
log in without needing the user's password. This is achieved by including the
`as_token` on a `/login` request, along with a login type of
`m.login.application_service`:

{{% added-in v="1.2" %}}

    POST /_matrix/client/v3/login
    Authorization: Bearer YourApplicationServiceTokenHere

    Content:
    {
      type: "m.login.application_service",
      "identifier": {
        "type": "m.id.user",
        "user": "_irc_example"
      }
    }

Application services which attempt to create users or aliases *outside*
of their defined namespaces, or log in as users outside of their defined
namespaces will receive an error code `M_EXCLUSIVE`.
Similarly, normal users who attempt to create users or aliases *inside*
an application service-defined namespace will receive the same
`M_EXCLUSIVE` error code, but only if the application service has
defined the namespace as `exclusive`.

If `/register` or `/login` is called with the `m.login.application_service`
login type, but without a valid `as_token`, the endpoints will return an error
with the `M_MISSING_TOKEN` or `M_UNKNOWN_TOKEN` error code and 401 as the HTTP
status code. This is the same behavior as invalid auth in the client-server API
(see [Using access tokens](/client-server-api/#using-access-tokens)).

#### Pinging

{{% added-in v="1.7" %}}

This is the client-server API companion endpoint for the
[pinging](#pinging) mechanism described above.

{{% http-api spec="client-server" api="appservice_ping" %}}

#### Using `/sync` and `/events`

Application services wishing to use `/sync` or `/events` from the
Client-Server API MUST do so with a virtual user (provide a `user_id`
via the query string). It is expected that the application service use
the transactions pushed to it to handle events rather than syncing with
the user implied by `sender_localpart`.

#### Published room directories

Application services can maintain their own published room directories for
their defined third-party protocols. These directories may be accessed by
clients through additional parameters on the `/publicRooms`
client-server endpoint.

{{% http-api spec="client-server" api="appservice_room_directory" %}}

### Referencing messages from a third-party network

Application services should include an `external_url` in the `content`
of events it emits to indicate where the message came from. This
typically applies to application services that bridge other networks
into Matrix, such as IRC, where an HTTP URL may be available to
reference.

Clients should provide users with a way to access the `external_url` if
it is present. Clients should additionally ensure the URL has a scheme
of `https` or `http` before making use of it.

The presence of an `external_url` on an event does not necessarily mean
the event was sent from an application service. Clients should be wary
of the URL contained within, as it may not be a legitimate reference to
the event's source.
