
### Invite permission

{{% added-in v="1.18" %}}

Users may want to control who is allowed to invite them to new rooms. This module defines how
clients and servers can implement invite permission.

#### Account data

{{% event event="m.invite_permission_config" %}}

#### Client behaviour

To reject invites from all users automatically, clients MAY add an [`m.invite_permission_config`](#minvite_permission_config)
event in the user's [account data](#client-config) with the `default_action` property set to
`block`. To stop rejecting all invites, the same event without the `default_action` property MUST be
added to the account data.

When the `default_action` field is unset, other parts of the specification might still have effects
on invites seen by clients, like [ignoring users](#ignoring-users).

Attempting to send an invite to a user that blocks invites will result in an error response with the
`M_INVITE_BLOCKED` error code.

#### Server behaviour

When invites to a given user are blocked, the user's homeserver MUST respond to the following
endpoints with an HTTP 403 status code, with the Matrix error code `M_INVITE_BLOCKED`, if the user
is invited:

* [`PUT /_matrix/federation/v1/invite/{roomId}/{eventId}`](/server-server-api/#put_matrixfederationv1inviteroomideventid)
* [`PUT /_matrix/federation/v2/invite/{roomId}/{eventId}`](/server-server-api/#put_matrixfederationv2inviteroomideventid)
* [`POST /_matrix/client/v3/rooms/{roomId}/invite`](#post_matrixclientv3roomsroomidinvite)
* [`POST /_matrix/client/v3/createRoom`](#post_matrixclientv3createroom), due to a user in the
  `invite` list. It is possible for one of the invited users to be rejected whilst the room creation
  as a whole succeeds.
* [`PUT /_matrix/client/v3/rooms/{roomId}/state/m.room.member/{stateKey}`](#put_matrixclientv3roomsroomidstateeventtypestatekey),
  when the `membership` is set to `invite`.

In addition, invite events for this user already in the database, or received over federation, MUST
NOT be served over client synchronisation endpoints such as [`GET /sync`](#get_matrixclientv3sync).
 
Servers MAY return any suppressed invite events over `GET /sync` if invite blocking is later
disabled.
 
Other endpoints, such as [`GET /rooms/{roomId}/state`](#get_matrixclientv3roomsroomidstate), are not
affected by invite blocking: invite events are returned as normal.
 
The Application Services API is also unaffected by invite blocking: invite events are sent over
[`PUT /_matrix/app/v1/transactions/{txnId}`](/application-service-api/#put_matrixappv1transactionstxnid).
