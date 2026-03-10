### Policy Servers

{{% added-in v="1.18" %}}

A Policy Server is a homeserver in the room designated to proactively check events
before they are sent to the room/users. Rooms are not required to use a Policy
Server (PS). Rooms which do use a Policy Server can prevent unwanted events from
reaching users.

{{% boxes/note %}}
Room operators might prefer to use a "moderation bot" instead of a Policy Server.
Moderation bots are reactive because they typically [redact](#redactions) events
after they've already been sent.

Room operators might also prefer to layer a moderation bot with a Policy Server
for added protection.
{{% /boxes/note %}}

A room's Policy Server is designated by the [`m.room.policy`](#mroompolicy) state
event described below. If the state event is not set in the room or is incomplete,
the room does *not* use a Policy Server. Similarly, if the server name in the state
event has zero joined users in the room, the room also does *not* use a Policy
Server.

When the room is using a Policy Server, *all* events except for the `m.room.policy`
state event itself are checked by that Policy Server. This includes membership
events, power level changes, events from before the Policy Server was enabled,
and non-state or non-empty `state_key` `m.room.policy` events.

What a Policy Server checks for on an event is left as an implementation detail.

{{% boxes/note %}}
More information about how a Policy Server operates precisely is available in
the [Server-Server API](/server-server-api/#policy-servers). Most notably, not
every homeserver is a Policy Server, and not every Policy Server is a full
homeserver.
{{% /boxes/note %}}

{{% event event="m.room.policy" %}}

#### Client behaviour

Clients do not interact with the Policy Server directly, but may need enough
information to be able to set the `m.room.policy` state event. For this, a client
can attempt to call [`/.well-known/matrix/policy_server`](#getwell-knownmatrixpolicy_server)
on a user-provided server name. The returned information can then be used to
populate the `m.room.policy` state event.

{{% boxes/note %}}
Clients are *not* required to use `/.well-known/matrix/policy_server` to populate the
`m.room.policy` state event. If they have the required information from elsewhere,
they can simply send the state event.
{{% /boxes/note %}}

#### Server behaviour

See the [Policy Servers section of the Server-Server API](/server-server-api/#policy-servers).

{{% boxes/note %}}
If implementing your own Policy Server, see [MSC4284: Policy Servers](https://github.com/matrix-org/matrix-spec-proposals/blob/main/proposals/4284-policy-servers.md)
for additional security, implementation, and safety considerations.
{{% /boxes/note %}}

#### Security considerations

{{% boxes/note %}}
Portions of this section rely on context from the [Policy Servers section of the Server-Server API](/server-server-api/#policy-servers).
{{% /boxes/note %}}

By nature of being a proactive tool for a room, Policy Server can expect to be
Denial of Service (DoS) targets. Policy Servers MUST be tolerant to DoS attacks.
The scale of attack they need to tolerate is left as an implementation/deployment
detail. A Policy Server dedicated to a small community might not have the same
requirements as a Policy Server available for many communities to use.

To help ensure that rooms can be used when their chosen Policy Server is inaccessible,
the `m.room.policy` state event can be set *without* consulting the Policy Server.
This in effect allows users with appropriate power levels to wipe the content of
`m.room.policy`, disabling the Policy Server immediately.

Policy Servers MUST have a joined user in the room to prevent rooms overloading
or forcing a given server to act as a Policy Server. The Policy Server can evict
itself from the room to also disable usage immediately.

Events sent "before" the Policy Server was enabled can end up being recommended
for exclusion by the Policy Server. This is expected behaviour to ensure new policies
apply to events which took a while to send.

Homeservers might not ask a Policy Server for a signature on an event before sending
it to the room. Other compliant homeservers will request that signature instead,
and layered tooling (like "moderation bots") can help remove events which bypass
the room's Policy Server, if desirable.

Homeservers might request and receive a valid signature for an event, but delay
or never send the event. "Moderation bots" can monitor for clock drift on signed
events, if desirable. A Policy Server implementation might also monitor for clock
drift, though does need to consider that events can be backdated in ways beyond
`origin_server_ts`.
