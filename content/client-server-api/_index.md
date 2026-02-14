---
title: "Client-Server API"
weight: 10
type: docs
description: |
  The client-server API allows clients to send messages, control rooms and
  synchronise conversation history. It is designed to support both lightweight
  clients which store no state and lazy-load data from the server as required,
  as well as heavyweight clients which maintain a full local persistent copy of
  server state.
---

## API Standards

{{% boxes/note %}}
These standards only apply to the APIs defined in the Matrix specification. APIs
used by this specification but defined in other specifications, like the [OAuth
2.0 API](#oauth-20-api), use their own rules.
{{% /boxes/note %}}

The mandatory baseline for client-server communication in Matrix is
exchanging JSON objects over HTTP APIs. More efficient transports may be
specified in future as optional extensions.

HTTPS is recommended for communication. The use of plain HTTP is not
recommended outside test environments.

Clients are authenticated using opaque `access_token` strings (see [Client
Authentication](#client-authentication) for details).

All `POST` and `PUT` endpoints, with the exception of those listed below,
require the client to supply a request body containing a (potentially empty)
JSON object.  Clients should supply a `Content-Type` header of
`application/json` for all requests with JSON bodies, but this is not required.

The exceptions are:

- [`POST /_matrix/media/v3/upload`](#post_matrixmediav3upload) and
  [`PUT /_matrix/media/v3/upload/{serverName}/{mediaId}`](#put_matrixmediav3uploadservernamemediaid),
  both of which take the uploaded media as the request body.
- [`POST /_matrix/client/v3/logout`](#post_matrixclientv3logout) and
  [`POST /_matrix/client/v3/logout/all`](#post_matrixclientv3logoutall),
  which take an empty request body.

Similarly, all endpoints require the server to return a JSON object,
with the exception of 200 responses to the media download endpoints in the
[Content Repository module](#content-repository).
Servers must include a `Content-Type` header of `application/json` for all JSON responses.

All JSON data, in requests or responses, must be encoded using UTF-8.

See also [Conventions for Matrix APIs](/appendices#conventions-for-matrix-apis)
in the Appendices for conventions which all Matrix APIs are expected to follow,
and [Web Browser Clients](#web-browser-clients) below for additional
requirements for server responses.

### Standard error response

Any errors which occur at the Matrix API level MUST return a "standard
error response". This is a JSON object which looks like:

```json
{
  "errcode": "<error code>",
  "error": "<error message>"
}
```

The `error` string will be a human-readable error message, usually a
sentence explaining what went wrong.

The `errcode` string will be a unique string which can be used to handle an
error message e.g.  `M_FORBIDDEN`. Error codes should have their namespace
first in ALL CAPS, followed by a single `_`. For example, if there was a custom
namespace `com.mydomain.here`, and a `FORBIDDEN` code, the error code should
look like `COM.MYDOMAIN.HERE_FORBIDDEN`. Error codes defined by this
specification should start with `M_`.

Some `errcode`s define additional keys which should be present in the error
response object, but the keys `error` and `errcode` MUST always be present.

Errors are generally best expressed by their error code rather than the
HTTP status code returned. When encountering the error code `M_UNKNOWN`,
clients should prefer the HTTP status code as a more reliable reference
for what the issue was. For example, if the client receives an error
code of `M_NOT_FOUND` but the request gave a 400 Bad Request status
code, the client should treat the error as if the resource was not
found. However, if the client were to receive an error code of
`M_UNKNOWN` with a 400 Bad Request, the client should assume that the
request being made was invalid.

#### Common error codes

These error codes can be returned by any API endpoint:

`M_FORBIDDEN`
Forbidden access, e.g. joining a room without permission, failed login.

`M_UNKNOWN_TOKEN`
The access or refresh token specified was not recognised.

An additional response parameter, `soft_logout`, might be present on the
response for 401 HTTP status codes. See [the soft logout
section](#soft-logout) for more information.

`M_MISSING_TOKEN`
No access token was specified for the request.

`M_USER_LOCKED`
The account has been [locked](#account-locking) and cannot be used at this time.

`M_USER_SUSPENDED`
The account has been [suspended](#account-suspension) and can only be used for
limited actions at this time.

`M_BAD_JSON`
Request contained valid JSON, but it was malformed in some way, e.g.
missing required keys, invalid values for keys.

`M_NOT_JSON`
Request did not contain valid JSON.

`M_NOT_FOUND`
No resource was found for this request.

`M_LIMIT_EXCEEDED`
Too many requests have been sent in a short period of time. Wait a while
then try again. See [Rate limiting](#rate-limiting).

`M_UNRECOGNIZED`
The server did not understand the request. This is expected to be returned with
a 404 HTTP status code if the endpoint is not implemented or a 405 HTTP status
code if the endpoint is implemented, but the incorrect HTTP method is used.

`M_UNKNOWN_DEVICE`
{{% added-in v="1.17" %}} The device ID supplied by the application service does
not belong to the user ID during [identity assertion](/application-service-api/#identity-assertion).

`M_RESOURCE_LIMIT_EXCEEDED`
The request cannot be completed because the homeserver has reached a
resource limit imposed on it. For example, a homeserver held in a shared
hosting environment may reach a resource limit if it starts using too
much memory or disk space. The error MUST have an `admin_contact` field
to provide the user receiving the error a place to reach out to.
Typically, this error will appear on routes which attempt to modify
state (e.g.: sending messages, account data, etc) and not routes which
only read state (e.g.: [`/sync`](#get_matrixclientv3sync),
[`/user/{userId}/account_data/{type}`](#get_matrixclientv3useruseridaccount_datatype), etc).

`M_UNKNOWN`
An unknown error has occurred.

#### Other error codes

The following error codes are specific to certain endpoints.

<!-- TODO: move them to the endpoints that return them -->

`M_UNAUTHORIZED`
The request was not correctly authorized. Usually due to login failures.

`M_USER_DEACTIVATED`
The user ID associated with the request has been deactivated. Typically
for endpoints that prove authentication, such as [`/login`](#get_matrixclientv3login).

`M_USER_IN_USE`
Encountered when trying to register a user ID which has been taken.

`M_INVALID_USERNAME`
Encountered when trying to register a user ID which is not valid.

`M_ROOM_IN_USE`
Sent when the room alias given to the `createRoom` API is already in
use.

`M_INVALID_ROOM_STATE`
Sent when the initial state given to the `createRoom` API is invalid.

`M_THREEPID_IN_USE`
Sent when a threepid given to an API cannot be used because the same
threepid is already in use.

`M_THREEPID_NOT_FOUND`
Sent when a threepid given to an API cannot be used because no record
matching the threepid was found.

`M_THREEPID_AUTH_FAILED`
Authentication could not be performed on the third-party identifier.

`M_THREEPID_DENIED`
The server does not permit this third-party identifier. This may happen
if the server only permits, for example, email addresses from a
particular domain.

`M_SERVER_NOT_TRUSTED`
The client's request used a third-party server, e.g. identity server,
that this server does not trust.

`M_UNSUPPORTED_ROOM_VERSION`
The client's request to create a room used a room version that the
server does not support.

`M_INCOMPATIBLE_ROOM_VERSION`
The client attempted to join a room that has a version the server does
not support. Inspect the `room_version` property of the error response
for the room's version.

`M_BAD_STATE`
The state change requested cannot be performed, such as attempting to
unban a user who is not banned.

`M_GUEST_ACCESS_FORBIDDEN`
The room or resource does not permit guests to access it.

`M_CAPTCHA_NEEDED`
A Captcha is required to complete the request.

`M_CAPTCHA_INVALID`
The Captcha provided did not match what was expected.

`M_MISSING_PARAM`
A required parameter was missing from the request.

`M_INVALID_PARAM`
A parameter that was specified has the wrong value. For example, the
server expected an integer and instead received a string.

`M_TOO_LARGE`
The request or entity was too large.

`M_EXCLUSIVE`
The resource being requested is reserved by an application service, or
the application service making the request has not created the resource.

`M_CANNOT_LEAVE_SERVER_NOTICE_ROOM`
The user is unable to reject an invite to join the server notices room.
See the [Server Notices](#server-notices) module for more information.

`M_THREEPID_MEDIUM_NOT_SUPPORTED`
The homeserver does not support adding a third party identifier of the given medium.

`M_THREEPID_IN_USE`
The third party identifier specified by the client is not acceptable because it is
already in use in some way.

#### Rate limiting

Homeservers SHOULD implement rate limiting to reduce the risk of being
overloaded. If a request is refused due to rate limiting, it should
return a standard error response of the form:

```json
{
  "errcode": "M_LIMIT_EXCEEDED",
  "error": "string",
  "retry_after_ms": integer (optional, deprecated)
}
```

Homeservers SHOULD include a [`Retry-After`](https://www.rfc-editor.org/rfc/rfc9110#field.retry-after)
header for any response with a 429 status code.

The `retry_after_ms` property MAY be included to tell the client how long
they have to wait in milliseconds before they can try again. This property is
deprecated, in favour of the `Retry-After` header.

{{% changed-in v="1.10" %}}: `retry_after_ms` property deprecated in favour of `Retry-After` header.

### Transaction identifiers

The client-server API typically uses `HTTP PUT` to submit requests with
a client-generated transaction identifier in the HTTP path.

The purpose of the transaction ID is to allow the homeserver to distinguish a
new request from a retransmission of a previous request so that it can make
the request idempotent.

The transaction ID should **only** be used for this purpose.

After the request has finished, clients should change the `{txnId}` value for
the next request. How this is achieved, is left as an implementation detail.
It is recommended that clients use either version 4 UUIDs or a concatenation
of the current timestamp and a monotonically increasing integer.

The homeserver should identify a request as a retransmission if the
transaction ID is the same as a previous request, and the path of the
HTTP request is the same.

Where a retransmission has been identified, the homeserver should return
the same HTTP response code and content as the original request.
For example, [`PUT /_matrix/client/v3/rooms/{roomId}/send/{eventType}/{txnId}`](#put_matrixclientv3roomsroomidsendeventtypetxnid)
would return a `200 OK` with the `event_id` of the original request in
the response body.

The scope of a transaction ID is for a single [device](../index.html#devices),
and a single HTTP endpoint. In other words: a single device could use the same
transaction ID for a request to [`PUT
/_matrix/client/v3/rooms/{roomId}/send/{eventType}/{txnId}`](#put_matrixclientv3roomsroomidsendeventtypetxnid)
and [`PUT
/_matrix/client/v3/sendToDevice/{eventType}/{txnId}`](#put_matrixclientv3sendtodeviceeventtypetxnid),
and the two requests would be considered distinct because the two are
considered separate endpoints. Similarly, if a client logs out and back in
between two requests using the same transaction ID, the requests are distinct
because the act of logging in and out creates a new device (unless an existing
`device_id` is given during the [login](#login) process). On the other hand, if
a client re-uses a transaction ID for the same endpoint after
[refreshing](#refreshing-access-tokens) an access token, it will be assumed to
be a duplicate request and ignored. See also
[Relationship between access tokens and devices](#relationship-between-access-tokens-and-devices).

Some API endpoints may allow or require the use of `POST` requests
without a transaction ID. Where this is optional, the use of a `PUT`
request is strongly recommended.

{{% boxes/rationale %}}
Prior to `v1.7`, transaction IDs were scoped to "client sessions" rather than
devices.
{{% /boxes/rationale %}}

## Web Browser Clients

It is realistic to expect that some clients will be written to be run
within a web browser or similar environment. In these cases, the
homeserver should respond to pre-flight requests and supply Cross-Origin
Resource Sharing (CORS) headers on all requests.

Servers MUST expect that clients will approach them with `OPTIONS`
requests, allowing clients to discover the CORS headers. All endpoints
in this specification support the `OPTIONS` method, however the server
MUST NOT perform any logic defined for the endpoints when approached
with an `OPTIONS` request.

When a client approaches the server with a request, the server should
respond with the CORS headers for that route. The recommended CORS
headers to be returned by servers on all requests are:

    Access-Control-Allow-Origin: *
    Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
    Access-Control-Allow-Headers: X-Requested-With, Content-Type, Authorization

{{% boxes/note %}}
{{% added-in v="1.13" %}} The recommended value of the `Access-Control-Allow-Methods`
header only covers the existing endpoints in the specification. Servers which
support additional endpoints or methods should add those methods as well.

This section will be updated whenever a new method is supported by an endpoint.
Examples of possible future-use methods include `PATCH` and `HEAD`.
{{% /boxes/note %}}

## Server Discovery

In order to allow users to connect to a Matrix server without needing to
explicitly specify the homeserver's URL or other parameters, clients
SHOULD use an auto-discovery mechanism to determine the server's URL
based on a user's Matrix ID. Auto-discovery should only be done at login
time.

In this section, the following terms are used with specific meanings:

`PROMPT`
Retrieve the specific piece of information from the user in a way which
fits within the existing client user experience, if the client is
inclined to do so. Failure can take place instead if no good user
experience for this is possible at this point.

`IGNORE`
Stop the current auto-discovery mechanism. If no more auto-discovery
mechanisms are available, then the client may use other methods of
determining the required parameters, such as prompting the user, or
using default values.

`FAIL_PROMPT`
Inform the user that auto-discovery failed due to invalid/empty data and
`PROMPT` for the parameter.

`FAIL_ERROR`
Inform the user that auto-discovery did not return any usable URLs. Do
not continue further with the current login process. At this point,
valid data was obtained, but no server is available to serve the client.
No further guess should be attempted and the user should make a
conscientious decision what to do next.

### Well-known URIs

Matrix facilitates automatic discovery for the Client-Server API base URL and more via the
[RFC 8615](https://datatracker.ietf.org/doc/html/rfc8615) "Well-Known URI" method.
This method uses JSON files at a predetermined location on the root path `/.well-known/` to
specify parameter values.

{{% boxes/note %}}
Diverging from the rest of the endpoints in the Client-Server spec, these files can not be provided
on the base URL that the Client-Server API is reachable on, as it is yet to be discovered.
Instead, they can be reached via HTTPS on the [server name](/appendices/#server-name)'s hostname as domain.

Servers hosting the `.well-known` JSON file SHOULD offer CORS headers,
as per the [CORS](#web-browser-clients) section in this specification.
{{% /boxes/note %}}

The flow for auto-discovery is as follows:

1.  Extract the [server name](/appendices/#server-name) from the user's Matrix ID by splitting the
    Matrix ID at the first colon.
2.  Extract the hostname from the server name as described by the [grammar](/appendices/#server-name).
3.  Make a GET request to `https://hostname/.well-known/matrix/client`.
    1.  If the returned status code is 404, then `IGNORE`.
    2.  If the returned status code is not 200, or the response body is
        empty, then `FAIL_PROMPT`.
    3.  Parse the response body as a JSON object
        1.  If the content cannot be parsed, then `FAIL_PROMPT`.
    4.  Extract the `base_url` value from the `m.homeserver` property.
        This value is to be used as the base URL of the homeserver.
        1. If this value is not provided, then `FAIL_PROMPT`.
    5.  Validate the homeserver base URL:
        1. Parse it as a URL. If it is not a URL, then `FAIL_ERROR`.
        2. Clients SHOULD validate that the URL points to a valid
            homeserver before accepting it by connecting to the
            [`/_matrix/client/versions`](/client-server-api/#get_matrixclientversions) endpoint, ensuring that it does
            not return an error, and parsing and validating that the
            data conforms with the expected response format. If any step
            in the validation fails, then `FAIL_ERROR`. Validation is
            done as a simple check against configuration errors, in
            order to ensure that the discovered address points to a
            valid homeserver.
        3. It is important to note that the `base_url` value might include
           a trailing `/`. Consumers should be prepared to handle both cases.
    6.  If the `m.identity_server` property is present, extract the
        `base_url` value for use as the base URL of the identity server.
        Validation for this URL is done as in the step above, but using
        `/_matrix/identity/v2` as the endpoint to connect to. If the
        `m.identity_server` property is present, but does not have a
        `base_url` value, then `FAIL_PROMPT`.

{{% http-api spec="client-server" api="wellknown" %}}

{{% http-api spec="client-server" api="support" %}}

### API Versions

Upon connecting, the Matrix client and server need to negotiate which version of the specification
they commonly support, as the API evolves over time. The server advertises its supported versions
and optionally unstable features to the client, which can then go on to make requests to the
endpoints it supports.

{{% http-api spec="client-server" api="versions" %}}

## Client Authentication

{{% changed-in v="1.15" %}} OAuth 2.0 API added to the specification.

Most API endpoints require the user to identify themselves by presenting
previously obtained credentials in the form of an access token.
An access token is typically obtained via the [Login](#login) or
[Registration](#account-registration) processes. Access tokens
can expire; a new access token can be generated by using a refresh token.

{{% boxes/note %}}
This specification does not mandate a particular format for the access
token. Clients should treat it as an opaque byte sequence. Servers are
free to choose an appropriate format. Server implementors may like to
investigate [macaroons](http://research.google.com/pubs/pub41892.html).
{{% /boxes/note %}}

Since Matrix 1.15, the Client-Server specification supports two authentication
APIs:

* The [legacy API](#legacy-api)
* The [OAuth 2.0 API](#oauth-20-api)

The legacy API has existed since the first version of the Matrix specification,
while the OAuth 2.0 API has been introduced to rely on a industry standard and
its experience rather than implementing a custom protocol that might not follow
the best practices.

A homeserver may support one of those two APIs, or both. The two APIs are
mutually incompatible, which means that after logging in, clients MUST only use
the API that was used to obtain their current access token.

{{% boxes/note %}}
Currently the OAuth 2.0 API doesn't cover all the use cases of the legacy API,
such as automated applications that cannot use a web browser.
{{% /boxes/note %}}

{{% boxes/note %}}
{{% added-in v="1.18" %}}
A compatibility feature, called [OAuth 2.0 aware clients](#oauth-20-aware-clients),
is available to ease the transition to the OAuth 2.0 API for clients that only
support the legacy API.
{{% /boxes/note %}}

### Authentication API discovery

To discover if a homeserver supports the legacy API, the [`GET /login`](#get_matrixclientv3login)
endpoint can be used.

To discover if a homeserver supports the OAuth 2.0 API, the
[`GET /auth_metadata`](#get_matrixclientv1auth_metadata) endpoint can be used.

In both cases, the server SHOULD respond with 404 and an `M_UNRECOGNIZED` error
code if the corresponding API is not supported.

### Account registration

With the legacy API, a client can register a new account with the
[`/register`](#post_matrixclientv3register) endpoint.

With the OAuth 2.0 API, a client can't register a new account directly. The end
user must do that directly in the homeserver's web UI. However, the client can
signal to the homeserver that the user wishes to create a new account with the
[`prompt=create`](#user-registration) parameter during authorization.

{{% boxes/note %}}
{{% added-in v="1.17" %}}
Application services can use the `/register` endpoint to create users regardless
of the authentication API supported by the homeserver.
{{% /boxes/note %}}

### Login

With the legacy API, a client can obtain an access token by using one of the
[login](#legacy-login) methods supported by the homeserver at the [`POST /login`](#post_matrixclientv3login)
endpoint. To invalidate the access token the client must call the [`/logout`](#post_matrixclientv3logout)
endpoint.

With the OAuth 2.0 API, a client can obtain an access token by using one of the
[grant types](#grant-types) supported by the homeserver and authorizing the
proper [scope](#scope), as demonstrated in the [login flow](#login-flow). To
invalidate the access token the client must use [token revocation](#token-revocation).

### Using access tokens

Access tokens may be provided via a request header, using the Authentication
Bearer scheme: `Authorization: Bearer TheTokenHere`.

Clients may alternatively provide the access token via a query string parameter:
`access_token=TheTokenHere`. This method is deprecated to prevent the access
token being leaked in access/HTTP logs and SHOULD NOT be used by clients.

Homeservers MUST support both methods.

{{% boxes/note %}}
{{% changed-in v="1.11" %}}
Sending the access token as a query string parameter is now deprecated.
{{% /boxes/note %}}

When credentials are required but missing or invalid, the HTTP call will
return with a status of 401 and the error code, `M_MISSING_TOKEN` or
`M_UNKNOWN_TOKEN` respectively.  Note that an error code of `M_UNKNOWN_TOKEN`
could mean one of four things:

1. the access token was never valid.
2. the access token has been logged out.
3. the access token has been [soft logged out](#soft-logout).
4. {{% added-in v="1.3" %}} the access token [needs to be refreshed](#refreshing-access-tokens).

When a client receives an error code of `M_UNKNOWN_TOKEN`, it should:

- attempt to [refresh the token](#refreshing-access-tokens), if it has a refresh
  token;
- if [`soft_logout`](#soft-logout) is set to `true`, it can offer to
  re-log in the user, retaining any of the client's persisted
  information;
- otherwise, consider the user as having been logged out.

### Relationship between access tokens and devices

Client [devices](../index.html#devices) are closely related to access
tokens and refresh tokens. Matrix servers should record which device
each access token and refresh token are assigned to, so that
subsequent requests can be handled correctly. When a refresh token is
used to generate a new access token and refresh token, the new access
and refresh tokens are now bound to the device associated with the
initial refresh token.

During login or registration, the generated access token should be associated
with a `device_id`. The legacy [Login](#legacy-login) and [Registration](#legacy-account-registration)
processes auto-generate a new `device_id`, but a client is also free to provide
its own `device_id`. With the OAuth 2.0 API, the `device_id` is always provided
by the client. The client can generate a new `device_id` or, provided the user
remains the same, reuse an existing device. If the client sets the `device_id`,
the server will invalidate any access and refresh tokens previously assigned to
that device.

### Refreshing access tokens

{{% added-in v="1.3" %}}

Access tokens can expire after a certain amount of time. Any HTTP calls that
use an expired access token will return with an error code `M_UNKNOWN_TOKEN`,
preferably with `soft_logout: true`. When a client receives this error and it
has a refresh token, it should attempt to refresh the access token. Clients can
also refresh their access token at any time, even if it has not yet expired. If
the token refresh succeeds, the client should use the new token for future
requests, and can re-try previously-failed requests with the new token. When an
access token is refreshed, a new refresh token may be returned; if a new refresh
token is given, the old refresh token will be invalidated, and the new refresh
token should be used when the access token needs to be refreshed.

The old refresh token remains valid until the new access token or refresh token
is used, at which point the old refresh token is revoked. This ensures that if
a client fails to receive or persist the new tokens, it will be able to repeat
the refresh operation.

If the token refresh fails and the error response included a `soft_logout:
true` property, then the client can treat it as a [soft logout](#soft-logout)
and attempt to obtain a new access token by re-logging in. If the error
response does not include a `soft_logout: true` property, the client should
consider the user as being logged out.

With the legacy API, refreshing access tokens is done by calling [`/refresh`](#post_matrixclientv3refresh).
Handling of clients that do not support refresh tokens is up to the homeserver;
clients indicate their support for refresh tokens by including a
`refresh_token: true` property in the request body of the
[`/login`](#post_matrixclientv3login) and
[`/register`](#post_matrixclientv3register) endpoints. For example, homeservers
may allow the use of non-expiring access tokens, or may expire access tokens
anyways and rely on soft logout behaviour on clients that don't support
refreshing.

With the OAuth 2.0 API, refreshing access tokens is done with the [refresh token
grant type](#refresh-token-grant), as demonstrated in the [token refresh
flow](#token-refresh-flow). Support for refreshing access tokens is mandatory
with this API.

### Soft logout

A client can be in a "soft logout" state if the server requires
re-authentication before continuing, but does not want to invalidate the
client's session. The server indicates that the client is in a soft logout
state by including a `soft_logout: true` parameter in an `M_UNKNOWN_TOKEN`
error response; the `soft_logout` parameter defaults to `false`. If the
`soft_logout` parameter is omitted or is `false`, this means the server has
destroyed the session and the client should not reuse it. That is, any
persisted state held by the client, such as encryption keys and device
information, must not be reused and must be discarded. If `soft_logout` is
`true` the client can reuse any persisted state.

{{% changed-in v="1.3" %}} A client that receives such a response can try to
[refresh its access token](#refreshing-access-tokens), if it has a refresh
token available. If it does not have a refresh token available, or refreshing
fails with `soft_logout: true`, the client can acquire a new access token by
specifying the device ID it is already using to the login API.

{{% changed-in v="1.12" %}} A client that receives such a response together
with an `M_USER_LOCKED` error code, cannot obtain a new access token until
the account has been [unlocked](#account-locking).

### Account management

With the legacy API, a client can use several endpoints to allow the user to
manage their account like [changing their password](#password-management),
[managing their devices](#device-management) or
[deactivating their account](#account-deactivation).

With the OAuth 2.0 API, all account management is done via the homeserver's web
UI that can be accessed by users via the [account management URL](#oauth-20-account-management).

### Legacy API

This is the original authentication API that was introduced in the first version
of the Client-Server specification and uses custom APIs. Contrary to the OAuth
2.0 API, account management is primarily done in the client's interface and as
such it does not usually require the end user to be redirected to a web UI in
their browser.

#### User-Interactive Authentication API

##### Overview

Some API endpoints require authentication that interacts with the user.
The homeserver may provide many different ways of authenticating, such
as user/password auth, login via a single-sign-on server (SSO), etc.
This specification does not define how homeservers should authorise
their users but instead defines the standard interface which
implementations should follow so that ANY client can log in to ANY
homeserver.

The process takes the form of one or more 'stages'. At each stage the
client submits a set of data for a given authentication type and awaits
a response from the server, which will either be a final success or a
request to perform an additional stage. This exchange continues until
the final success.

For each endpoint, a server offers one or more 'flows' that the client
can use to authenticate itself. Each flow comprises a series of stages,
as described above. The client is free to choose which flow it follows,
however the flow's stages must be completed in order. Failing to follow
the flows in order must result in an HTTP 401 response, as defined
below. When all stages in a flow are complete, authentication is
complete and the API call succeeds.

##### User-interactive API in the REST API

In the REST API described in this specification, authentication works by
the client and server exchanging JSON dictionaries. The server indicates
what authentication data it requires via the body of an HTTP 401
response, and the client submits that authentication data via the `auth`
request parameter.

A client should first make a request with no `auth` parameter.
The homeserver returns an HTTP 401 response, with a JSON body, as follows:

```nohighlight
HTTP/1.1 401 Unauthorized
Content-Type: application/json
```

```json
{
  "flows": [
    {
      "stages": [ "example.type.foo", "example.type.bar" ]
    },
    {
      "stages": [ "example.type.foo", "example.type.baz" ]
    }
  ],
  "params": {
      "example.type.baz": {
          "example_key": "foobar"
      }
  },
  "session": "xxxxxx"
}
```

In addition to the `flows`, this object contains some extra information:

* `params`: This section contains any information that the client will
need to know in order to use a given type of authentication. For each
authentication type presented, that type may be present as a key in this
dictionary. For example, the public part of an OAuth client ID could be
given here.

* `session`: This is a session identifier that the client must pass back
to the homeserver, if one is provided, in subsequent attempts to authenticate
in the same API call.

The client then chooses a flow and attempts to complete the first stage.
It does this by resubmitting the same request with the addition of an
`auth` key in the object that it submits. This dictionary contains a
`type` key whose value is the name of the authentication type that the
client is attempting to complete. It must also contain a `session` key
with the value of the session key given by the homeserver, if one was
given. It also contains other keys dependent on the auth type being
attempted. For example, if the client is attempting to complete auth
type `example.type.foo`, it might submit something like this:

```nohighlight
POST /_matrix/client/v3/endpoint HTTP/1.1
Content-Type: application/json
```

```json
{
  "a_request_parameter": "something",
  "another_request_parameter": "something else",
  "auth": {
      "type": "example.type.foo",
      "session": "xxxxxx",
      "example_credential": "verypoorsharedsecret"
  }
}
```

If the homeserver deems the authentication attempt to be successful but
still requires more stages to be completed, it returns HTTP status 401
along with the same object as when no authentication was attempted, with
the addition of the `completed` key which is an array of auth types the
client has completed successfully:

```nohighlight
HTTP/1.1 401 Unauthorized
Content-Type: application/json
```

```json
{
  "completed": [ "example.type.foo" ],
  "flows": [
    {
      "stages": [ "example.type.foo", "example.type.bar" ]
    },
    {
      "stages": [ "example.type.foo", "example.type.baz" ]
    }
  ],
  "params": {
      "example.type.baz": {
          "example_key": "foobar"
      }
  },
  "session": "xxxxxx"
}
```

Individual stages may require more than one request to complete, in
which case the response will be as if the request was unauthenticated
with the addition of any other keys as defined by the auth type.

If the homeserver decides that an attempt on a stage was unsuccessful,
but the client may make a second attempt, it returns the same HTTP
status 401 response as above, with the addition of the standard
`errcode` and `error` fields describing the error. For example:

```nohighlight
HTTP/1.1 401 Unauthorized
Content-Type: application/json
```

```json
{
  "errcode": "M_FORBIDDEN",
  "error": "Invalid password",
  "completed": [ "example.type.foo" ],
  "flows": [
    {
      "stages": [ "example.type.foo", "example.type.bar" ]
    },
    {
      "stages": [ "example.type.foo", "example.type.baz" ]
    }
  ],
  "params": {
      "example.type.baz": {
          "example_key": "foobar"
      }
  },
  "session": "xxxxxx"
}
```

If the request fails for a reason other than authentication, the server
returns an error message in the standard format. For example:

```nohighlight
HTTP/1.1 400 Bad request
Content-Type: application/json
```

```json
{
  "errcode": "M_EXAMPLE_ERROR",
  "error": "Something was wrong"
}
```

If the client has completed all stages of a flow, the homeserver
performs the API call and returns the result as normal. Completed stages
cannot be retried by clients, therefore servers must return either a 401
response with the completed stages, or the result of the API call if all
stages were completed when a client retries a stage.

Some authentication types may be completed by means other than through
the Matrix client, for example, an email confirmation may be completed
when the user clicks on the link in the email. In this case, the client
retries the request with an auth dict containing only the session key.
The response to this will be the same as if the client were attempting
to complete an auth state normally, i.e. the request will either
complete or request auth, with the presence or absence of that auth type
in the 'completed' array indicating whether that stage is complete.

{{% boxes/note %}}
A request to an endpoint that uses User-Interactive Authentication never
succeeds without auth. Homeservers may allow requests that don't require
auth by offering a stage with only the `m.login.dummy` auth type, but they
must still give a 401 response to requests with no auth data.
{{% /boxes/note %}}

**Example**

At a high level, the requests made for an API call completing an auth
flow with three stages will resemble the following diagram:

```nohighlight
    _______________________
    |       Stage 0         |
    | No auth               |
    |  ___________________  |
    | |_Request_1_________| | <-- Returns "session" key which is used throughout.
    |_______________________|
             |
             |
    _________V_____________
    |       Stage 1         |
    | type: "<auth type1>"  |
    |  ___________________  |
    | |_Request_1_________| |
    |_______________________|
             |
             |
    _________V_____________
    |       Stage 2         |
    | type: "<auth type2>"  |
    |  ___________________  |
    | |_Request_1_________| |
    |  ___________________  |
    | |_Request_2_________| |
    |  ___________________  |
    | |_Request_3_________| |
    |_______________________|
             |
             |
    _________V_____________
    |       Stage 3         |
    | type: "<auth type3>"  |
    |  ___________________  |
    | |_Request_1_________| | <-- Returns API response
    |_______________________|
```

##### Authentication types

This specification defines the following auth types:
-   `m.login.password`
-   `m.login.recaptcha`
-   `m.login.sso`
-   `m.login.email.identity`
-   `m.login.msisdn`
-   `m.login.dummy`
-   `m.login.registration_token`
-   {{% added-in v="1.11" %}} `m.login.terms`
-   {{% added-in v="1.17" %}} `m.oauth`

###### Password-based


| Type               | Description                                                                    |
|--------------------|--------------------------------------------------------------------------------|
| `m.login.password` | The client submits an identifier and secret password, both sent in plain-text. |

To use this authentication type, clients should submit an auth dict as
follows:

```nohighlight
{
  "type": "m.login.password",
  "identifier": {
    ...
  },
  "password": "<password>",
  "session": "<session ID>"
}
```

where the `identifier` property is a user identifier object, as
described in [Identifier types](#identifier-types).

For example, to authenticate using the user's Matrix ID, clients would
submit:

```json
{
  "type": "m.login.password",
  "identifier": {
    "type": "m.id.user",
    "user": "<user_id or user localpart>"
  },
  "password": "<password>",
  "session": "<session ID>"
}
```

Alternatively reply using a 3PID bound to the user's account on the
homeserver using the [`/account/3pid`](#get_matrixclientv3account3pid) API rather than giving the `user`
explicitly as follows:

```json
{
  "type": "m.login.password",
  "identifier": {
    "type": "m.id.thirdparty",
    "medium": "<The medium of the third-party identifier.>",
    "address": "<The third-party address of the user>"
  },
  "password": "<password>",
  "session": "<session ID>"
}
```

In the case that the homeserver does not know about the supplied 3PID,
the homeserver must respond with 403 Forbidden.

###### Google ReCaptcha

| Type                | Description                                          |
|---------------------|------------------------------------------------------|
| `m.login.recaptcha` | The user completes a Google ReCaptcha 2.0 challenge. |

To use this authentication type, clients should submit an auth dict as
follows:

```json
{
  "type": "m.login.recaptcha",
  "response": "<captcha response>",
  "session": "<session ID>"
}
```

###### Single Sign-On

| Type          | Description                                                                          |
|---------------|--------------------------------------------------------------------------------------|
| `m.login.sso` | Authentication is supported by authorising with an external single sign-on provider. |

A client wanting to complete authentication using SSO should use the
[Fallback](#fallback) mechanism. See [SSO during User-Interactive
Authentication](#sso-during-user-interactive-authentication) for more information.

###### Email-based (identity / homeserver)

| Type                     | Description                                                                                                      |
|--------------------------|------------------------------------------------------------------------------------------------------------------|
| `m.login.email.identity` | Authentication is supported by authorising an email address with an identity server, or homeserver if supported. |

Prior to submitting this, the client should authenticate with an
identity server (or homeserver). After authenticating, the session
information should be submitted to the homeserver.

To use this authentication type, clients should submit an auth dict as
follows:

```json
{
  "type": "m.login.email.identity",
  "threepid_creds": {
    "sid": "<identity server session id>",
    "client_secret": "<identity server client secret>",
    "id_server": "<url of identity server authed with, e.g. 'matrix.org:8090'>",
    "id_access_token": "<access token previously registered with the identity server>"
  },
  "session": "<session ID>"
}
```

Note that `id_server` (and therefore `id_access_token`) is optional if
the [`/requestToken`](#post_matrixclientv3registeremailrequesttoken) request did not include them.

###### Phone number/MSISDN-based (identity / homeserver)

| Type             | Description                                                                                                    |
|------------------|----------------------------------------------------------------------------------------------------------------|
| `m.login.msisdn` | Authentication is supported by authorising a phone number with an identity server, or homeserver if supported. |

Prior to submitting this, the client should authenticate with an
identity server (or homeserver). After authenticating, the session
information should be submitted to the homeserver.

To use this authentication type, clients should submit an auth dict as
follows:

```json
{
  "type": "m.login.msisdn",
  "threepid_creds": {
    "sid": "<identity server session id>",
    "client_secret": "<identity server client secret>",
    "id_server": "<url of identity server authed with, e.g. 'matrix.org:8090'>",
    "id_access_token": "<access token previously registered with the identity server>"
  },
  "session": "<session ID>"
}
```

Note that `id_server` (and therefore `id_access_token`) is optional if
the [`/requestToken`](#post_matrixclientv3registermsisdnrequesttoken) request did not include them.

###### Dummy Auth

| Type             | Description                                                            |
|------------------|------------------------------------------------------------------------|
| `m.login.dummy`  | Dummy authentication always succeeds and requires no extra parameters. |

The purpose of dummy authentication is to allow servers to not require any form of
User-Interactive Authentication to perform a request. It can also be
used to differentiate flows where otherwise one flow would be a subset
of another flow. e.g. if a server offers flows `m.login.recaptcha` and
`m.login.recaptcha, m.login.email.identity` and the client completes the
recaptcha stage first, the auth would succeed with the former flow, even
if the client was intending to then complete the email auth stage. A
server can instead send flows `m.login.recaptcha, m.login.dummy` and
`m.login.recaptcha, m.login.email.identity` to fix the ambiguity.

To use this authentication type, clients should submit an auth dict with
just the type and session, if provided:

```json
{
  "type": "m.login.dummy",
  "session": "<session ID>"
}
```

###### Token-authenticated registration

{{% added-in v="1.2" %}}

| Type                          | Description                                                       |
|-------------------------------|-------------------------------------------------------------------|
| `m.login.registration_token`  | Registers an account with a pre-shared token for authentication   |

{{% boxes/note %}}
The `m.login.registration_token` authentication type is only valid on the
[`/register`](#post_matrixclientv3register) endpoint.
{{% /boxes/note %}}

This authentication type provides homeservers the ability to allow registrations
to a limited set of people instead of either offering completely open registrations
or completely closed registration (where the homeserver administrators create
and distribute accounts).

The token required for this authentication type is shared out of band from
Matrix and is an opaque string using the [Opaque Identifier
Grammar](/appendices#opaque-identifiers), with maximum length of 64
characters. The server can keep any number of tokens for any length of
time/validity. Such cases might be a token limited to 100 uses or for the next
2 hours - after the tokens expire, they can no longer be used to create
accounts.

To use this authentication type, clients should submit an auth dict with just
the type, token, and session:

```json
{
  "type": "m.login.registration_token",
  "token": "fBVFdqVE",
  "session": "<session ID>"
}
```

To determine if a token is valid before attempting to use it, the client can
use the `/validity` API defined below. The API doesn't guarantee that a token
will be valid when used, but does avoid cases where the user finds out late
in the registration process that their token has expired.

{{% http-api spec="client-server" api="registration_tokens" %}}

###### Terms of service at registration

{{% added-in v="1.11" %}}

| Type                     | Description                                                              |
|--------------------------|--------------------------------------------------------------------------|
| `m.login.terms`          | Authentication requires the user to accept a set of policy documents. |

{{% boxes/note %}}
The `m.login.terms` authentication type is only valid on the
[`/register`](#post_matrixclientv3register) endpoint.
{{% /boxes/note %}}

This authentication type is used when the homeserver requires new users to
accept a given set of policy documents, such as a terms of service and a privacy
policy. There may be many different types of documents, all of which are
versioned and presented in (potentially) multiple languages.

When the server requires the user to accept some terms, it does so by returning
a 401 response to the `/register` request, where the response body includes
`m.login.terms` in the `flows` list, and the `m.login.terms` property in the
`params` object has the structure [shown below](#definition-mloginterms-params).

If a client encounters an invalid parameter, registration should stop with an
error presented to the user.

The client should present the user with a checkbox to accept each policy,
including a link to the provided URL. Once the user has done so, the client
submits an `auth` dict with just the `type` and `session`, as follows, to
indicate that all of the policies have been accepted:

```json
{
  "type": "m.login.terms",
  "session": "<session ID>"
}
```

The server is expected to track which document versions it presented to the
user during registration, if applicable.


**Example**

1. A client might submit a registration request as follows:

   ```nohighlight
   POST /_matrix/client/v3/register
   ```
   ```json
   {
     "username": "cheeky_monkey",
     "password": "ilovebananas"
   }
   ```

2. The server requires the user to accept some terms of service before
   registration, so returns the following response:

   ```nohighlight
   HTTP/1.1 401 Unauthorized
   Content-Type: application/json
   ```
   ```json
   {
     "flows": [
       { "stages": [ "m.login.terms" ] }
     ],
     "params": {
       "m.login.terms": {
         "policies": {
           "terms_of_service": {
             "version": "1.2",
             "en": {
                 "name": "Terms of Service",
                 "url": "https://example.org/somewhere/terms-1.2-en.html"
             },
             "fr": {
                 "name": "Conditions d'utilisation",
                 "url": "https://example.org/somewhere/terms-1.2-fr.html"
             }
           }
         }
       }
     },
     "session": "kasgjaelkgj"
   }
   ```

3. The client presents the list of documents to the user, inviting them to
   accept the polices.

4. The client repeats the registration request, confirming that the user has
   accepted the documents:
   ```nohighlight
   POST /_matrix/client/v3/register
   ```
   ```json
   {
     "username": "cheeky_monkey",
     "password": "ilovebananas",
     "auth": {
       "type": "m.login.terms",
       "session": "kasgjaelkgj"
     }
   }
   ```

5. All authentication steps have now completed, so the request is successful:
   ```nohighlight
   HTTP/1.1 200 OK
   Content-Type: application/json
   ```
   ```json
   {
     "access_token": "abc123",
     "device_id": "GHTYAJCE",
     "user_id": "@cheeky_monkey:matrix.org"
   }
   ```

{{% definition path="api/client-server/definitions/m.login.terms_params" %}}

###### OAuth authentication

{{% added-in v="1.17" %}}

| Type                          | Description                                                       |
|-------------------------------|-------------------------------------------------------------------|
| `m.oauth`                     | Authentication is supported by authorising via the homeserver's OAuth account management web UI. |

{{% boxes/note %}}
The `m.oauth` authentication type is currently only valid on the
[`/keys/device_signing/upload`](/client-server-api/#post_matrixclientv3keysdevice_signingupload) endpoint.
{{% /boxes/note %}}

This authentication type provides homeservers the ability to guard access to
sensitive actions when the client has authenticated via the
[OAuth 2.0 API](/client-server-api/#oauth-20-api), which is otherwise not
compatible with User-Interactive Authentication (UIA). To do so, the server
returns a 401 response on the respective request, where the response body
includes `m.oauth` in the `flows` list, and the `m.oauth` property in the
`params` object has the structure [shown below](#definition-moauth-params).

The client is expected to open the contained URL to let the user confirm the
action in the homeserver's account management web UI. Once the user has done
so, the client submits an `auth` dict with just the `session`, as follows,
to complete the stage:

```json
{
  "session": "<session ID>"
}
```

{{% definition path="api/client-server/definitions/m.oauth_params" %}}

##### Fallback

Clients cannot be expected to be able to know how to process every
single login type. If a client does not know how to handle a given login
type, it can direct the user to a web browser with the URL of a fallback
page which will allow the user to complete that login step out-of-band
in their web browser. The URL it should open is:

    /_matrix/client/v3/auth/<auth type>/fallback/web?session=<session ID>

Where `auth type` is the type name of the stage it is attempting and
`session ID` is the ID of the session given by the homeserver.

This MUST return an HTML page which can perform this authentication
stage. This page must use the following JavaScript when the
authentication has been completed:

```js
if (window.onAuthDone) {
    window.onAuthDone();
} else if (window.opener && window.opener.postMessage) {
    window.opener.postMessage("authDone", "*");
}
```

This allows the client to either arrange for the global function
`onAuthDone` to be defined in an embedded browser, or to use the HTML5
[cross-document
messaging](https://www.w3.org/TR/webmessaging/#web-messaging) API, to
receive a notification that the authentication stage has been completed.

Once a client receives the notification that the authentication stage
has been completed, it should resubmit the request with an auth dict
with just the session ID:

```json
{
  "session": "<session ID>"
}
```

**Example**

A client webapp might use the following JavaScript to open a popup
window which will handle unknown login types:

```js
/**
 * Arguments:
 *     homeserverUrl: the base url of the homeserver (e.g. "https://matrix.org")
 *
 *     apiEndpoint: the API endpoint being used (e.g.
 *        "/_matrix/client/v3/account/password")
 *
 *     loginType: the loginType being attempted (e.g. "m.login.recaptcha")
 *
 *     sessionID: the session ID given by the homeserver in earlier requests
 *
 *     onComplete: a callback which will be called with the results of the request
 */
function unknownLoginType(homeserverUrl, apiEndpoint, loginType, sessionID, onComplete) {
    var popupWindow;

    var eventListener = function(ev) {
        // check it's the right message from the right place.
        if (ev.data !== "authDone" || ev.origin !== homeserverUrl) {
            return;
        }

        // close the popup
        popupWindow.close();
        window.removeEventListener("message", eventListener);

        // repeat the request
        var requestBody = {
            auth: {
                session: sessionID,
            },
        };

        request({
            method:'POST', url:apiEndpoint, json:requestBody,
        }, onComplete);
    };

    window.addEventListener("message", eventListener);

    var url = homeserverUrl +
        "/_matrix/client/v3/auth/" +
        encodeURIComponent(loginType) +
        "/fallback/web?session=" +
        encodeURIComponent(sessionID);

   popupWindow = window.open(url);
}
```

##### Identifier types

Some authentication mechanisms use a user identifier object to identify
a user. The user identifier object has a `type` field to indicate the
type of identifier being used, and depending on the type, has other
fields giving the information required to identify the user as described
below.

This specification defines the following identifier types:
-   `m.id.user`
-   `m.id.thirdparty`
-   `m.id.phone`

###### Matrix User ID

| Type        | Description                                |
|-------------|--------------------------------------------|
| `m.id.user` | The user is identified by their Matrix ID. |

A client can identify a user using their Matrix ID. This can either be
the fully qualified Matrix user ID, or just the localpart of the user
ID.

```json
"identifier": {
  "type": "m.id.user",
  "user": "<user_id or user localpart>"
}
```

###### Third-party ID

| Type              | Description                                                               |
|-------------------|---------------------------------------------------------------------------|
| `m.id.thirdparty` | The user is identified by a third-party identifier in canonicalised form. |

A client can identify a user using a 3PID associated with the user's
account on the homeserver, where the 3PID was previously associated
using the [`/account/3pid`](#get_matrixclientv3account3pid) API. See the [3PID
Types](/appendices#3pid-types) Appendix for a list of Third-party
ID media.

```json
"identifier": {
  "type": "m.id.thirdparty",
  "medium": "<The medium of the third-party identifier>",
  "address": "<The canonicalised third-party address of the user>"
}
```

###### Phone number

| Type         | Description                               |
|--------------|-------------------------------------------|
| `m.id.phone` | The user is identified by a phone number. |

A client can identify a user using a phone number associated with the
user's account, where the phone number was previously associated using
the [`/account/3pid`](#get_matrixclientv3account3pid) API. The phone number can be passed in as entered
by the user; the homeserver will be responsible for canonicalising it.
If the client wishes to canonicalise the phone number, then it can use
the `m.id.thirdparty` identifier type with a `medium` of `msisdn`
instead.

```json
"identifier": {
  "type": "m.id.phone",
  "country": "<The country that the phone number is from>",
  "phone": "<The phone number>"
}
```

The `country` is the two-letter uppercase ISO-3166-1 alpha-2 country
code that the number in `phone` should be parsed as if it were dialled
from.

#### Login {id="legacy-login"}

A client can obtain access tokens using the [`/login`](#post_matrixclientv3login) API.

Note that this endpoint does <span class="title-ref">not</span>
currently use the [User-Interactive Authentication
API](#user-interactive-authentication-api).

For a simple username/password login, clients should submit a `/login`
request as follows:

```json
{
  "type": "m.login.password",
  "identifier": {
    "type": "m.id.user",
    "user": "<user_id or user localpart>"
  },
  "password": "<password>"
}
```

Alternatively, a client can use a 3PID bound to the user's account on
the homeserver using the [`/account/3pid`](#get_matrixclientv3account3pid) API rather than giving the
`user` explicitly, as follows:

```json
{
  "type": "m.login.password",
  "identifier": {
    "medium": "<The medium of the third-party identifier>",
    "address": "<The canonicalised third-party address of the user>"
  },
  "password": "<password>"
}
```

In the case that the homeserver does not know about the supplied 3PID,
the homeserver must respond with `403 Forbidden`.

To log in using a login token, clients should submit a `/login` request
as follows:

```json
{
  "type": "m.login.token",
  "token": "<login token>"
}
```

The `token` must encode the user ID, since there is no other identifying
data in the request. In the case that the token is not valid, the homeserver must
respond with `403 Forbidden` and an error code of `M_FORBIDDEN`.

If the homeserver advertises `m.login.sso` as a viable flow, and the
client supports it, the client should redirect the user to the
`/redirect` endpoint for [client login via SSO](#client-login-via-sso). After authentication
is complete, the client will need to submit a `/login` request matching
`m.login.token`.

{{% added-in v="1.7" %}} Already-authenticated clients can additionally generate
a token for their user ID if supported by the homeserver using
[`POST /login/get_token`](/client-server-api/#post_matrixclientv1loginget_token).

{{% http-api spec="client-server" api="login" %}}

{{% http-api spec="client-server" api="login_token" %}}

{{% http-api spec="client-server" api="refresh" %}}

{{% http-api spec="client-server" api="logout" %}}

##### Appservice Login

{{% added-in v="1.2" %}}

An appservice can log in by providing a valid appservice token and a user within the appservice's
namespace.

{{% boxes/note %}}
Appservices do not need to log in as individual users in all cases, as they
can perform [Identity Assertion](/application-service-api#identity-assertion)
using the appservice token. However, if the appservice needs a scoped token
for a single user then they can use this API instead.
{{% /boxes/note %}}

This request must be authenticated by the [appservice `as_token`](/application-service-api#registration)
(see [Client Authentication](#client-authentication) on how to provide the token).

To use this login type, clients should submit a `/login` request as follows:

```json
{
  "type": "m.login.application_service",
  "identifier": {
    "type": "m.id.user",
    "user": "<user_id or user localpart>"
  }
}
```

If the access token is not valid, does not correspond to an appservice
or the user has not previously been registered then the homeserver will
respond with an errcode of `M_FORBIDDEN`.

If the access token does correspond to an appservice, but the user id does
not lie within its namespace then the homeserver will respond with an
errcode of `M_EXCLUSIVE`.

{{% added-in v="1.17" %}} If this login type is used and the server doesn't
support logging in via the Legacy authentication API, it MUST return a 400 HTTP
status code with an `M_APPSERVICE_LOGIN_UNSUPPORTED` error code.

##### Login Fallback

If a client does not recognize any or all login flows it can use the
fallback login API:

    GET /_matrix/static/client/login/

This returns an HTML and JavaScript page which can perform the entire
login process. The page will attempt to call the JavaScript function
`window.matrixLogin.onLogin(response)` when login has been successfully
completed. The argument, `response`, is the JSON response body of
[`POST /_matrix/client/v3/login`](#post_matrixclientv3login) parsed
into a JavaScript object.

{{% added-in v="1.1" %}} Non-credential parameters valid for the `/login`
endpoint can be provided as query string parameters here. These are to be
forwarded to the login endpoint during the login process. For example:

    GET /_matrix/static/client/login/?device_id=GHTYAJCE

#### Account registration {id="legacy-account-registration"}

{{% http-api spec="client-server" api="registration" %}}

#### Account management {id="legacy-account-management"}

##### Password management

{{% boxes/warning %}}
Clients SHOULD enforce that the password provided is suitably complex.
The password SHOULD include a lower-case letter, an upper-case letter, a
number and a symbol and be at a minimum 8 characters in length. Servers
MAY reject weak passwords with an error code `M_WEAK_PASSWORD`.
{{% /boxes/warning %}}

{{% http-api spec="client-server" api="password_management" %}}

##### Account deactivation

{{% http-api spec="client-server" api="account_deactivation" %}}

#### OAuth 2.0 aware clients

{{% added-in v="1.18" %}}

This is a compatibility feature to aide clients in the transition to the OAuth
2.0 API. It allows clients that only support the legacy API to make some
less-invasive changes to improve the user experience when talking to a
homeserver that is using the OAuth 2.0 API without actually having to implement
the full OAuth 2.0 API.

##### Client behaviour

For a client to be considered fully OAuth 2.0 aware it MUST:

* Support the [`m.login.sso` authentication flow](#client-login-via-sso).
* Where a `oauth_aware_preferred` value of `true` is present on an `m.login.sso`
  flow, *only* offer that auth flow to the user.
* Append `action=login` or `action=register` parameters to the [SSO redirect
  endpoints](#get_matrixclientv3loginssoredirect). The client might determine
  the value to use based on whether the user clicked a "Login" or "Register"
  button.
* Check and honour the [`m.3pid_changes` capability](#m3pid_changes-capability)
  so that the user is not offered the ability to add or remove 3PIDs if the
  homeserver says the capability is not available.
* Determine if the homeserver is using the OAuth 2.0 API by using
  [server metadata discovery](#get_matrixclientv1auth_metadata) from the OAuth
  2.0 API.
* If a homeserver is using the OAuth 2.0 API as discovered in the previous step
  then the client MUST redirect users to manage their account at the [account
  management URL](#oauth-20-account-management), if available, instead of
  providing a native UI using the legacy API endpoints.
  
  * If the user wishes to deactivate their account then the client MUST refer
    them to the account management URL.
  * If the user wishes to sign out a device other than its own then the client
    MUST deep link the user to the account management URL by adding the
    `action=org.matrix.device_delete` and `device_id=<device_id>` parameters so
    that the web UI knows that the user wishes to sign out a device and which
    one it is.

Optionally, an OAuth 2.0 aware client MAY:

* Label the SSO button as "Continue" rather than "SSO" when
  `oauth_aware_preferred` is `true`. This is because after redirect the server
  may then offer a password and/or further upstream IdPs.
* Pass other [account management URL parameters](#account-management-url-parameters)
  for context when linking to the account web UI.

##### Server behaviour

For a homeserver to provide support for OAuth 2.0 aware clients it MUST:

* Support the [OAuth 2.0 API](#oauth-20-api).
* Provide an implementation of the [`m.login.sso` authentication flow](#client-login-via-sso)
  from the legacy API.
* If password authentication was previously enabled on the homeserver then
  provide an implementation of the [`m.login.password` authentication flow](#legacy-login)
  from the legacy API.
* Indicate that the `m.login.sso` flow is preferred by setting
  `oauth_aware_preferred` to `true`.
* Support a value for the `action` param on the [SSO redirect endpoints](#get_matrixclientv3loginssoredirect).

Additionally, the homeserver SHOULD:

* Advertise the [account management URL](#oauth-20-account-management) in the
  [server metadata](#get_matrixclientv1auth_metadata).

### OAuth 2.0 API

{{% added-in v="1.15" %}}

Contrary to the legacy API that uses custom endpoints and UIA, this
authentication API is based on the [OAuth 2.0](https://oauth.net/2/) industry
standard introduced in [RFC 6749](https://datatracker.ietf.org/doc/html/rfc6749)
and extended by other RFCs, with a few features from [OpenID Connect](https://openid.net/connect/).
This allows us to benefit from its experience and from any further enhancements
or best practice recommendations.

The main change for end users with this API is that all the account management
occurs in their browser on the homeserver's web UI. This is where they will
register a new account or log into an existing account and authorize a client to
access their Matrix account. This means that the homeserver has complete control
over the requirements to create a new account and is not limited by the steps
defined in this specification. It also means that less trust is given to clients
because they don't have access to the user's credentials anymore.

{{% boxes/warning %}}
The [User-Interactive Authentication API](#user-interactive-authentication-api)
is not compatible with the OAuth 2.0 API, so the endpoints that depend on it for
authentication can't be used when an access token is obtained with this API.

The only exception to this is the
[`/keys/device_signing/upload`](/client-server-api/#post_matrixclientv3keysdevice_signingupload)
endpoint which uses the [`m.oauth`](/client-server-api/#oauth-authentication)
authentication type.
{{% /boxes/warning %}}

**Sample flow**

1. [Discover the OAuth 2.0 server metadata](#server-metadata-discovery).
2. [Register the client with the homeserver](#client-registration).
3. [Obtain an access token](#login-flow) by authorizing a [scope](#scope) for the client with the [authorization code grant](#authorization-code-grant).
4. [Refresh the access token](#token-refresh-flow) with the [refresh token grant](#refresh-token-grant) when it expires.
5. [Revoke the tokens](#token-revocation) when the users wants to log out of the client.

#### Login flow

Logging in with the OAuth 2.0 API should be done with the [authorization code
grant](#authorization-code-grant). In the context of the Matrix specification,
this means requesting a [scope](#scope) including full client-server API
read/write access and allocating a device ID.

Once the client has retrieved the [server metadata](#server-metadata-discovery),
it needs to generate the following values:

- `device_id`: a unique identifier for this device; see the
  [`urn:matrix:client:device:<device_id>`](#device-id-allocation) scope token.
- `state`: a unique opaque identifier, like a [transaction ID](#transaction-identifiers),
  that will allow the client to maintain state between the authorization request
  and the callback.
- `code_verifier`: a cryptographically random value that will allow to make sure
  that the client that makes the token request for a given `code` is the same
  one that made the authorization request.

  It is defined in [RFC 7636](https://datatracker.ietf.org/doc/html/rfc7636) as
  a high-entropy cryptographic random string using the characters `[A-Z]`,
  `[a-z]`, `[0-9]`, `-`, `.`, `_` and `~` with a minimum length of 43 characters
  and a maximum length of 128 characters.

**Authorization request**

The client then constructs the authorization request URL using the
`authorization_endpoint` value, with the following query parameters:

| Parameter               | Value                                              |
|-------------------------|----------------------------------------------------|
| `response_type`         | `code`                                             |
| `client_id`             | The client ID returned from client registration.   |
| `redirect_uri`          | The redirect URI that MUST match one of the values registered in the client metadata |
| `scope`                 | `urn:matrix:client:api:* urn:matrix:client:device:<device_id>` with the `device_id` generated previously. |
| `state`                 | The `state` value generated previously.            |
| `response_mode`         | `fragment` or `query` (see "[Callback](#callback)" below). |
| `code_challenge`        | Computed from the `code_verifier` value generated previously using the SHA-256 algorithm, as described in [RFC 7636](https://datatracker.ietf.org/doc/html/rfc7636). |
| `code_challenge_method` | `S256`                                             |

This authorization request URL must be opened in the user's browser:

- For web-based clients, this can be done through a redirection or by opening
  the URL in a new tab.
- For native clients, this can be done by opening the URL using the system
  browser, or, when available, through platform-specific APIs such as
  [`ASWebAuthenticationSession`](https://developer.apple.com/documentation/authenticationservices/aswebauthenticationsession)
  on iOS or [Android Custom Tabs](https://developer.chrome.com/docs/android/custom-tabs).

Sample authorization request, with extra whitespaces for readability:

```nohighlight
https://account.example.com/oauth2/auth?
    client_id     = s6BhdRkqt3 &
    response_type = code &
    response_mode = fragment &
    redirect_uri  = https://app.example.com/oauth2-callback &
    scope         = urn:matrix:client:api:* urn:matrix:client:device:AAABBBCCCDDD &
    state         = ewubooN9weezeewah9fol4oothohroh3 &
    code_challenge        = 72xySjpngTcCxgbPfFmkPHjMvVDl2jW1aWP7-J6rmwU &
    code_challenge_method = S256
```

<a id="callback"></a> **Callback**

Once completed, the user is redirected to the `redirect_uri`, with either a
successful or failed authorization in the URL fragment or query parameters.
Whether the parameters are in the URL fragment or query parameters is determined
by the `response_mode` value:

- If set to `fragment`, the parameters will be placed in the URL fragment, like
  `https://example.com/callback#param1=value1&param2=value2`.
- If set to `query`, the parameters will be in placed the query string, like
  `com.example.app:/callback?param1=value1&param2=value2`.

To avoid disclosing the parameters to the web server hosting the `redirect_uri`,
clients SHOULD use the `fragment` response mode if the `redirect_uri` is an
HTTPS URI with a remote host.

In both success and failure cases, the parameters will include the `state` value
used in the authorization request.

A successful authorization will have a `code` value, for example:

```nohighlight
https://app.example.com/oauth2-callback#state=ewubooN9weezeewah9fol4oothohroh3&code=iuB7Eiz9heengah1joh2ioy9ahChuP6R
```

A failed authorization will have the following values:

- `error`: the error code
- `error_description`: the error description (optional)
- `error_uri`: the URI where the user can find more information about the error (optional)

For example:

```nohighlight
https://app.example.com/oauth2-callback#state=ewubooN9weezeewah9fol4oothohroh3&error=access_denied&error_description=The+resource+owner+or+authorization+server+denied+the+request.&error_uri=https%3A%2F%2Ferrors.example.com%2F
```

**Token request**

The client then exchanges the authorization code to obtain an access token using
the token endpoint.

This is done by making a POST request to the `token_endpoint` with the following
parameters, encoded as `application/x-www-form-urlencoded` in the body:

| Parameter       | Value                                                      |
|-----------------|------------------------------------------------------------|
| `grant_type`    | `authorization_code`                                       |
| `code`          | The value of `code` obtained from the callback.            |
| `redirect_uri`  | The same `redirect_uri` used in the authorization request. |
| `client_id`     | The client ID returned from client registration.           |
| `code_verifier` | The value generated at the start of the authorization flow. |

The server replies with a JSON object containing the access token, the token
type, the expiration time, and the refresh token.

Sample token request:

```nohighlight
POST /oauth2/token HTTP/1.1
Host: account.example.com
Content-Type: application/x-www-form-urlencoded
Accept: application/json

grant_type=authorization_code
  &code=iuB7Eiz9heengah1joh2ioy9ahChuP6R
  &redirect_uri=https://app.example.com/oauth2-callback
  &client_id=s6BhdRkqt3
  &code_verifier=ogie4iVaeteeKeeLaid0aizuimairaCh
```

Sample response:

```json
{
  "access_token": "2YotnFZFEjr1zCsicMWpAA",
  "token_type": "Bearer",
  "expires_in": 299,
  "refresh_token": "tGz3JOkF0XG5Qx2TlKWIA",
  "scope": "urn:matrix:client:api:* urn:matrix:client:device:AAABBBCCCDDD"
}
```

Finally, the client can call the  [`/whoami`](#get_matrixclientv3accountwhoami)
endpoint to get the user ID that owns the access token.

#### Token refresh flow

Refreshing a token with the OAuth 2.0 API should be done with the [refresh token
grant](#refresh-token-grant).

When the access token expires, the client must refresh it by making a `POST`
request to the `token_endpoint` with the following parameters, encoded as
`application/x-www-form-urlencoded` in the body:

| Parameter       | Value                                                      |
|-----------------|------------------------------------------------------------|
| `grant_type`    | `refresh_token`                                            |
| `refresh_token` | The `refresh_token` obtained from the token response during the last token request. |
| `client_id`     | The client ID returned from client registration.           |

The server replies with a JSON object containing the new access token, the token
type, the expiration time, and a new refresh token, like in the authorization
flow.

#### Server metadata discovery

{{% http-api spec="client-server" api="oauth_server_metadata" %}}

#### Client registration

Before being able to use the authorization flow to obtain an access token, a
client needs to obtain a `client_id` by registering itself with the server.

This should be done via OAuth 2.0 Dynamic Client Registration as defined in
[RFC 7591](https://datatracker.ietf.org/doc/html/rfc7591).

##### Client metadata

In OAuth 2.0, clients register a set of metadata values with the authorization
server, which associates it with a newly generated `client_id`. These values are
used to describe the client to the user and define how the client interacts with
the server.

{{% definition path="schemas/oauth2-client-metadata" %}}

###### Metadata localization

As per [RFC 7591 section 2.2](https://tools.ietf.org/html/rfc7591#section-2.2),
all the human-readable metadata values MAY be localized.

The human-readable values include:
- `client_name`
- `logo_uri`
- `tos_uri`
- `policy-uri`

For example:

```json
{
  "client_name": "Digital mailbox",
  "client_name#en-US": "Digital mailbox",
  "client_name#en-GB": "Digital postbox",
  "client_name#fr": "Boîte aux lettres numérique",
  "tos_uri": "https://example.com/tos.html",
  "tos_uri#fr": "https://example.com/fr/tos.html",
  "policy_uri": "https://example.com/policy.html",
  "policy_uri#fr": "https://example.com/fr/policy.html"
}
```

###### Redirect URI validation

The redirect URI plays a critical role in validating the authenticity of the
client. The client "proves" its identity by demonstrating that it controls the
redirect URI. This is why it is critical to have strict validation of the
redirect URI.

The `application_type` metadata is used to determine the type of client.

In all cases, the redirect URI MUST NOT have a fragment component.

**Web clients**

`web` clients can use redirect URIs that:

- MUST use the `https` scheme.
- MUST NOT use a user or password in the authority component of the URI.
- MUST use the client URI as a common base for the authority component, as
  defined previously.
- MAY include an `application/x-www-form-urlencoded` formatted query component.

For example, with `https://example.com/` as the client URI, the following are
valid redirect URIs:
- `https://example.com/callback`
- `https://app.example.com/callback`
- `https://example.com:5173/?query=value`

With the same client URI, the following are invalid redirect URIs:
- `https://example.com/callback#fragment`
- `http://example.com/callback`
- `http://localhost/`

**Native clients**

`native` clients can use three types of redirect URIs:

1. **Private-Use URI Scheme**
    - The scheme MUST be prefixed with the client URI hostname in reverse-DNS
      notation. For example, if the client URI is `https://example.com/`, then a
      valid custom URI scheme would be `com.example.app:/`.
    - There MUST NOT be an authority component. This means that the URI MUST have
      either a single slash or none immediately following the scheme, with no
      hostname, username, or port.
2. **`http` URI on the loopback interface**
    - The scheme MUST be `http`.
    - The host part MUST be `localhost`, `127.0.0.1`, or `[::1]`.
    - There MUST NOT be a port. The homeserver MUST then accept any port number
      during the authorization flow.
3. **Claimed `https` Scheme URI**

    Some operating systems allow apps to claim `https` scheme URIs in the
    domains they control. When the browser encounters a claimed URI, instead of
    the page being loaded in the browser, the native app is launched with the
    URI supplied as a launch parameter. The same rules as for `web` clients
    apply.

These restrictions are the same as defined by [RFC 8252 section 7](https://tools.ietf.org/html/rfc8252#section-7).

For example, with `https://example.com/` as the client URI,

These are valid redirect URIs:
- `com.example.app:/callback`
- `com.example:/`
- `com.example:callback`
- `http://localhost/callback`
- `http://127.0.0.1/callback`
- `http://[::1]/callback`

These are invalid redirect URIs:
- `example:/callback`
- `com.example.app://callback`
- `https://localhost/callback`
- `http://localhost:1234/callback`

##### Dynamic client registration flow

To register, the client sends an HTTP `POST` request to the
`registration_endpoint`, which can be found in the [server metadata](#server-metadata-discovery).
The body of the request is the JSON-encoded [`OAuthClientMetadata`](#client-metadata).

For example, the client could send the following registration request:

```http
POST /register HTTP/1.1
Content-Type: application/json
Accept: application/json
Server: auth.example.com
```

```json
{
  "client_name": "My App",
  "client_name#fr": "Mon application",
  "client_uri": "https://example.com/",
  "logo_uri": "https://example.com/logo.png",
  "tos_uri": "https://example.com/tos.html",
  "tos_uri#fr": "https://example.com/fr/tos.html",
  "policy_uri": "https://example.com/policy.html",
  "policy_uri#fr": "https://example.com/fr/policy.html",
  "redirect_uris": ["https://app.example.com/callback"],
  "token_endpoint_auth_method": "none",
  "response_types": ["code"],
  "grant_types": [
    "authorization_code",
    "refresh_token",
    "urn:ietf:params:oauth:grant-type:token-exchange"
  ],
  "application_type": "web"
}
```

Upon successful registration, the server replies with an `HTTP 201 Created`
response, with a JSON object containing the allocated `client_id` and all the
registered metadata values.

With the registration request above, the server might reply with:

```json
{
  "client_id": "s6BhdRkqt3",
  "client_name": "My App",
  "client_uri": "https://example.com/",
  "logo_uri": "https://example.com/logo.png",
  "tos_uri": "https://example.com/tos.html",
  "policy_uri": "https://example.com/policy.html",
  "redirect_uris": ["https://app.example.com/callback"],
  "token_endpoint_auth_method": "none",
  "response_types": ["code"],
  "grant_types": ["authorization_code", "refresh_token"],
  "application_type": "web"
}
```

In this example, the server has not registered the locale-specific values for
`client_name`, `tos_uri`, and `policy_uri`, which is why they are not present in
the response. The server also does not support the
`urn:ietf:params:oauth:grant-type:token-exchange` grant type, which is why it is
not present in the response.

The client MUST store the `client_id` for future use.

To avoid the number of client registrations growing over time, the server MAY
choose to delete client registrations that don't have an active session. The
server MUST NOT delete client registrations that have an active session.

Clients MUST perform a new client registration at the start of each
authorization flow.

{{% boxes/note %}}
Because each client on each user device will do its own registration, they may
all have different `client_id`s. This means that the server may store the same
client registration multiple times, which could lead to a large number of client
registrations.

This can be mitigated by de-duplicating client registrations that have identical
metadata. By doing so, different users on different devices using the same
client can share a single `client_id`, reducing the overall number of
registrations.
{{% /boxes/note %}}

#### Scope

The client requests a scope in the OAuth 2.0 authorization flow, which is then
associated to the generated access and refresh tokens. This provides a framework
for obtaining user consent.

A scope is defined in [RFC 6749 section 3.3](https://datatracker.ietf.org/doc/html/rfc6749#section-3.3)
as a string containing a list of space-separated scope tokens.

{{% boxes/note %}}
The framework encourages the practice of obtaining additional user consent when
a client asks for a new scope that was not granted previously. This could be
used by future MSCs to replace the legacy [User-Interactive Authentication API](#user-interactive-authentication-api).
{{% /boxes/note %}}

##### Scope token format

All scope tokens related to Matrix should start with `urn:matrix:` and use the
`:` delimiter for further sub-division.

Scope tokens related to mapping of Client-Server API access levels should start
with `urn:matrix:client:`.

{{% boxes/note %}}
For MSCs that build on this namespace, unstable subdivisions should be used
whilst in development. For example, if MSCXXXX wants to introduce the
`urn:matrix:client:foo` scope, it could use
`urn:matrix:client:com.example.mscXXXX.foo` during development.
If it needs to introduce multiple scopes, like `urn:matrix:client:foo` and
`urn:matrix:client:bar`, it could use
`urn:matrix:client:com.example.mscXXXX:foo` and
`urn:matrix:client:com.example.mscXXXX:bar`.
{{% /boxes/note %}}

##### Allocated scope tokens

This specification defines the following scope tokens:
- [`urn:matrix:client:api:*`](#full-client-server-api-readwrite-access)
- [`urn:matrix:client:device:<device_id>`](#device-id-allocation)

###### Full client-server API read/write access

| Scope                     | Purpose                                     |
|---------------------------|---------------------------------------------|
| `urn:matrix:client:api:*` | Grants full access to the Client-Server API. |

{{% boxes/note %}}
This token matches the behavior of the legacy authentication API. Future MSCs
could introduce more fine-grained scope tokens like
`urn:matrix:client:api:read:*` for read-only access.
{{% /boxes/note %}}

###### Device ID allocation

| Scope                                  | Purpose                                                                                      |
|----------------------------------------|----------------------------------------------------------------------------------------------|
| `urn:matrix:client:device:<device_id>` | Allocates the given `device_id` and associates it to the generated access and refresh tokens. |

Contrary to the legacy login and registration APIs where the homeserver is
typically the one generating a `device_id` and providing it to the client, with
the OAuth 2.0 API, the client is responsible for allocating the `device_id`.

There MUST be exactly one `urn:matrix:client:device:<device_id>` token in the
requested scope in the login flow.

When generating a new `device_id`, the client SHOULD generate a random string
with enough entropy. It SHOULD only use characters from the unreserved character
list defined by [RFC 3986 section 2.3](https://datatracker.ietf.org/doc/html/rfc3986#section-2.3):

```nohighlight
unreserved = a-z / A-Z / 0-9 / "-" / "." / "_" / "~"
```

Using this alphabet, a 10 character string is enough to stand a sufficient
chance of being unique per user. The homeserver MAY reject a request for a
`device_id` that is not long enough or contains characters outside the
unreserved list.

In any case it MUST only use characters allowed by the OAuth 2.0 scope
definition in [RFC 6749 section 3.3](https://datatracker.ietf.org/doc/html/rfc6749#section-3.3),
which is defined as the following ASCII ranges:

```nohighlight
%x21 / %x23-5B / %x5D-7E
```

This definition matches:
- alphanumeric characters: `A-Z`, `a-z`, `0-9`
- the following characters: ``! # $ % & ' ( ) * + , - . / : ; < = > ? @ [ ] ^ _ ` { | } ~``

#### Grant types

[RFC 6749](https://datatracker.ietf.org/doc/html/rfc6749) and other RFCs define
several "grant types": ways to obtain an ["access token"](#using-access-tokens).

All these grants types require the client to know the following [authorization
server metadata](#server-metadata-discovery):
- `token_endpoint`
- `grant_types_supported`

The client must also have obtained a `client_id` by [registering with the server](#client-registration).

This specification supports the following grant types:
- [Authorization code grant](#authorization-code-grant)
- [Refresh token grant](#refresh-token-grant)

##### Authorization code grant

As per [RFC 6749 section 4.1](https://datatracker.ietf.org/doc/html/rfc6749#section-4.1),
the authorization code grant lets the client obtain an access token through a
browser redirect.

This grant requires the client to know the following [authorization server
metadata](#server-metadata-discovery):
- `authorization_endpoint`
- `response_types_supported`
- `response_mode_supported`

To use this grant, homeservers and clients MUST:

- Support the authorization code grant as per [RFC 6749 section 4.1](https://datatracker.ietf.org/doc/html/rfc6749#section-4.1).
- Support the [refresh token grant](#refresh-token-grant).
- Support PKCE using the `S256` code challenge method as per [RFC 7636](https://datatracker.ietf.org/doc/html/rfc7636).
- Use [pre-registered](#client-registration), strict redirect URIs.
- Use the `fragment` response mode as per [OAuth 2.0 Multiple Response Type
  Encoding Practices](https://openid.net/specs/oauth-v2-multiple-response-types-1_0.html)
  for clients with an HTTPS redirect URI.

###### User registration

Clients can signal to the server that the user desires to register a new account
by initiating the authorization code grant with the `prompt=create` parameter
set in the authorization request as defined in [Initiating User Registration via
OpenID Connect 1.0](https://openid.net/specs/openid-connect-prompt-create-1_0.html).

Whether the homeserver supports this parameter is advertised by the
`prompt_values_supported` authorization server metadata.

Servers that support this parameter SHOULD show the account registration UI in
the browser.

##### Refresh token grant

As per [RFC 6749 section 6](https://datatracker.ietf.org/doc/html/rfc6749#section-6),
the refresh token grant lets the client exchange a refresh token for an access
token.

When authorization is granted to a client, the homeserver MUST issue a refresh
token to the client in addition to the access token.

The access token MUST be short-lived and SHOULD be refreshed using the
`refresh_token` when expired.

The homeserver SHOULD issue a new refresh token each time an old one is used,
and invalidate the old one. However, it MUST ensure that the client is able to
retry the refresh request in the case that the response to the request is lost.

The homeserver SHOULD consider that the session is compromised if an old,
invalidated refresh token is used, and SHOULD revoke the session.

The client MUST handle access token refresh failures as follows:

 - If the refresh fails due to network issues or a `5xx` HTTP status code from
   the server, the client should retry the request with the old refresh token
   later.
 - If the refresh fails due to a `4xx` HTTP status code from the server, the
   client should consider the session logged out.

#### Token revocation

When a user wants to log out from a client, the client SHOULD use OAuth 2.0
token revocation as defined in [RFC 7009](https://datatracker.ietf.org/doc/html/rfc7009).

The client makes a `POST` request to the `revocation_endpoint` that can be found
in the [authorization server metadata](#server-metadata-discovery).

The body of the request includes the following parameters, encoded as
`application/x-www-form-urlencoded`:

<table>
  <thead>
    <tr>
       <th>Parameter</th>
       <th>Value</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><code>token</code></td>
      <td>
        <strong>Required.</strong> MUST contain either the access token or the
        refresh token to be revoked.
      </td>
    </tr>
    <tr>
      <td><code>token_type_hint</code></td>
      <td>
        <strong>Optional.</strong> If present, MUST have a value of either
        <code>access_token</code> or <code>refresh_token</code>. The server MAY
        use this value to optimize the token lookup process.
      </td>
    </tr>
    <tr>
      <td><code>client_id</code></td>
      <td>
        <p>
          <strong>Optional.</strong> The client identifier obtained during
          <a href="#client-registration">client registration</a>.
        </p>
        <p>
          If the <code>client_id</code> is not provided, or does not match the
          client associated with the token, the server SHOULD still revoke the
          token. This behavior is meant to help good actors like secret scanning
          tools to proactively revoke leaked tokens. The server MAY also warn
          the user that one of their sessions may be compromised in this
          scenario.
        </p>
      </td>
    </tr>
  </tbody>
</table>

For example, revoking using the access token:

```nohighlight
POST /oauth2/revoke HTTP/1.1
Host: auth.example.com
Content-Type: application/x-www-form-urlencoded

token=mat_ooreiPhei2wequu9fohkai3AeBaec9oo&
token_type_hint=access_token&
client_id=s6BhdRkqt3
```

The server MUST revoke both the access token and refresh token associated with
the token provided in the request.

The server SHOULD return one of the following responses:

- If the token is already revoked or invalid, the server returns a `200 OK`
  response
- If the client is not authorized to revoke the token, the server returns a
  `401 Unauthorized` response
- For other errors, the server returns a `400 Bad Request` response with error
  details

#### Account management {id="oauth-20-account-management"}

{{% added-in v="1.18" %}}

All account management is done via the homeserver's web UI.

This specification defines extensions to the [OAuth Authorization Server
Metadata registry](https://www.iana.org/assignments/oauth-parameters/oauth-parameters.xhtml#authorization-server-metadata)
to offer clients a way to deep-link to the account management capabilities of
the homeserver to allow the user to complete the account management operations
in a browser.

##### Account management URL discovery

The [OAuth 2.0 authorization server metadata](#server-metadata-discovery) is
extended to include the following **optional** fields.

{{% definition path="schemas/oauth2-account-management-server-metadata" %}}

##### Account management URL parameters

The account management URL MAY accept the following minimum query parameters.

{{% definition path="schemas/oauth2-account-management-url" %}}

##### Account management URL actions

Account management actions are unique to the application. They SHOULD follow the
[Common Namespaced Identifier Grammar](/appendices/#common-namespaced-identifier-grammar)
where feasible. The Matrix-specific actions are:

| Action                           | Description                                                                                                                                          |
|----------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------|
| `org.matrix.profile`             | The user wishes to view/edit their profile (name, avatar, contact details).                                                                          |
| `org.matrix.devices_list`        | The user wishes to view a list of their devices.                                                                                                     |
| `org.matrix.device_view`         | The user wishes to view the details of a specific device. A `device_id` SHOULD be provided.                                                          |
| `org.matrix.device_delete`       | The user wishes to delete/log out a specific device. A `device_id` SHOULD be provided.                                                               |
| `org.matrix.account_deactivate`  | The user wishes to deactivate their account.                                                                                                         |
| `org.matrix.cross_signing_reset` | The user wishes to reset their cross-signing identity. Servers SHOULD use this action in the URL of the [`m.oauth`](#oauth-authentication) UIA type. |

### Account moderation

#### Account locking

{{% added-in v="1.12" %}}

Server administrators may apply locks to prevent users from usefully
using their accounts, for instance, due to safety or security concerns.
In contrast to account deactivation, locking is a non-destructive action
that can be reversed.

{{% added-in v="1.18" %}} To lock or unlock an account, administrators
SHOULD use the [`PUT /admin/lock/{userId}`](#put_matrixclientv1adminlockuserid)
endpoint. They MAY also use [`GET /admin/lock/{userId}`](#get_matrixclientv1adminlockuserid)
to check whether a user's account is locked.

When an account is locked, servers MUST return a `401 Unauthorized` error
response with an `M_USER_LOCKED` error code and [`soft_logout`](#soft-logout)
set to `true` on all but the following Client-Server APIs:

- [`POST /logout`](#post_matrixclientv3logout)
- [`POST /logout/all`](#post_matrixclientv3logoutall)

Servers MAY additionally include details of why the lock was applied in
the `error` field.

```nohighlight
HTTP/1.1 401 Unauthorized
Content-Type: application/json
```

```json
{
  "errcode": "M_USER_LOCKED",
  "error": "This account has been locked",
  "soft_logout": true
}
```

Servers SHOULD NOT invalidate access tokens on locked accounts unless the
client requests a logout (using the above endpoints). This ensures that
users can retain their sessions without having to log back in if the account
becomes unlocked.

Upon receiving an `M_USER_LOCKED` error, clients SHOULD retain session
information including encryption state and inform the user that their account
has been locked. While the lock is applied, clients SHOULD hide the normal UI
from the user, preventing general use of their account. Clients SHOULD, however,
continue to make rate-limited requests to [`/sync`](#get_matrixclientv3sync)
and other APIs to detect when the lock has been lifted.

To enable users to appeal to a lock clients MAY use
[server contact discovery](#getwell-knownmatrixsupport).

#### Account suspension

{{% added-in v="1.13" %}}

Server administrators MAY suspend a user's account to prevent further activity
from that account. The effect is similar to [locking](#account-locking), though
without risk of the client losing state from a logout. Suspensions are reversible,
like locks and unlike deactivations.

{{% added-in v="1.18" %}} To suspend or unsuspend an account, administrators
SHOULD use the [`PUT /admin/suspend/{userId}`](#put_matrixclientv1adminsuspenduserid)
endpoint. They MAY also use [`GET /admin/suspend/{userId}`](#get_matrixclientv1adminsuspenduserid)
to check whether a user's account is suspended.

The actions a user can perform while suspended is deliberately left as an
implementation detail. Servers SHOULD permit the user to perform at least the
following, however:

* Log in and create additional sessions (which are also suspended).
* See and receive messages, particularly through [`/sync`](#get_matrixclientv3sync)
  and [`/messages`](#get_matrixclientv3roomsroomidmessages).
* [Verify other devices](#device-verification) and write associated
  [cross-signing data](#cross-signing).
* [Populate their key backup](#server-side-key-backups).
* [Leave rooms and reject invites](#post_matrixclientv3roomsroomidleave).
* [Redact](#redactions) their own events.
* [Log out](#post_matrixclientv3logout) or [delete](#delete_matrixclientv3devicesdeviceid)
  any device of theirs, including the current session.
* [Deactivate](#post_matrixclientv3accountdeactivate) their account, potentially
  with a time delay to discourage making a new account right away.
* Change or add [admin contacts](#adding-account-administrative-contact-information),
  but not remove. Servers are recommended to only permit this if they keep a
  changelog on contact information to prevent misuse.

General purpose endpoints like [`/send/{eventType}`](#put_matrixclientv3roomsroomidsendeventtypetxnid)
MAY return the error described below depending on the path parameters. For example,
a user may be allowed to send `m.room.redaction` events but not `m.room.message`
events through `/send`.

Where a room is used to maintain communication between server administration
teams and the suspended user, servers are recommended to allow the user to send
events to that room specifically. Server administrators which do not want the
user to continue receiving messages may be interested in [account locking](#account-locking)
instead.

Otherwise, the recommended set of explicitly forbidden actions is:

* [Joining](#joining-rooms) or [knocking](#knocking-on-rooms) on rooms.
* Accepting or sending [invites](#room-membership).
* [Sending messages](#put_matrixclientv3roomsroomidsendeventtypetxnid) to rooms.
* Changing [profile data](#profiles) (display name and avatar, primarily).
* [Redacting](#redactions) other users' events, when permission is possible in a room.

When a client attempts to perform an action while suspended, the server MUST
respond with a `403 Forbidden` error response with `M_USER_SUSPENDED` as the
error code, as shown below:

```nohighlight
HTTP/1.1 403 Forbidden
Content-Type: application/json
```

```json
{
  "errcode": "M_USER_SUSPENDED",
  "error": "You cannot perform this action while suspended."
}
```

### Adding Account Administrative Contact Information

A homeserver may keep some contact information for administrative use.
This is independent of any information kept by any identity servers,
though can be proxied (bound) to the identity server in many cases.

{{% boxes/note %}}
This section deals with two terms: "add" and "bind". Where "add" (or
"remove") is used, it is speaking about an identifier that was not bound
to an identity server. As a result, "bind" (or "unbind") references an
identifier that is found in an identity server. Note that an identifier
can be added and bound at the same time, depending on context.
{{% /boxes/note %}}

{{% http-api spec="client-server" api="administrative_contact" %}}

### Current account information

{{% http-api spec="client-server" api="whoami" %}}

#### Notes on identity servers

Identity servers in Matrix store bindings (relationships) between a
user's third-party identifier, typically email or phone number, and
their user ID. Once a user has chosen an identity server, that identity
server should be used by all clients.

Clients can see which identity server the user has chosen through the
`m.identity_server` account data event, as described below. Clients
SHOULD refrain from making requests to any identity server until the
presence of `m.identity_server` is confirmed as (not) present. If
present, the client SHOULD check for the presence of the `base_url`
property in the event's content. If the `base_url` is present, the
client SHOULD use the identity server in that property as the identity
server for the user. If the `base_url` is missing, or the account data
event is not present, the client SHOULD use whichever default value it
normally would for an identity server, if applicable. Clients SHOULD NOT
update the account data with the default identity server when the user
is missing an identity server in their account data.

Clients SHOULD listen for changes to the `m.identity_server` account
data event and update the identity server they are contacting as a
result.

If the client offers a way to set the identity server to use, it MUST
update the value of `m.identity_server` accordingly. A `base_url` of
`null` MUST be treated as though the user does not want to use an
identity server, disabling all related functionality as a result.

Clients SHOULD refrain from populating the account data as a migration
step for users who are lacking the account data, unless the user sets
the identity server within the client to a value. For example, a user
which has no `m.identity_server` account data event should not end up
with the client's default identity server in their account data, unless
the user first visits their account settings to set the identity server.

{{% event event="m.identity_server" %}}

## Capabilities negotiation

A homeserver may not support certain operations and clients must be able
to query for what the homeserver can and can't offer. For example, a
homeserver may not support users changing their password as it is
configured to perform authentication against an external system.

The capabilities advertised through this system are intended to
advertise functionality which is optional in the API, or which depend in
some way on the state of the user or server. This system should not be
used to advertise unstable or experimental features - this is better
done by the [`/versions`](#get_matrixclientversions) endpoint.

Some examples of what a reasonable capability could be are:

-   Whether the server supports user presence.
-   Whether the server supports optional features, such as the user or
    room directories.
-   The rate limits or file type restrictions imposed on clients by the
    server.

Some examples of what should **not** be a capability are:

-   Whether the server supports a feature in the `unstable`
    specification.
-   Media size limits - these are handled by the
    [`/config`](#get_matrixmediav3config) API.
-   Optional encodings or alternative transports for communicating with
    the server.

Capabilities prefixed with `m.` are reserved for definition in the
Matrix specification while other values may be used by servers using the
Java package naming convention. The capabilities supported by the Matrix
specification are defined later in this section.

{{% http-api spec="client-server" api="capabilities" %}}

### `m.change_password` capability

This capability has a single flag, `enabled`, which indicates whether or
not the user can use the [`/account/password`](#post_matrixclientv3accountpassword) API to change their
password. If not present, the client should assume that password changes
are possible via the API. When present, clients SHOULD respect the
capability's `enabled` flag and indicate to the user if they are unable
to change their password.

An example of the capability API's response for this capability is:

```json
{
  "capabilities": {
    "m.change_password": {
      "enabled": false
    }
  }
}
```

### `m.forget_forced_upon_leave` capability

{{% added-in v="1.18" %}}

This capability has a single flag, `enabled`, which indicates whether or
not the server automatically forgets rooms which the user has left.

When `enabled` is `true` and the user leaves a room, the server will automatically
forget the room — just as if the user had called [`/forget`](#post_matrixclientv3roomsroomidforget)
themselves. This behavior applies irrespective of whether the user has left the
room on their own (through [`/leave`](#post_matrixclientv3roomsroomidleave)) or
has been kicked or banned from the room by another user.

When `enabled` is `false`, the server does not automatically forget rooms
upon leave. In this case, clients MAY distinguish the actions of leaving
and forgetting a room in their UI. Similarly, clients MAY retrieve and
visualize left but unforgotten rooms using a [filter](#filtering) with
`include_leave = true`.

When the capability or the `enabled` property are not present, clients SHOULD
assume that the server does not automatically forget rooms.

An example of the capability API's response for this capability is:

```json
{
  "capabilities": {
    "m.forget_forced_upon_leave": {
      "enabled": true
    }
  }
}
```

### `m.room_versions` capability

This capability describes the default and available room versions a
server supports, and at what level of stability. Clients should make use
of this capability to determine if users need to be encouraged to
upgrade their rooms.

An example of the capability API's response for this capability is:

```json
{
  "capabilities": {
    "m.room_versions": {
      "default": "1",
      "available": {
        "1": "stable",
        "2": "stable",
        "3": "unstable",
        "custom-version": "unstable"
      }
    }
  }
}
```

This capability mirrors the same restrictions of [room
versions](/rooms) to describe which versions are
stable and unstable. Clients should assume that the `default` version is
`stable`. Any version not explicitly labelled as `stable` in the
`available` versions is to be treated as `unstable`. For example, a
version listed as `future-stable` should be treated as `unstable`.

The `default` version is the version the server is using to create new
rooms. Clients should encourage users with sufficient permissions in a
room to upgrade their room to the `default` version when the room is
using an `unstable` version.

When this capability is not listed, clients should use `"1"` as the
default and only stable `available` room version.

### `m.profile_fields` capability

{{% added-in v="1.16" %}}

This capability defines which [profile](#profiles) fields the user is
able to change.

The capability value has a required flag, `enabled`, and two optional lists, `allowed` and
`disallowed`.

When `enabled` is `false`, all profile fields are managed by the server
and the client is not permitted to make any changes.

When `enabled` is `true`, clients are permitted to modify profile fields,
subject to the restrictions implied by the OPTIONAL lists `allowed` and
`disallowed`.

If `allowed` is present, clients can modify only the fields
listed. They SHOULD assume all other fields to be managed by
the server. In this case, `disallowed` has no meaning and should be ignored.

If `disallowed` is present (and `allowed` is not), clients SHOULD assume
that the listed fields are managed by the server. Clients may modify any
fields that are *not* listed, provided `enabled` is `true`.

If neither `allowed` nor `disallowed` is present, clients can modify all fields
without restrictions, provided `enabled` is `true`.

When this capability is not listed, clients SHOULD assume the user is able to change
profile fields without any restrictions, provided the homeserver
advertises a specification version that includes the `m.profile_fields`
capability in the [`/versions`](/client-server-api/#get_matrixclientversions)
response.

An example of the capability API's response for this capability is:

```json
{
  "capabilities": {
    "m.profile_fields": {
      "enabled": true,
      "disallowed": ["displayname"]
    }
  }
}
```

### `m.set_displayname` capability

{{% boxes/note %}}
{{% changed-in v="1.16" %}}
This capability is now deprecated. Clients SHOULD use the
[`m.profile_fields`](/client-server-api/#mprofile_fields-capability)
capability instead.

For backwards compatibility, servers that forbid setting the
`displayname` profile field in the `m.profile_fields` capability
MUST still present this capability with `"enabled": false`.
{{% /boxes/note %}}

This capability has a single flag, `enabled`, to denote whether the user
is able to change their own display name via profile endpoints. Cases for
disabling might include users mapped from external identity/directory
services, such as LDAP.

Note that this is well paired with the `m.set_avatar_url` capability.

When not listed, clients should assume the user is able to change their
display name.

An example of the capability API's response for this capability is:

```json
{
  "capabilities": {
    "m.set_displayname": {
      "enabled": false
    }
  }
}
```

### `m.set_avatar_url` capability

{{% boxes/note %}}
{{% changed-in v="1.16" %}}
This capability is now deprecated. Clients SHOULD use the
[`m.profile_fields`](/client-server-api/#mprofile_fields-capability)
capability instead.

For backwards compatibility, servers that forbid setting the
`avatar_url` profile field in the `m.profile_fields` capability
MUST still present this capability with `"enabled": false`.
{{% /boxes/note %}}

This capability has a single flag, `enabled`, to denote whether the user
is able to change their own avatar via profile endpoints. Cases for
disabling might include users mapped from external identity/directory
services, such as LDAP.

Note that this is well paired with the `m.set_displayname` capability.

When not listed, clients should assume the user is able to change their
avatar.

An example of the capability API's response for this capability is:

```json
{
  "capabilities": {
    "m.set_avatar_url": {
      "enabled": false
    }
  }
}
```

### `m.3pid_changes` capability

This capability has a single flag, `enabled`, to denote whether the user
is able to add, remove, or change 3PID associations on their account. Note
that this only affects a user's ability to use the
[Admin Contact Information](#adding-account-administrative-contact-information)
API, not endpoints exposed by an Identity Service. Cases for disabling
might include users mapped from external identity/directory  services,
such as LDAP.

When not listed, clients should assume the user is able to modify their 3PID
associations.

An example of the capability API's response for this capability is:

```json
{
  "capabilities": {
    "m.3pid_changes": {
      "enabled": false
    }
  }
}
```

### `m.get_login_token` capability

This capability has a single flag, `enabled`, to denote whether the user
is able to use [`POST /login/get_token`](/client-server-api/#post_matrixclientv1loginget_token)
to generate single-use, time-limited tokens to log unauthenticated clients
into their account.

When not listed, clients SHOULD assume the user is unable to generate tokens.

An example of the capability API's response for this capability is:

```json
{
  "capabilities": {
    "m.get_login_token": {
      "enabled": false
    }
  }
}
```

## Filtering

Filters can be created on the server and can be passed as a parameter to
APIs which return events. These filters alter the data returned from
those APIs. Not all APIs accept filters.

### Lazy-loading room members

Membership events often take significant resources for clients to track.
In an effort to reduce the number of resources used, clients can enable
"lazy-loading" for room members. By doing this, servers will attempt to
only send membership events which are relevant to the client.

It is important to understand that lazy-loading is not intended to be a
perfect optimisation, and that it may not be practical for the server to
calculate precisely which membership events are relevant to the client.
As a result, it is valid for the server to send redundant membership
events to the client to ease implementation, although such redundancy
should be minimised where possible to conserve bandwidth.

In terms of filters, lazy-loading is enabled by enabling
`lazy_load_members` on a
[`RoomEventFilter`](#post_matrixclientv3useruseridfilter_request_roomeventfilter).
When enabled, lazy-loading aware endpoints (see
below) will only include membership events for the `sender` of events
being included in the response. For example, if a client makes a `/sync`
request with lazy-loading enabled, the server will only return
membership events for the `sender` of events in the timeline, not all
members of a room.

When processing a sequence of events (e.g. by looping on
[`/sync`](#get_matrixclientv3sync) or paginating
[`/messages`](#get_matrixclientv3roomsroomidmessages)), it is common for blocks
of events in the sequence to share a similar set of senders. Rather than
responses in the sequence sending duplicate membership events for these senders
to the client, the server MAY assume that clients will remember membership
events they have already been sent, and choose to skip sending membership
events for members whose membership has not changed. These are called
'redundant membership events'. Clients may request that redundant membership
events are always included in responses by setting `include_redundant_members`
to true in the filter.

The expected pattern for using lazy-loading is currently:

-   Client performs an initial /sync with lazy-loading enabled, and
    receives only the membership events which relate to the senders of
    the events it receives.
-   Clients which support display-name tab-completion or other
    operations which require rapid access to all members in a room
    should call /members for the currently selected room, with an `?at`
    parameter set to the /sync response's from token. The member list
    for the room is then maintained by the state in subsequent
    incremental /sync responses.
-   Clients which do not support tab-completion may instead pull in
    profiles for arbitrary users (e.g. read receipts, typing
    notifications) on demand by querying the room state or [`/profile`](#get_matrixclientv3profileuserid).

The current endpoints which support lazy-loading room members are:

-   [`/sync`](/client-server-api/#get_matrixclientv3sync)
-   [`/rooms/<room_id>/messages`](/client-server-api/#get_matrixclientv3roomsroomidmessages)
-   [`/rooms/{roomId}/context/{eventId}`](/client-server-api/#get_matrixclientv3roomsroomidcontexteventid)

### API endpoints

{{% http-api spec="client-server" api="filter" %}}

## Events

The model of conversation history exposed by the client-server API can
be considered as a list of events. The server 'linearises' the
eventually-consistent event graph of events into an 'event stream' at
any given point in time:

    [E0]->[E1]->[E2]->[E3]->[E4]->[E5]

### Types of room events

Room events are split into two categories:

* **State events**: These are events which update the metadata state of the room (e.g. room
topic, room membership etc). State is keyed by a tuple of event `type`
and a `state_key`. State in the room with the same key-tuple will be
overwritten.

* **Message events**: These are events which describe transient "once-off" activity in a room:
typically communication such as sending an instant message or setting up
a VoIP call.

This specification outlines several events, all with the event type
prefix `m.`. (See [Room Events](#room-events) for the m. event
specification.) However, applications may wish to add their own type of
event, and this can be achieved using the REST API detailed in the
following sections. If new events are added, the event `type` key SHOULD
follow the Java package naming convention, e.g.
`com.example.myapp.event`. This ensures event types are suitably
namespaced for each application and reduces the risk of clashes.

{{% boxes/note %}}
Events are not limited to the types defined in this specification. New
or custom event types can be created on a whim using the Java package
naming convention. For example, a `com.example.game.score` event can be
sent by clients and other clients would receive it through Matrix,
assuming the client has access to the `com.example` namespace.
{{% /boxes/note %}}

### Room event format

The "federation" format of a room event, which is used internally by homeservers
and between homeservers via the Server-Server API, depends on the ["room
version"](/rooms) in use by the room. See, for example, the definitions
in [room version 1](/rooms/v1#event-format) and [room version
3](/rooms/v3#event-format).

However, it is unusual that a Matrix client would encounter this event
format. Instead, homeservers are responsible for converting events into the
format shown below so that they can be easily parsed by clients.

{{% boxes/warning %}}
Event bodies are considered untrusted data. This means that any application using
Matrix must validate that the event body is of the expected shape/schema
before using the contents verbatim.

**It is not safe to assume that an event body will have all the expected
fields of the expected types.**

See [MSC2801](https://github.com/matrix-org/matrix-spec-proposals/pull/2801) for more
detail on why this assumption is unsafe.
{{% /boxes/warning %}}

{{% definition path="api/client-server/definitions/client_event" %}}

### Stripped state

Stripped state is a simplified view of the state of a room intended to help a
potential joiner identify the room. It consists of a limited set of state events
that are themselves simplified to reduce the amount of data required.

Stripped state events can only have the `sender`, `type`, `state_key` and
`content` properties present.

Stripped state typically appears in invites, knocks, and in other places where a
user *could* join the room under the conditions available (such as a
[`restricted` room](#restricted-rooms)).

Clients should only use stripped state events when they don't have
access to the proper state of the room. Once the state of the room is
available, all stripped state should be discarded. In cases where the
client has an archived state of the room (such as after being kicked)
and the client is receiving stripped state for the room, such as from an
invite or knock, then the stripped state should take precedence until
fresh state can be acquired from a join.

Stripped state should contain some or all of the following state events, which
should be represented as stripped state events when possible:

* [`m.room.create`](#mroomcreate)
* [`m.room.name`](#mroomname)
* [`m.room.avatar`](#mroomavatar)
* [`m.room.topic`](#mroomtopic)
* [`m.room.join_rules`](#mroomjoin_rules)
* [`m.room.canonical_alias`](#mroomcanonical_alias)
* [`m.room.encryption`](#mroomencryption)

{{% changed-in v="1.16" %}} The `m.room.create` event is now **required** in
the following places:
* [`invite_state`](#get_matrixclientv3sync_response-200_invited-room) and
  [`knock_state`](#get_matrixclientv3sync_response-200_knocked-room) on
  [`/sync`](#get_matrixclientv3sync) responses.
* On [`m.room.member`](#mroommember) events, the `invite_room_state`
  and `knock_room_state` under `unsigned` on the event.

{{% boxes/note %}}
Clients should inspect the list of stripped state events and not assume any
particular event is present. The server might include events not described
here as well.
{{% /boxes/note %}}

{{% boxes/rationale %}}
The name, avatar, topic, and aliases are presented as aesthetic information
about the room, allowing users to make decisions about whether or not they
want to join the room.

The join rules are given to help the client determine *why* it is able to
potentially join. For example, annotating the room decoration with iconography
consistent with the respective join rule for the room.

The create event can help identify what kind of room is being joined, as it
may be a Space or other kind of room. The client might choose to render the
invite in a different area of the application as a result.

Similar to join rules, the encryption information is given to help clients
decorate the room with appropriate iconography or messaging.
{{% /boxes/rationale %}}

{{% boxes/warning %}}
Although stripped state is usually generated and provided by the server, it
is still possible to be incorrect on the receiving end. The stripped state
events are not signed and could theoretically be modified, or outdated due to
updates not being sent.
{{% /boxes/warning %}}

{{% boxes/warning %}}
{{% added-in v="1.16" %}} Servers cannot pass through what they receive over
federation to clients as stripped state. Servers are expected to prune the events
into the stripped state schema below before passing the details onto clients.
{{% /boxes/warning %}}

{{% event-fields event_type="stripped_state" %}}

### Size limits

The complete event MUST NOT be larger than 65536 bytes, when formatted
with the [federation event format](#room-event-format), including any
signatures, and encoded as [Canonical JSON](/appendices#canonical-json).

There are additional restrictions on sizes per key:

-   `sender` MUST NOT exceed the size limit for [user IDs](/appendices/#user-identifiers).
-   `room_id` MUST NOT exceed the size limit for [room IDs](/appendices/#room-ids).
-   `state_key` MUST NOT exceed 255 bytes.
-   `type` MUST NOT exceed 255 bytes.
-   `event_id` MUST NOT exceed the size limit for [event IDs](/appendices/#event-ids).

Some event types have additional size restrictions which are specified
in the description of the event. Additional keys have no limit other
than that implied by the total 64 KiB limit on events.

### Room Events

{{% boxes/note %}}
This section is a work in progress.
{{% /boxes/note %}}

This specification outlines several standard event types, all of which
are prefixed with `m.`

{{% event event="m.room.canonical_alias" %}}

{{% event event="m.room.create" %}}

{{% event event="m.room.join_rules" %}}

{{% event event="m.room.member" %}}

{{% event event="m.room.power_levels" %}}

#### Historical events

Some events within the `m.` namespace might appear in rooms, however
they serve no significant meaning in this version of the specification.
They are:

-   `m.room.aliases`

Previous versions of the specification have more information on these
events.

### Syncing

To read events, the intended flow of operation is for clients to first
call the [`/sync`](/client-server-api/#get_matrixclientv3sync) API without a `since` parameter. This returns the
most recent message events for each room, as well as the state of the
room at the start of the returned timeline. The response also includes a
`next_batch` field, which should be used as the value of the `since`
parameter in the next call to `/sync`. Finally, the response includes,
for each room, a `prev_batch` field, which can be passed as a `from`/`to`
parameter to the [`/rooms/<room_id>/messages`](/client-server-api/#get_matrixclientv3roomsroomidmessages) API to retrieve earlier
messages.

For example, a `/sync` request might return a range of four events
`E2`, `E3`, `E4` and `E5` within a given room, omitting two prior events
`E0` and `E1`. This can be visualised as follows:

```nohighlight
    [E0]->[E1]->[E2]->[E3]->[E4]->[E5]
               ^                      ^
               |                      |
         prev_batch: '1-2-3'        next_batch: 'a-b-c'
```

Clients then receive new events by "long-polling" the homeserver via the
`/sync` API, passing the value of the `next_batch` field from the
response to the previous call as the `since` parameter. The client
should also pass a `timeout` parameter. The server will then hold open
the HTTP connection for a short period of time waiting for new events,
returning early if an event occurs. Only the `/sync` API (and the
deprecated `/events` API) support long-polling in this way.

Continuing the example above, an incremental sync might report
a single new event `E6`. The response can be visualised as:

```nohighlight
    [E0]->[E1]->[E2]->[E3]->[E4]->[E5]->[E6]
                                      ^     ^
                                      |     |
                                      |  next_batch: 'x-y-z'
                                    prev_batch: 'a-b-c'
```

Normally, all new events which are visible to the client will appear in
the response to the `/sync` API. However, if a large number of events
arrive between calls to `/sync`, a "limited" timeline is returned,
containing only the most recent message events. A state "delta" is also
returned, summarising any state changes in the omitted part of the
timeline. The client may therefore end up with "gaps" in its knowledge
of the message timeline. The client can fill these gaps using the
[`/rooms/<room_id>/messages`](/client-server-api/#get_matrixclientv3roomsroomidmessages) API.

Continuing our example, suppose we make a third `/sync` request asking for
events since the last sync, by passing the `next_batch` token `x-y-z` as
the `since` parameter. The server knows about four new events, `E7`, `E8`,
`E9` and `E10`, but decides this is too many to report at once. Instead,
the server sends a `limited` response containing `E8`, `E9` and `E10`but
omitting `E7`. This forms a gap, which we can see in the visualisation:

```nohighlight
                                            | gap |
                                            | <-> |
    [E0]->[E1]->[E2]->[E3]->[E4]->[E5]->[E6]->[E7]->[E8]->[E9]->[E10]
                                            ^     ^                  ^
                                            |     |                  |
                                 since: 'x-y-z'   |                  |
                                       prev_batch: 'd-e-f'       next_batch: 'u-v-w'
```

The limited response includes a state delta which describes how the state
of the room changes over the gap. This delta explains how to build the state
prior to returned timeline (i.e. at `E7`) from the state the client knows
(i.e. at `E6`). To close the gap, the client should make a request to
[`/rooms/<room_id>/messages`](/client-server-api/#get_matrixclientv3roomsroomidmessages)
with the query parameters `from=x-y-z` and `to=d-e-f`.

{{% boxes/warning %}}
Events are ordered in this API according to the arrival time of the
event on the homeserver. This can conflict with other APIs which order
events based on their partial ordering in the event graph. This can
result in duplicate events being received (once per distinct API
called). Clients SHOULD de-duplicate events based on the event ID when
this happens.
{{% /boxes/warning %}}

{{% boxes/note %}}
The `/sync` API returns a `state` list which is separate from the
`timeline`. This `state` list allows clients to keep their model of the
room state in sync with that on the server. In the case of an initial
(`since`-less) sync, the `state` list represents the complete state of
the room at the **start** of the returned timeline (so in the case of a
recently-created room whose state fits entirely in the `timeline`, the
`state` list will be empty).

In the case of an incremental sync, the `state` list gives a delta
between the state of the room at the `since` parameter and that at the
start of the returned `timeline`. (It will therefore be empty unless the
timeline was `limited`.)

In both cases, it should be noted that the events returned in the
`state` list did **not** necessarily take place just before the returned
`timeline`, so clients should not display them to the user in the
timeline.
{{% /boxes/note %}}

{{% boxes/rationale %}}
An early design of this specification made the `state` list represent
the room state at the end of the returned timeline, instead of the
start. This was unsatisfactory because it led to duplication of events
between the `state` list and the `timeline`, but more importantly, it
made it difficult for clients to show the timeline correctly.

In particular, consider a returned timeline \[M0, S1, M2\], where M0 and
M2 are both messages sent by the same user, and S1 is a state event
where that user changes their displayname. If the `state` list
represents the room state at the end of the timeline, the client must
take a copy of the state dictionary, and *rewind* S1, in order to
correctly calculate the display name for M0.
{{% /boxes/rationale %}}

{{% http-api spec="client-server" api="sync" %}}

{{% http-api spec="client-server" api="old_sync" %}}

### Getting events for a room

There are several APIs provided to `GET` events for a room:

{{% http-api spec="client-server" api="rooms" %}}

{{% http-api spec="client-server" api="message_pagination" %}}

{{% http-api spec="client-server" api="room_event_by_timestamp" %}}

{{% http-api spec="client-server" api="room_initial_sync" %}}

### Sending events to a room

{{% boxes/note %}}
{{% added-in v="1.3" %}}

Servers might need to post-process some events if they
[relate to](#forming-relationships-between-events) another event. The event's
relationship type (`rel_type`) determines any restrictions which might apply,
such as the user only being able to send one event of a given type in relation
to another.
{{% /boxes/note %}}

{{% http-api spec="client-server" api="room_state" %}}

**Examples**

Valid requests look like:

```nohighlight
PUT /rooms/!roomid:domain/state/m.example.event
{ "key" : "without a state key" }
```
```nohighlight
PUT /rooms/!roomid:domain/state/m.another.example.event/foo
{ "key" : "with 'foo' as the state key" }
```

In contrast, these requests are invalid:

```nohighlight
POST /rooms/!roomid:domain/state/m.example.event/
{ "key" : "cannot use POST here" }
```
```nohighlight
PUT /rooms/!roomid:domain/state/m.another.example.event/foo/11
{ "key" : "txnIds are not supported" }
```

Care should be taken to avoid setting the wrong `state key`:

```nohighlight
PUT /rooms/!roomid:domain/state/m.another.example.event/11
{ "key" : "with '11' as the state key, but was probably intended to be a txnId" }
```

The `state_key` is often used to store state about individual users, by
using the user ID as the `state_key` value. For example:

```nohighlight
PUT /rooms/!roomid:domain/state/m.favorite.animal.event/%40my_user%3Aexample.org
{ "animal" : "cat", "reason": "fluffy" }
```

In some cases, there may be no need for a `state_key`, so it can be
omitted:

```nohighlight
PUT /rooms/!roomid:domain/state/m.room.bgd.color
{ "color": "red", "hex": "#ff0000" }
```

{{% http-api spec="client-server" api="room_send" %}}

### Redactions

Since events are extensible it is possible for malicious users and/or
servers to add keys that are, for example offensive or illegal. Since
some events cannot be simply deleted, e.g. membership events, we instead
'redact' events. This involves removing all keys from an event that are
not required by the protocol. This stripped down event is thereafter
returned anytime a client or remote server requests it. Redacting an
event cannot be undone, allowing server owners to delete the offending
content from the databases. Servers should include a copy of the
`m.room.redaction` event under `unsigned` as `redacted_because`
when serving the redacted event to clients.

The exact algorithm to apply against an event is defined in the [room
version specification](/rooms), as are the criteria homeservers should
use when deciding whether to accept a redaction event from a remote
homeserver.

When a client receives an `m.room.redaction` event, it SHOULD change
the affected event in the same way a server does.

{{% boxes/note %}}
Redacted events can still affect the state of the room. When redacted,
state events behave as though their properties were simply not
specified, except those protected by the redaction algorithm. For
example, a redacted `join` event will still result in the user being
considered joined. Similarly, a redacted topic does not necessarily
cause the topic to revert to what it was prior to the event - it causes
the topic to be removed from the room.
{{% /boxes/note %}}

#### Events

{{% event event="m.room.redaction" %}}

#### Client behaviour

{{% changed-in v="1.18" %}}

If the server advertises support for a spec version that supports it, clients
MAY use the [`PUT /rooms/{roomId}/send/{eventType}/{txnId}`](#put_matrixclientv3roomsroomidsendeventtypetxnid)
endpoint to send `m.room.redaction` events in all room versions.

They can also use the following endpoint.

{{% http-api spec="client-server" api="redaction" %}}

### Forming relationships between events

{{% changed-in v="1.3" %}}

In some cases it is desirable to logically associate one event's contents with
another event's contents — for example, when replying to a message, editing an
event, or simply looking to add context for an event's purpose.

Events are related to each other in a parent/child structure, where any event can
become a parent by simply having a child event point at it. Parent events do not
define their children, instead relying on the children to describe their parent.

The relationship between a child and its parent event is described in the child
event's `content` as `m.relates_to` (defined below). A child event can point at
any other event, including another child event, to build the relationship so long
as both events are in the same room, however additional restrictions might be imposed
by the type of the relationship (the `rel_type`).

{{% boxes/note %}}
Child events can point at other child events, forming a chain of events. These chains
can naturally take the shape of a tree if two independent children point at a single
parent event, for example.
{{% /boxes/note %}}

To allow the server to aggregate and find child events for a parent, the `m.relates_to`
key of an event MUST be included in the cleartext portion of the event. It cannot be
exclusively recorded in the encrypted payload as the server cannot decrypt the event
for processing.

{{% boxes/warning %}}
If an encrypted event contains an `m.relates_to` in its payload, it should be
ignored and instead favour the cleartext `m.relates_to` copy (including when there
is no cleartext copy). This is to ensure the client's behaviour matches the server's
capability to handle relationships.
{{% /boxes/warning %}}

Relationships which don't match the schema, or which break the rules of a relationship,
are simply ignored. An example might be the parent and child being in different
rooms, or the relationship missing properties required by the schema below. Clients
handling such invalid relationships should show the events independently of each
other, optionally with an error message.

`m.relates_to` is defined as follows:

{{% definition path="api/client-server/definitions/m.relates_to" %}}

#### Relationship types

This specification describes the following relationship types:

* [Rich replies](#rich-replies) (**Note**: does not use `rel_type`).
* [Event replacements](#event-replacements).
* [Event annotations](#event-annotations-and-reactions).
* [Threads](#threading).
* [References](#reference-relations)

#### Aggregations of child events

{{% added-in v="1.3" %}}

Some child events can be "aggregated" by the server, depending on their
`rel_type`. This can allow a set of child events to be summarised to the client without
the client needing the child events themselves.

An example of this might be that a `rel_type` requires an extra `key` field which, when
appropriately specified, would mean that the client receives a total count for the number
of times that `key` was used by child events.

The actual aggregation format depends on the `rel_type`.

When an event is served to the client through the APIs listed below, a
`m.relations` property is included under `unsigned` if the event has child
events which can be aggregated and point at it. The `m.relations` property is
an object keyed by `rel_type` and value being the type-specific aggregated
format for that `rel_type`. This `m.relations` property is known as a "bundled
aggregation".

For example (unimportant fields not included):

```json
{
  "event_id": "$my_event",
  "unsigned": {
    "m.relations": {
      "org.example.possible_annotations": [
        {
          "key": "👍",
          "origin_server_ts": 1562763768320,
          "count": 3
        },
        {
          "key": "👎",
          "origin_server_ts": 1562763768320,
          "count": 1
        }
      ],
      "org.example.possible_thread": {
        "current_server_participated": true,
        "count": 7,
        "latest_event": {
          "event_id": "$another_event",
          "content": {
            "body": "Hello world"
          }
        }
      }
    }
  }
}
```

Note how the `org.example.possible_annotations` aggregation is an array, while in the
`org.example.possible_thread` aggregation where the server is summarising the state of
the relationship in a single object. Both are valid ways to aggregate: the format of an
aggregation depends on the `rel_type`.

{{% boxes/warning %}}
State events do not currently receive bundled aggregations. This is not
necessarily a deliberate design decision, and MSCs which aim to fix this are welcome.
{{% /boxes/warning %}}

The endpoints where the server *should* include bundled aggregations are:

* [`GET /rooms/{roomId}/messages`](#get_matrixclientv3roomsroomidmessages)
* [`GET /rooms/{roomId}/context/{eventId}`](#get_matrixclientv3roomsroomidcontexteventid)
* [`GET /rooms/{roomId}/event/{eventId}`](#get_matrixclientv3roomsroomideventeventid)
* [`GET /rooms/{roomId}/relations/{eventId}`](#get_matrixclientv1roomsroomidrelationseventid)
* [`GET /rooms/{roomId}/relations/{eventId}/{relType}`](#get_matrixclientv1roomsroomidrelationseventidreltype)
* [`GET /rooms/{roomId}/relations/{eventId}/{relType}/{eventType}`](#get_matrixclientv1roomsroomidrelationseventidreltypeeventtype)
* [`GET /sync`](#get_matrixclientv3sync) when the relevant section has a `limited` value
  of `true`.
* [`POST /search`](#post_matrixclientv3search) for any matching events under `room_events`.
* {{% added-in v="1.4" %}} [`GET /rooms/{roomId}/threads`](#get_matrixclientv1roomsroomidthreads)

{{% boxes/note %}}
The server is **not** required to return bundled aggregations on deprecated endpoints
such as [`/initialSync`](#get_matrixclientv3roomsroomidinitialsync).
{{% /boxes/note %}}

While this functionality allows the client to see what was known to the server at the
time of handling, the client should continue to aggregate locally if it is aware of
the relationship type's behaviour. For example, a client might internally increment a `count`
in a parent event's aggregation data if it saw a new child event which referenced that parent.

The aggregation provided by the server only includes child events which were known at the
time the client would receive the aggregation. For example, in a single `/sync` response
with the parent and multiple child events the child events would have already been
included on the parent's `m.relations` field. Events received in future syncs would
need to be aggregated manually by the client.

{{% boxes/note %}}
Events from [ignored users](#ignoring-users) do not appear in the aggregation
from the server, however clients might still have events from ignored users cached. Like
with normal events, clients will need to de-aggregate child events sent by ignored users to
avoid them being considered in counts. Servers must additionally ensure they do not
consider child events from ignored users when preparing an aggregation for the client.
{{% /boxes/note %}}

When a parent event is redacted, the child events which pointed to that parent remain, however
when a child event is redacted then the relationship is broken. Therefore, the server needs
to de-aggregate or disassociate the event once the relationship is lost. Clients with local
aggregation or which handle redactions locally should do the same.

It is suggested that clients perform local echo on aggregations — for instance, aggregating
a new child event into a parent event optimistically until the server returns a failure or the client
gives up on sending the event, at which point the event should be de-aggregated and an
error or similar shown. The client should be cautious to not aggregate an event twice if
it has already optimistically aggregated the event. Clients are encouraged to take this
a step further to additionally track child events which target unsent/pending events,
likely using the transaction ID as a temporary event ID until a proper event ID is known.

{{% boxes/warning %}}
Due to history visibility restrictions, child events might not be visible to the user
if they are in a section of history the user cannot see. This means any aggregations which would
normally include those events will be lacking them and the client will not be able to
locally aggregate the events either — relating events of importance (such as votes) should
take into consideration history visibility.

Additionally, if the server is missing portions of the room history then it may not be
able to accurately aggregate the events.
{{% /boxes/warning %}}

#### Relationships API

{{% added-in v="1.3" %}}

To retrieve the child events for a parent from the server, the client can call the
following endpoint.

This endpoint is particularly useful if the client has lost context on the aggregation for
a parent event and needs to rebuild/verify it.

When using the `recurse` parameter, note that there is no way for a client to
control how far the server recurses. If the client decides that the server's
recursion level is insufficient, it could, for example, perform the recursion
itself, or disable whatever feature requires more recursion.

Filters specified via `event_type` or `rel_type` will be applied to all events
returned, whether direct or indirect relations. Events that would match the filter,
but whose only relation to the original given event is through a non-matching
intermediate event, will not be included. This means that supplying a `rel_type`
parameter of `m.thread` is not appropriate for fetching all events in a thread since
relations to the threaded events would be filtered out. For this purpose, clients should
omit the `rel_type` parameter and perform any necessary filtering on the client side.

{{% boxes/note %}}
Because replies do not use `rel_type`, they will not be accessible via this API.
{{% /boxes/note %}}

{{% http-api spec="client-server" api="relations" %}}

## Rooms

### Types

{{% added-in v="1.2" %}}

Optionally, rooms can have types to denote their intended function. A room
without a type does not necessarily mean it has a specific default function,
though commonly these rooms will be for conversational purposes.

Room types are best applied when a client might need to differentiate between
two different rooms, such as conversation-holding and data-holding. If a room
has a type, it is specified in the `type` key of an [`m.room.create`](#mroomcreate)
event. To specify a room's type, provide it as part of `creation_content` on
the create room request.

In this specification the following room types are specified:

* [`m.space`](#spaces)

Unspecified room types are permitted through the use of
[Namespaced Identifiers](/appendices/#common-namespaced-identifier-grammar).

### Creation

The homeserver will create an `m.room.create` event when a room is
created, which serves as the root of the event graph for this room. The
event `sender` is the user ID of the room creator. The server will also
generate several other events in order to manage permissions in this room.
This includes:

-   `m.room.power_levels` : Sets the power levels of users and required power
    levels for various actions within the room such as sending events.

-   `m.room.join_rules` : Whether the room is "invite-only" or not.

See [Room Events](#room-events) for more information on these events. To
create a room, a client has to use the following API.

{{% http-api spec="client-server" api="create_room" %}}

### Room aliases

Servers may host aliases for rooms with human-friendly names. Aliases
take the form `#friendlyname:server.name`.

As room aliases are scoped to a particular homeserver domain name, it is
likely that a homeserver will reject attempts to maintain aliases on
other domain names. This specification does not provide a way for
homeservers to send update requests to other servers. However,
homeservers MUST handle `GET` requests to resolve aliases on other
servers; they should do this using the federation API if necessary.

Rooms do not store a list of all aliases present on a room, though
members of the room with relevant permissions may publish preferred
aliases through the `m.room.canonical_alias` state event. The aliases in
the state event should point to the room ID they are published within,
however room aliases can and do drift to other room IDs over time.
Clients SHOULD NOT treat the aliases as accurate. They SHOULD be checked
before they are used or shared with another user. If a room appears to
have a room alias of `#alias:example.com`, this SHOULD be checked to
make sure that the room's ID matches the `room_id` returned from the
request.

{{% http-api spec="client-server" api="directory" %}}

### Permissions

{{% changed-in v="1.16" %}} Updated section to discuss creator power level
in room version 12 and beyond.

Permissions for rooms are done via the concept of power levels - to do
any action in a room a user must have a suitable power level. Power
levels are stored as state events in a given room. The power levels
required for operations and the power levels assigned to specific users
are defined in the `m.room.power_levels` state event. The `m.room.power_levels`
state event additionally defines some defaults, though room creators
are special in that:

* In [room versions](/rooms) 1 through 11, room creators by default
  have power level 100 but still can have that level changed by power level
  events, by the same rules as other members.
* In [room version 12](/rooms/v12) (and beyond), room creators are
  *not* specified in the power levels event and have an infinitely high
  power level that is immutable. After room creation, users
  cannot be given this same infinitely high power level.

Users can grant other users increased power levels up to their own
power level (or the maximum allowable integer for the room when their
power level is infinitely high). For example, user A with a power level
of 50 could increase the power level of user B to a maximum of level 50.
Power levels for users are tracked per-room even if the user is not
present in the room. The keys contained in `m.room.power_levels` determine
the levels required for certain operations such as kicking, banning, and
sending state events. See [`m.room.power_levels`](#mroompower_levels) for more
information.

Clients may wish to assign names to particular power levels. Most rooms
will use the default power level hierarchy assigned during room creation,
but rooms may still deviate slightly.

A suggested mapping is as follows:

* 0 to `state_default-1` (typically 49): User
* `state_default` to the level required to send `m.room.power_levels` events
  minus 1 (typically 99): Moderator
* The level required send `m.room.power_levels` events and above: Administrator
* Creators of the room, in room version 12 and beyond: Creator

Clients may also wish to distinguish "above admin" power levels based on the
level required to send `m.room.tombstone` events.

### Room membership

Users need to be a member of a room in order to send and receive events
in that room. There are several states in which a user may be, in
relation to a room:

-   Unrelated (the user cannot send or receive events in the room)
-   Knocking (the user has requested to participate in the room, but has
    not yet been allowed to)
-   Invited (the user has been invited to participate in the room, but
    is not yet participating)
-   Joined (the user can send and receive events in the room)
-   Banned (the user is not allowed to join the room)

There are a few notable exceptions which allow non-joined members of the
room to send events in the room:

- Users wishing to reject an invite would send `m.room.member` events with
  `content.membership` of `leave`. They must have been invited first.

- If the room allows, users can send `m.room.member` events with `content.membership`
  of `knock` to knock on the room. This is a request for an invite by the user.

- To retract a previous knock, a user would send a `leave` event similar to
  rejecting an invite.

Some rooms require that users be invited to it before they can join;
others allow anyone to join. Whether a given room is an "invite-only"
room is determined by the room config key `m.room.join_rules`. It can
have one of the following values:

`public`
This room is free for anyone to join without an invite.

`invite`
This room can only be joined if you were invited.

`knock`
This room can only be joined if you were invited, and allows anyone to
request an invite to the room. Note that this join rule is only available
in room versions [which support knocking](/rooms/#feature-matrix).

{{% added-in v="1.2" %}} `restricted`
This room can be joined if you were invited or if you are a member of another
room listed in the join rules. If the server cannot verify membership for any
of the listed rooms then you can only join with an invite. Note that this rule
is only expected to work in room versions [which support it](/rooms/#feature-matrix).

{{% added-in v="1.3" %}} `knock_restricted`
This room can be joined as though it was `restricted` *or* `knock`. If you
interact with the room using knocking, the `knock` rule takes effect whereas
trying to join the room without an invite applies the `restricted` join rule.
Note that this rule is only expected to work in room versions
[which support it](/rooms/#feature-matrix).

The allowable state transitions of membership are:

{{% diagram name="membership" alt="Diagram presenting the possible membership state transitions" %}}

{{% http-api spec="client-server" api="list_joined_rooms" %}}

#### Joining rooms

{{% http-api spec="client-server" api="inviting" %}}

{{% http-api spec="client-server" api="joining" %}}

##### Knocking on rooms

{{% added-in v="1.1" %}}
{{% changed-in v="1.3" %}}

{{% boxes/note %}}
As of `v1.3`, it is possible to knock on a [restricted room](#restricted-rooms)
if the room supports and is using the `knock_restricted` join rule.

Note that `knock_restricted` is only expected to work in room versions
[which support it](/rooms/#feature-matrix).
{{% /boxes/note %}}

<!--
This section is here because it's most similar to being invited/joining a
room, though has added complexity which needs to be explained. Otherwise
this will have been just the API definition and nothing more (like invites).
-->

If the join rules allow, external users to the room can `/knock` on it to
request permission to join. Users with appropriate permissions within the
room can then approve ([`/invite`](#post_matrixclientv3roomsroomidinvite))
or deny ([`/kick`](#post_matrixclientv3roomsroomidkick), [`/ban`](#post_matrixclientv3roomsroomidban), or otherwise
set membership to `leave`) the knock. Knocks can be retracted by calling
[`/leave`](#post_matrixclientv3roomsroomidleave) or otherwise setting membership to `leave`.

Users who are currently in the room, already invited, or banned cannot
knock on the room.

To accept another user's knock, the user must have permission to invite
users to the room. To reject another user's knock, the user must have
permission to either kick or ban users (whichever is being performed).
Note that setting another user's membership to `leave` is kicking them.

The knocking homeserver should assume that an invite to the room means
that the knock was accepted, even if the invite is not explicitly related
to the knock.

Homeservers are permitted to automatically accept invites as a result of
knocks as they should be aware of the user's intent to join the room. If
the homeserver is not auto-accepting invites (or there was an unrecoverable
problem with accepting it), the invite is expected to be passed down normally
to the client to handle. Clients can expect to see the join event if the
server chose to auto-accept.

{{% http-api spec="client-server" api="knocking" %}}

##### Restricted rooms

{{% added-in v="1.2" %}}
{{% changed-in v="1.3" %}}

{{% boxes/note %}}
As of `v1.3`, it is possible to [knock](#knocking-on-rooms) on a restricted
room if the room supports and is using the `knock_restricted` join rule.

Note that `knock_restricted` is only expected to work in room versions
[which support it](/rooms/#feature-matrix).
{{% /boxes/note %}}

Restricted rooms are rooms with a `join_rule` of `restricted`. These rooms
are accompanied by "allow conditions" as described in the
[`m.room.join_rules`](#mroomjoin_rules) state event.

If the user has an invite to the room then the restrictions will not affect
them. They should be able to join by simply accepting the invite.

When joining without an invite, the server MUST verify that the requesting
user meets at least one of the conditions. If no conditions can be verified
or no conditions are satisfied, the user will not be able to join. When the
join is happening over federation, the remote server will check the conditions
before accepting the join. See the [Server-Server Spec](/server-server-api/#restricted-rooms)
for more information.

The user does not need to maintain the conditions in order to stay a member
of the room: the conditions are only checked/evaluated during the join process.

###### Conditions

Currently there is only one condition available: `m.room_membership`. This
condition requires the user trying to join the room to be a *joined* member
of another room (specifically, the `room_id` accompanying the condition). For
example, if `!restricted:example.org` wanted to allow joined members of
`!other:example.org` to join, `!restricted:example.org` would have the following
`content` for [`m.room.join_rules`](#mroomjoin_rules):

```json
{
  "join_rule": "restricted",
  "allow": [
    {
      "room_id": "!other:example.org",
      "type": "m.room_membership"
    }
  ]
}
```

#### Leaving rooms

A user can leave a room to stop receiving events for that room. A user
must have been invited to or have joined the room before they are
eligible to leave the room. Leaving a room to which the user has been
invited rejects the invite, and can retract a knock. Once a user leaves
a room, it will no longer appear in the response to the
[`/sync`](/client-server-api/#get_matrixclientv3sync) API unless it is
explicitly requested via a filter with the `include_leave` field set
to `true`.

Whether or not they actually joined the room, if the room is an
"invite-only" room the user will need to be re-invited before they can
re-join the room.

A user can also forget a room which they have left. Rooms which have
been forgotten will never appear in the response to the [`/sync`](/client-server-api/#get_matrixclientv3sync) API,
until the user re-joins, is re-invited, or knocks.

A user may wish to force another user to leave a room. This can be done
by 'kicking' the other user. To do so, the user performing the kick MUST
have the required power level. Once a user has been kicked, the
behaviour is the same as if they had left of their own accord. In
particular, the user is free to re-join if the room is not
"invite-only".

{{% http-api spec="client-server" api="leaving" %}}

{{% http-api spec="client-server" api="kicking" %}}

##### Banning users in a room

A user may decide to ban another user in a room. 'Banning' forces the
target user to leave the room and prevents them from re-joining the
room. A banned user will not be treated as a joined user, and so will
not be able to send or receive events in the room. In order to ban
someone, the user performing the ban MUST have the required power level.
To ban a user, a request should be made to [`/rooms/<room_id>/ban`](/client-server-api/#post_matrixclientv3roomsroomidban)
with:

```json
{
  "user_id": "<user id to ban>",
  "reason": "string: <reason for the ban>"
}
```

Banning a user adjusts the banned member's membership state to `ban`.
Like with other membership changes, a user can directly adjust the
target member's state, by making a request to
[`/rooms/<room id>/state/m.room.member/<user id>`](#put_matrixclientv3roomsroomidstateeventtypestatekey):

```json
{
  "membership": "ban"
}
```

A user must be explicitly unbanned with a request to
[`/rooms/<room_id>/unban`](/client-server-api/#post_matrixclientv3roomsroomidunban) before they can re-join the room or be
re-invited.

{{% http-api spec="client-server" api="banning" %}}

### Published room directory

Homeservers MAY publish a room directory to allow users to discover rooms. A room
can have one of two visibility settings in the directory:

-   `public`: The room will be shown in the published room directory.
-   `private`: The room will be hidden from the published room directory.

Clients can define a room's initial visibility in the directory via the `visibility`
parameter in [`/createRoom`](#post_matrixclientv3createroom). Irrespective of room
creation, clients can query and change a room's visibility in the directory through
the endpoints listed below, provided that the server permits this.

{{% boxes/warning %}}
The visibility setting merely defines whether a room is included in the published
room directory or not. It doesn't make any guarantees about the room's
[join rule](#mroomjoin_rules) or [history visibility](#room-history-visibility).

In particular, a visibility setting of `public` should not be confused with a `public`
join rule. Rooms with a join rule of `knock`, for instance, could reasonably be published
in the directory, too.

Similarly, a visibility setting of `public` does not necessarily imply a `world_readable`
history visibility.

To increase performance or by preference, servers MAY apply additional filters when listing the
directory, for instance, by automatically excluding rooms with `invite` join rules
that are not `world_readable` regardless of their visibility.
{{% /boxes/warning %}}

{{% http-api spec="client-server" api="list_public_rooms" %}}

### Room Summaries

{{% http-api spec="client-server" api="room_summary" %}}

## User Data

### User Directory

{{% http-api spec="client-server" api="users" %}}

### Profiles

{{% http-api spec="client-server" api="profile" %}}

#### Server behaviour

Homeservers MUST at a minimum allow profile look-up for users who are
visible to the requester based on their membership in rooms known to the
homeserver. This means:

-   users that share a room with the requesting user
-   users who are joined to rooms known to the homeserver that have a
    `public` [join rule](#mroomjoin_rules)
-   users who are joined to rooms known to the homeserver that have a
    `world_readable` [history visibility](#room-history-visibility)

In all other cases, homeservers MAY deny profile look-up by responding with
403 and an error code of `M_FORBIDDEN`.

When a remote user is queried and the query is not denied per the above,
homeservers SHOULD query the remote server for the user's profile information.
The remote server MAY itself deny profile queries over federation, however.

When the requested user does not exist, homeservers MAY choose whether to
respond with 403 or 404. If the server denies profile look-up in all but the
required cases, 403 is RECOMMENDED.

##### Events on Change of Profile Information

Because the profile display name and avatar information are likely to be
used in many places of a client's display, changes to these fields cause
an automatic propagation event to occur, informing likely-interested
parties of the new values. This change is conveyed using two separate
mechanisms:

-   an `m.room.member` event (with a `join` membership) is sent to every
    room the user is a member of, to update the `displayname` and
    `avatar_url`.
-   an `m.presence` presence status update is sent, again containing the
    new values of the `displayname` and `avatar_url` keys, in addition
    to the required `presence` key containing the current presence state
    of the user.

Both of these should be done automatically by the homeserver when a user
successfully changes their display name or avatar URL fields.

Additionally, when homeservers emit room membership events for their own
users, they should include the display name and avatar URL fields in
these events so that clients already have these details to hand, and do
not have to perform extra round trips to query it.

## Modules

Modules are parts of the Client-Server API which are not universal to
all endpoints. Modules are strictly defined within this specification
and should not be mistaken for experimental extensions or optional
features. A compliant server implementation MUST support all modules and
supporting specification (unless the implementation only targets clients
of certain profiles, in which case only the required modules for those
feature profiles MUST be implemented). A compliant client implementation
MUST support all the required modules and supporting specification for
the [Feature Profile](#feature-profiles) it targets.

### Feature Profiles

Matrix supports many different kinds of clients: from embedded IoT
devices to desktop clients. Not all clients can provide the same feature
sets as other clients e.g. due to lack of physical hardware such as not
having a screen. Clients can fall into one of several profiles and each
profile contains a set of features that the client MUST support. This
section details a set of "feature profiles". Clients are expected to
implement a profile in its entirety in order for it to be classified as
that profile.

#### Summary

| Module / Profile                                           | Web       | Mobile   | Desktop  | CLI      | Embedded |
|------------------------------------------------------------|-----------|----------|----------|----------|----------|
| [Content Repository](#content-repository)                  | Required  | Required | Required | Optional | Optional |
| [Direct Messaging](#direct-messaging)                      | Required  | Required | Required | Required | Optional |
| [Ignoring Users](#ignoring-users)                          | Required  | Required | Required | Optional | Optional |
| [Instant Messaging](#instant-messaging)                    | Required  | Required | Required | Required | Optional |
| [Presence](#presence)                                      | Required  | Required | Required | Required | Optional |
| [Push Notifications](#push-notifications)                  | Optional  | Required | Optional | Optional | Optional |
| [Receipts](#receipts)                                      | Required  | Required | Required | Required | Optional |
| [Room History Visibility](#room-history-visibility)        | Required  | Required | Required | Required | Optional |
| [Room Upgrades](#room-upgrades)                            | Required  | Required | Required | Required | Optional |
| [Third-party Invites](#third-party-invites)                | Optional  | Required | Optional | Optional | Optional |
| [Typing Notifications](#typing-notifications)              | Required  | Required | Required | Required | Optional |
| [User and Room Mentions](#user-and-room-mentions)          | Required  | Required | Required | Optional | Optional |
| [Voice over IP](#voice-over-ip)                            | Required  | Required | Required | Optional | Optional |
| [Client Config](#client-config)                            | Optional  | Optional | Optional | Optional | Optional |
| [Device Management](#device-management)                    | Optional  | Optional | Optional | Optional | Optional |
| [End-to-End Encryption](#end-to-end-encryption)            | Optional  | Optional | Optional | Optional | Optional |
| [Event Annotations and reactions](#event-annotations-and-reactions) | Optional  | Optional | Optional | Optional | Optional |
| [Event Context](#event-context)                            | Optional  | Optional | Optional | Optional | Optional |
| [Event Replacements](#event-replacements)                  | Optional  | Optional | Optional | Optional | Optional |
| [Read and Unread Markers](#read-and-unread-markers)        | Optional  | Optional | Optional | Optional | Optional |
| [Guest Access](#guest-access)                              | Optional  | Optional | Optional | Optional | Optional |
| [Moderation Policy Lists](#moderation-policy-lists)        | Optional  | Optional | Optional | Optional | Optional |
| [OpenID](#openid)                                          | Optional  | Optional | Optional | Optional | Optional |
| [Recently used emoji](#recently-used-emoji)                | Optional  | Optional | Optional | Optional | Optional |
| [Reference Relations](#reference-relations)                | Optional  | Optional | Optional | Optional | Optional |
| [Reporting Content](#reporting-content)                    | Optional  | Optional | Optional | Optional | Optional |
| [Rich replies](#rich-replies)                              | Optional  | Optional | Optional | Optional | Optional |
| [Room Previews](#room-previews)                            | Optional  | Optional | Optional | Optional | Optional |
| [Room Tagging](#room-tagging)                              | Optional  | Optional | Optional | Optional | Optional |
| [SSO Client Login/Authentication](#sso-client-loginauthentication) | Optional  | Optional | Optional | Optional | Optional |
| [Secrets](#secrets)                                        | Optional  | Optional | Optional | Optional | Optional |
| [Send-to-Device Messaging](#send-to-device-messaging)      | Optional  | Optional | Optional | Optional | Optional |
| [Server Access Control Lists (ACLs)](#server-access-control-lists-acls-for-rooms) | Optional  | Optional | Optional | Optional | Optional |
| [Server Administration](#server-administration)            | Optional  | Optional | Optional | Optional | Optional |
| [Server Notices](#server-notices)                          | Optional  | Optional | Optional | Optional | Optional |
| [Server Side Search](#server-side-search)                  | Optional  | Optional | Optional | Optional | Optional |
| [Spaces](#spaces)                                          | Optional  | Optional | Optional | Optional | Optional |
| [Sticker Messages](#sticker-messages)                      | Optional  | Optional | Optional | Optional | Optional |
| [Third-party Networks](#third-party-networks)              | Optional  | Optional | Optional | Optional | Optional |
| [Threading](#threading)                                    | Optional  | Optional | Optional | Optional | Optional |
| [Invite permission](#invite-permission)                    | Optional  | Optional | Optional | Optional | Optional |

*Please see each module for more details on what clients need to
implement.*

#### Clients

##### Stand-alone web (`Web`)

This is a web page which heavily uses Matrix for communication.
Single-page web apps would be classified as a stand-alone web client, as
would multi-page web apps which use Matrix on nearly every page.

##### Mobile (`Mobile`)

This is a Matrix client specifically designed for consumption on mobile
devices. This is typically a mobile app but need not be so provided the
feature set can be reached (e.g. if a mobile site could display push
notifications it could be classified as a mobile client).

##### Desktop (`Desktop`)

This is a native GUI application which can run in its own environment
outside a browser.

##### Command Line Interface (`CLI`)

This is a client which is used via a text-based terminal.

##### Embedded (`Embedded`)

This is a client which is embedded into another application or an
embedded device.

###### Application

This is a Matrix client which is embedded in another website, e.g. using
iframes. These embedded clients are typically for a single purpose
related to the website in question, and are not intended to be
fully-fledged communication apps.

###### Device

This is a client which is typically running on an embedded device such
as a kettle, fridge or car. These clients tend to perform a few
operations and run in a resource constrained environment. Like embedded
applications, they are not intended to be fully-fledged communication
systems.

{{% cs-module name="Instant Messaging" filename="instant_messaging" %}}
{{% cs-module name="Rich replies" filename="rich_replies" %}}
{{% cs-module name="Voice over IP" filename="voip_events" %}}
{{% cs-module name="Typing Notifications" filename="typing_notifications" %}}
{{% cs-module name="Receipts" filename="receipts" %}}
{{% cs-module name="Read and unread markers" filename="read_markers" %}}
{{% cs-module name="Presence" filename="presence" %}}
{{% cs-module name="Content repository" filename="content_repo" %}}
{{% cs-module name="Send-to-Device messaging" filename="send_to_device" %}}
{{% cs-module name="Device Management" filename="device_management" %}}
{{% cs-module name="End-to-End Encryption" filename="end_to_end_encryption" %}}
{{% cs-module name="Secrets" filename="secrets" %}}
{{% cs-module name="Room History Visibility" filename="history_visibility" %}}
{{% cs-module name="Push Notifications" filename="push" %}}
{{% cs-module name="Third-party invites" filename="third_party_invites" %}}
{{% cs-module name="Server Side Search" filename="search" %}}
{{% cs-module name="Guest Access" filename="guest_access" %}}
{{% cs-module name="Room Previews" filename="room_previews" %}}
{{% cs-module name="Room Tagging" filename="tags" %}}
{{% cs-module name="Client Config" filename="account_data" %}}
{{% cs-module name="Server Administration" filename="admin" %}}
{{% cs-module name="Event Context" filename="event_context" %}}
{{% cs-module name="SSO client login/authentication" filename="sso_login" %}}
{{% cs-module name="Direct Messaging" filename="dm" %}}
{{% cs-module name="Ignoring Users" filename="ignore_users" %}}
{{% cs-module name="Invite permission" filename="invite_permission" %}}
{{% cs-module name="Sticker Messages" filename="stickers" %}}
{{% cs-module name="Reporting Content" filename="report_content" %}}
{{% cs-module name="Third-party Networks" filename="third_party_networks" %}}
{{% cs-module name="OpenID" filename="openid" %}}
{{% cs-module name="Server Access Control Lists (ACLs) for rooms" filename="server_acls" %}}
{{% cs-module name="User and room mentions" filename="mentions" %}}
{{% cs-module name="Room Upgrades" filename="room_upgrades" %}}
{{% cs-module name="Server Notices" filename="server_notices" %}}
{{% cs-module name="Moderation policy lists" filename="moderation_policies" %}}
{{% cs-module name="Spaces" filename="spaces" %}}
{{% cs-module name="Event replacements" filename="event_replacements" %}}
{{% cs-module name="Event annotations and reactions" filename="event_annotations" %}}
{{% cs-module name="Recently used emoji" filename="recent_emoji" %}}
{{% cs-module name="Threading" filename="threading" %}}
{{% cs-module name="Reference relations" filename="reference_relations" %}}
