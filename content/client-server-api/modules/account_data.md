
### Client Config

Clients can store custom config data for their account on their
homeserver. This account data will be synced between different devices
and can persist across installations on a particular device. Users may
only view the account data for their own account.

The account data may be either global or scoped to a particular room.
There is no inheritance mechanism here: a given `type` of data missing
from a room's account data does not fall back to the global account
data with the same `type`.

#### Events

The client receives the account data as events in the `account_data`
sections of a [`/sync`](#get_matrixclientv3sync) response.

These events can also be received in a `/events` response or in the
`account_data` section of a room in a `/sync` response. `m.tag` events appearing in
`/events` will have a `room_id` with the room the tags are for.

#### Client Behaviour

{{% http-api spec="client-server" api="account-data" %}}

#### Server Behaviour

Servers MUST reject clients from setting account data for event types
that the server manages. Currently, this only includes
[`m.fully_read`](#mfully_read) and [`m.push_rules`](#mfully_read).
This applies to both global and room-specific account data.

{{% boxes/note %}}
{{% changed-in v="1.10" %}} `m.push_rules` was added to the rejection
list.
{{% /boxes/note %}}

Servers must allow clients to read the above event types as normal.
