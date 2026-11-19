### Real-Time Communication (MatrixRTC) {#matrixrtc}

{{% added-in v="1.20" %}}

MatrixRTC is a generalised framework for building real-time communication (RTC)
experiences, such as voice and video calls. These experiences are referred to as
[applications](#matrixrtc-applications). Within applications, the actual RTC data
is exchanged using [transports](#matrixrtc-transports). What kind of application
may run in a room and under what configuration is governed by [slots](#slots), which
are represented as [`m.rtc.slot`](#mrtcslot) state events. Clients join and leave
slots via [`m.rtc.member`](#mrtcmember) message events, which also advertise the
concrete transports in use. Finally, clients can protect RTC data using transport-level
[encryption](#matrixrtc-encryption) mechanisms.

#### Core framework

##### Events

{{% event event="m.rtc.slot" %}}

{{% event event="m.rtc.member" %}}

{{% event event="m.rtc.encryption_key" %}}

##### Applications {#matrixrtc-applications}

A MatrixRTC application defines a concrete RTC experience, for instance having a
voice or video call or editing a document collaboratively. Each application has
a `type`, which acts as its globally unique identifier and MUST follow the
[Common Namespaced Identifier Grammar](/appendices#common-namespaced-identifier-grammar).

Additionally, each application defines a predictable scheme for constructing slot
ID suffixes. These are used to distinguish multiple instances of the same application
running in different [slots](#slots) and MUST also follow the
[Common Namespaced Identifier Grammar](/appendices#common-namespaced-identifier-grammar)
but without the namespacing requirements.

##### Transports {#matrixrtc-transports}

MatrixRTC transports describe the concrete mechanism by which clients publish and
subscribe to RTC data. Each transport has a `type`, which acts as its globally unique
identifier and MUST follow the [Common Namespaced Identifier Grammar](/appendices#common-namespaced-identifier-grammar).

###### Client Behaviour

Some transports may require server-side infrastructure such as SFUs or TURN servers.
Clients can discover the availability of such infrastructure and any potentially required
connection details via [`GET /rtc/transports`](#get_matrixclientv1rtctransports).

{{% http-api spec="client-server" api="rtc" %}}

##### Slots

A slot in MatrixRTC is a state event of the type [`m.rtc.slot`](#mrtcslot). Room
administrators can use slots to define what MatrixRTC applications are allowed to
run in a room and which settings they should use.

Each slot is tied to a specific application instance via its slot ID. This ID
is stored in the slot's `state_key` and MUST be constructed as follows:

```
slot_id = {type}#{suffix}
```

Here, `type` is the globally unique identifier of the [application](#matrixrtc-applications)
and `suffix` is a valid slot ID suffix for the application.

{{% boxes/note %}}
As an example, consider an application with a `type` of `org.example.app` that only
supports a single instance per room with a fixed slot ID suffix of `default`. As per
the definition above, the only allowed slot ID for such an application instance is
`org.example.app#default`.
{{% /boxes/note %}}

Slot IDs MUST NOT exceed the [maximum allowed length of `state_key`](#size-limits).
Furthermore, implementations MUST treat slot IDs as opaque and refrain from parsing
the components used to construct a slot ID back out of it.

###### Client Behaviour

Clients can open slots by sending an [`m.rtc.slot`](#mrtcslot) state event with `status`
equal to `open`, a valid `application` object and, if needed, a valid `encryption`
object. Any slot that doesn't fulfill these requirements MUST be treated as closed.

To explicitly close an open slot, clients can update the associated [`m.rtc.slot`](#mrtcslot)
state event by setting `status` to `closed`. The `application` and `encryption` objects
are not required on closed slots but MAY be kept around for convenience to simplify
re-opening the slot.

The semantics of open and closed slots for actual slot membership are described in
the [membership section](#matrixrtc-membership) below.

###### Server Behaviour

Servers SHOULD include [`m.rtc.slot`](#mrtcslot) events in the set of state events
that are replicated during [room upgrades](#room-upgrades).

##### Membership {#matrixrtc-membership}

Membership in slots is expressed via [`m.rtc.member`](#mrtcmember) message events.

###### Client Behaviour

Clients MUST send [`m.rtc.member`](#mrtcmember) events as [sticky events](#sticky-events).
The RECOMMENDED sticky duration is 1 hour. Additionally, clients MUST implement
the [ephemeral map algorithm](#building-ephemeral-state-like-maps) to construct
a state-like store of membership events.

{{% boxes/rationale %}}
Sticky events provide the same delivery guarantee that state events have, which
is essential for RTC use cases. At the same time, sticky events avoid some of
the drawbacks of state events such as state bloat, power level restrictions and
lack of encryption.
{{% /boxes/rationale %}}

Different membership events for the same user are distinguished using the
`member.id` property, which doubles up as the `sticky_key` used in the
[ephemeral map algorithm](#building-ephemeral-state-like-maps). Clients MUST
generate a new value for this property from a cryptographically secure random
number generator each time they join or re-join a slot. This includes the case
where a client is already joined to the slot through a different [`m.rtc.member`](#mrtcmember)
event.

{{% boxes/rationale %}}
Using non-deterministic member IDs allows transports to pseudonymize members
against external services.
{{% /boxes/rationale %}}

Clients advertise the transports they have published and are able to subscribe
to in the `transports.published` and `transports.can_subscribe` properties,
respectively. Since publishing transports will usually incur a certain performance
cost, clients SHOULD only publish transports that are actually required, based
on the `transports.can_subscribe` values from other joined membership events.

An [`m.rtc.member`](#mrtcmember) event MUST only be considered joined if
all of the following conditions apply:

- The event matches the event schema for [`m.rtc.member`](#mrtcmember) events.
- The `member.membership` property is set to `join`.
- The event's sender is currently a member of the room with membership `join`.
- The event is currently [sticky](#sticky-events), meaning its stickiness
  duration has not yet expired.
- The event was sent encrypted if the room is encrypted, or unencrypted if the
  room is unencrypted. See the section on encryption [below](#matrixrtc-encryption)
  for further details.
- An [`m.rtc.slot`](#mrtcslot) event exists in the room and has the following
  properties:
  - The event matches the event schema for [`m.rtc.slot`](#mrtcslot) events.
  - The `status` property is set to `open`.
  - The `state_key` property equals the [`m.rtc.member`](#mrtcmember) event's
    `slot_id`.
  - The `application.type` property equals the [`m.rtc.member`](#mrtcmember)
    event's `application.type`.
  - The `encryption` property is set to a valid value if the room is encrypted,
    or absent if the room is unencrypted. See the section on encryption
    [below](#matrixrtc-encryption) for further details.

If any of these conditions is not fulfilled, clients MUST treat the member as left and
refrain from connecting to their transports.

As the resolved join state is constrained by the associated [`m.rtc.slot`](#mrtcslot)
event, clients MUST constantly react to and respect the latest room state. To avoid
unexpectedly re-joining a slot when it is reopened, clients SHOULD leave the slot
by sending an explicit [`m.rtc.member`](#mrtcmember) event with `member.membership`
set to `leave` when the slot is closed. Clients MAY apply a suitable delay between
the slot being closed and sending the leaving event.

Since the resolved join state of an [`m.rtc.member`](#mrtcmember) event is also
constrained by its stickiness, clients need to send a new [`m.rtc.member`](#mrtcmember)
event if they want to stay joined for longer than the event's stickiness duration.
It is RECOMMENDED that clients send these events sufficiently ahead of the stickiness
expiration to minimize potential join state flickering on other clients.

Clients can voluntarily leave a slot by sending an [`m.rtc.member`](#mrtcmember)
event with `member.membership` equal to `leave`. In this case, the `leave_reason`
property can optionally provide context on the cause for leaving. Clients SHOULD only
populate this property if they actually attempted to join the slot before.

To ensure that the membership view remains consistent when clients unexpectedly
lose connectivity, clients SHOULD use [delayed events](#delayed-events) to
implement a "dead man's switch". This means scheduling the leaving [`m.rtc.member`](#mrtcmember)
event as a delayed event with a reasonably short delay (e.g. 15-30 seconds) directly
after joining. While connected, the client then periodically
[restarts](#post_matrixclientv1delayed_eventsdelayidrestart) the delayed event to
push it into the future. If the client happens to lose connectivity and the
delay times out, the homeserver will automatically send the leaving
[`m.rtc.member`](#mrtcmember) event.

##### End-to-end encryption {#matrixrtc-encryption}

MatrixRTC supports transport-level encryption, which is applied on top of the
[end-to-end encryption](#end-to-end-encryption) for message events and to-device
messages. This involves the establishment of shared generic key material by way
of an encryption mechanism, as prescribed by the `encryption` property of
[`m.rtc.slot`](#mrtcslot) events. Once established, the generic key material
is fed into transport-specific encryption mechanisms (which may derive further
secrets from it).

Each encryption mechanism has a `type`, which acts as its globally unique
identifier and MUST follow the [Common Namespaced Identifier Grammar](/appendices#common-namespaced-identifier-grammar).
The only currently defined encryption mechanism `type` is `m.per_member`.

```json
{
  "type": "m.rtc.slot",
  "state_key": "org.example.app#default",
  "content": {
    "status": "open",
    "application": {
      "type": "org.example.app"
    },
    "encryption": {
      "type": "m.per_member"
    }
  }
}
```

###### Client Behaviour

Use of encryption in MatrixRTC is REQUIRED in encrypted rooms. This means that
[`m.rtc.member`](#mrtcmember) events MUST be encrypted and [`m.rtc.slot`](#mrtcslot)
events MUST contain an `encryption` object when sent in an encrypted room. Member
and slot events that violate these conditions MUST be considered left and closed,
respectively. Similarly, clients MUST ignore unencrypted RTC data when connected to
an encrypted slot. Finally, when clients encounter an unknown RTC encryption type
in an encrypted room, they MUST refrain from connecting to the respective slot.

Conversely, MatrixRTC encryption MUST NOT be used in unencrypted rooms.
This is because the only currently defined encryption mechanism, `m.per_member`,
depends on the authentication of encrypted events and to-device messages.

As a result, when room encryption is later enabled in a previously unencrypted
room, any existing [`m.rtc.slot`](#mrtcslot) events are invalidated and will
have to be updated with an appropriate `encryption` object. Unless clients receive
the updated [`m.rtc.slot`](#mrtcslot) event together with the [`m.room.encryption`](#mroomencryption)
event, they MUST leave any joined slots in the affected room immediately.

**`m.per_member` encryption**

Under `m.per_member`, every member maintains a unique sender key. This key is
shared securely with other members via Olm-encrypted [to-device messages](#send-to-device-messaging).

When joining a slot that prescribes the `m.per_member` mechanism, clients MUST
generate a key of `N` bytes using a cryptographically secure random number
generator. The key length `N` depends on which transports the client is publishing.
Clients MUST use a key length that is large enough to satisfy all published
transports.

{{% boxes/note %}}
Since clients use a joint secret when publishing more than one transport, transports
need to account for excess bytes beyond their own key length requirement in their
encryption scheme.
{{% /boxes/note %}}

Once the key is generated, clients MUST share it with other clients joined to the
slot by sending encrypted to-device messages of the type
[`m.rtc.encryption_key`](#mrtcencryption_key).

The recipient devices MUST be determined from the [`m.rtc.member`](#mrtcmember) events
that are considered to be joined to the slot, as per the rules [above](#matrixrtc-membership).
Once the member events have been determined, the [`m.rtc.encryption_key`](#mrtcencryption_key)
to-device messages MUST be sent to the devices that were used to encrypt these member
events. These devices are determined by following the existing processes for
[cryptographic validation](#validation-of-incoming-decrypted-events) of the
sending devices of encrypted room messages.

Receiving clients MUST determine the sender's [`m.rtc.member`](#mrtcmember) event by
matching its `member.id` with the value of `member_id` in the [`m.rtc.encryption_key`](#mrtcencryption_key)
message. Once the member event has been determined, clients MUST verify that the
sender and the device that was used to send the member event match the sender and
device of the to-device message. Otherwise, the message MUST be discarded.

Clients SHOULD discard [`m.rtc.encryption_key`](#mrtcencryption_key) events that
were sent in cleartext or whose sending device is not [cross-signed](#cross-signing)
by its owner.

To ensure confidentiality, clients SHOULD rotate and redistribute their sender
key whenever the set of members that are considered joined to the slot changes.
Additionally, clients SHOULD rotate their sender key on a periodic schedule
regardless of whether the members have changed. This limits the impact of
compromised keys.

In order to account for the delivery latency of to-device messages, clients
SHOULD add a short delay after sending a new key before starting to use it.
Otherwise, receiving members may temporarily be unable to decrypt the sender's
RTC data. The RECOMMENDED delay duration is 5 seconds. Similarly, clients
SHOULD store received keys even if they cannot identify the associated
[`m.rtc.member`](#mrtcmember) event, in order to account for the to-device
message arriving before the membership event.

Finally, clients MAY apply some flexibility to exactly when a rotation
happens relative to a membership change, in order to avoid flooding all
members with to-device messages in short succession.

{{% boxes/warning %}}
Delaying key rotations introduces a time window in which joining or leaving
members can decrypt media that is outside their actual membership period.
{{% /boxes/warning %}}

##### Security considerations

Clients SHOULD notify their users about the existence of RTC streams or
identities discovered from transports that cannot be mapped to any [`m.rtc.member`](#mrtcmember)
event in the slot. Such streams can signal an eavesdropping or impersonation
attack, which is why it is important not to ignore them outright. The way
clients notify their user about this is left as an implementation detail.
