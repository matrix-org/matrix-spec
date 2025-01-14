
### Voice over IP

This module outlines how two users in a room can set up a Voice over IP
(VoIP) call to each other. Voice and video calls are built upon the
WebRTC 1.0 standard. Call signalling is achieved by sending [message
events](#events) to the room. In this version of the spec, only two-party
communication is supported (e.g. between two peers, or between a peer
and a multi-point conferencing unit). Calls can take place in rooms with
multiple members, but only two devices can take part in the call.

All VoIP events have a `version` field. This is used to determine whether
devices support this new version of the protocol. For example, clients can use
this field to know whether to expect an `m.call.select_answer` event from their
opponent. If clients see events with `version` other than `0` or `"1"`
(including, for example, the numeric value `1`), they should treat these the
same as if they had `version` == `"1"`.

Note that this implies any and all future versions of VoIP events should be
backwards-compatible.  If it does become necessary to introduce a non
backwards-compatible VoIP spec, the intention would be for it to simply use a
separate set of event types.

#### Party Identifiers
Whenever a client first participates in a new call, it generates a `party_id` for itself to use for the
duration of the call. This needs to be long enough that the chance of a collision between multiple devices
both generating an answer at the same time generating the same party ID is vanishingly small: 8 uppercase +
lowercase alphanumeric characters is recommended. Parties in the call are identified by the tuple of
`(user_id, party_id)`.

The client  adds a `party_id` field containing this ID to the top-level of the content of all VoIP events
it sends on the call, including `m.call.invite`. Clients use this to identify remote echo of their own
events: since a user may call themselves, they cannot simply ignore events from their own user. This
field also identifies different answers sent by different clients to an invite, and matches `m.call.candidates`
events to their respective answer/invite.

A client implementation may choose to use the device ID used in end-to-end cryptography for this purpose,
or it may choose, for example, to use a different one for each call to avoid leaking information on which
devices were used in a call (in an unencrypted room) or if a single device (ie. access token) were used to
send signalling for more than one call party.

A grammar for `party_id` is defined [below](#grammar-for-voip-ids).

#### Politeness
In line with [WebRTC perfect negotiation](https://w3c.github.io/webrtc-pc/#perfect-negotiation-example)
there are rules to establish which party is polite in the process of renegotiation. The callee is
always the polite party. In a glare situation, the politeness of a party is therefore determined by
whether the inbound or outbound call is used: if a client discards its outbound call in favour of
an inbound call, it becomes the polite party.

#### Call Event Liveness
`m.call.invite` contains a `lifetime` field that indicates how long the offer is valid for. When
a client receives an invite, it should use the event's `age` field in the sync response plus the
time since it received the event from the homeserver to determine whether the invite is still valid.
The use of the `age` field ensures that incorrect clocks on client devices don't break calls.

If the invite is still valid *and will remain valid for long enough for the user to accept the call*,
it should signal an incoming call. The amount of time allowed for the user to accept the call may
vary between clients. For example, it may be longer on a locked mobile device than on an unlocked
desktop device.

The client should only signal an incoming call in a given room once it has completed processing the
entire sync response and, for encrypted rooms, attempted to decrypt all encrypted events in the
sync response for that room. This ensures that if the sync response contains subsequent events that
indicate the call has been hung up, rejected, or answered elsewhere, the client does not signal it.

If on startup, after processing locally stored events, the client determines that there is an invite
that is still valid, it should still signal it but only after it has completed a sync from the homeserver.

The minimal recommended lifetime is 90 seconds - this should give the user enough time to actually pick
up the call.

#### ICE Candidate Batching
Clients should aim to send a small number of candidate events, with guidelines:
 * ICE candidates which can be discovered immediately or almost immediately in the invite/answer
   event itself (eg. host candidates). If server reflexive or relay candidates can be gathered in
   a sufficiently short period of time, these should be sent here too. A delay of around 200ms is
   suggested as a starting point.
 * The client should then allow some time for further candidates to be gathered in order to batch them,
   rather than sending each candidate as it arrives. A starting point of 2 seconds after sending the
   invite or 500ms after sending the answer is suggested as a starting point (since a delay is natural
   anyway after the invite whilst the client waits for the user to accept it).

#### End-of-candidates
An ICE candidate whose value is the empty string means that no more ICE candidates will
be sent. Clients must send such a candidate in an `m.call.candidates` message.
The WebRTC spec requires browsers to generate such a candidate, however note that at time of writing,
not all browsers do (Chrome does not, but does generate an `icegatheringstatechange` event). The
client should send any remaining candidates once candidate generation finishes, ignoring timeouts above.
This allows bridges to batch the candidates together when bridging to protocols that don't support
trickle ICE.

#### DTMF
Matrix clients can send DTMF as specified by WebRTC. The WebRTC standard as of August
2020 does not support receiving DTMF but a Matrix client can receive and interpret the DTMF sent
in the RTP payload.

#### Grammar for VoIP IDs

`call_id`s and `party_id` must follow the [Opaque Identifier Grammar](/appendices#opaque-identifiers).

#### Behaviour on Room Leave
If the client sees the user it is in a call with leave the room, the client should treat this
as a hangup event for any calls that are in progress. No specific requirement is given for the
situation where a client has sent an invite and the invitee leaves the room, but the client may
wish to treat it as a rejection if there are no more users in the room who could answer the call
(eg. the user is now alone or the `invitee` field was set on the invite).

The same behaviour applies when a client is looking at historic calls.

#### Supported Codecs
The Matrix spec does not mandate particular audio or video codecs, but instead defers to the
WebRTC spec. A compliant Matrix VoIP client will behave in the same way as a supported 'browser'
in terms of what codecs it supports and what variants thereof. The latest WebRTC specification
applies, so clients should keep up to date with new versions of the WebRTC specification whether
or not there have been any changes to the Matrix spec.

#### Events

##### Common Fields

{{% event-fields event_type="call_event" %}}

##### Events

{{% event-group group_name="m.call" %}}

#### Client behaviour

A call is set up with message events exchanged as follows:

```
    Caller                    Callee
    [Place Call]
    m.call.invite ----------->
    m.call.candidate -------->
    [..candidates..] -------->
                            [Answers call]
           <--------------- m.call.answer
    m.call.select_answer ----------->
     [Call is active and ongoing]
           <--------------- m.call.hangup
```

Or a rejected call:

```
    Caller                      Callee
    m.call.invite ------------>
    m.call.candidate --------->
    [..candidates..] --------->
                             [Rejects call]
             <-------------- m.call.hangup
```

Calls are negotiated according to the WebRTC specification.

In response to an incoming invite, a client may do one of several things:
 * Attempt to accept the call by sending an `m.call.answer`.
 * Actively reject the call everywhere: send an `m.call.reject` as per above, which will stop the call from
   ringing on all the user's devices and the caller's client will inform them that the user has
   rejected their call.
 * Ignore the call: send no events, but stop alerting the user about the call. The user's other
   devices will continue to ring, and the caller's device will continue to indicate that the call
   is ringing, and will time the call out in the normal way if no other device responds.

##### Streams

Clients may send more than one stream in a VoIP call. The streams should be
differentiated by including metadata in the [`m.call.invite`](/client-server-api/#mcallinvite),
[`m.call.answer`](/client-server-api/#mcallanswer) and [`m.call.negotiate`](/client-server-api/#mcallnegotiate)
events, using the `sdp_stream_metadata` property. An [`m.call.sdp_stream_metadata_changed`](/client-server-api/#mcallsdp_stream_metadata_changed)
event can be sent when the metadata changes but no negotiation is required.

Clients are recommended to not mute the audio of WebRTC tracks locally when an
incoming stream has the `audio_muted` field set to `true`. This is because when
the other user unmutes themselves, there may be a slight delay between their
client sending audio and the [`m.call.sdp_stream_metadata_changed`](/client-server-api/#mcallsdp_stream_metadata_changed)
event arriving and any audio sent in between will not be heard. The other user
will still stop transmitting audio once they mute on their side, so no audio is
sent without the user's knowledge.

The same suggestion does not apply to `video_muted`. Clients _should_ mute video
locally, so that the receiving side doesn't see a black video.

If `sdp_stream_metadata` is present and an incoming stream is not listed in it,
the stream should be ignored. If a stream has a `purpose` of an unknown type, it
should also be ignored.

For backwards compatibility, if `sdp_stream_metadata` is not present in the
initial [`m.call.invite`](/client-server-api/#mcallinvite) or [`m.call.answer`](/client-server-api/#mcallanswer)
event sent by the other party, the client should assume that this property is
not supported by the other party. It means that multiple streams cannot be
differentiated: the client should only use the first incoming stream and
shouldn't send more than one stream.

Clients implementing this specification should ignore any streamless tracks.

##### Invitees
The `invitee` field should be added whenever the call is intended for one
specific user, and should be set to the Matrix user ID of that user. Invites
without an `invitee` field are defined to be intended for any member of the
room other than the sender of the event.

Clients should consider an incoming call if they see a non-expired invite event where the `invitee` field is either
absent or equal to their user's Matrix ID, however they should evaluate whether or not to ring based on their
user's trust relationship with the callers and/or where the call was placed. As a starting point, it is
suggested that clients ignore call invites from users in public rooms. It is strongly recommended that
when clients do not ring for an incoming call invite, they still display the call invite in the room and
annotate that it was ignored.

##### Glare

"Glare" is a problem which occurs when two users call each other at
roughly the same time. This results in the call failing to set up as
there already is an incoming/outgoing call. A glare resolution algorithm
can be used to determine which call to hangup and which call to answer.
If both clients implement the same algorithm then they will both select
the same call and the call will be successfully connected.

As calls are "placed" to rooms rather than users, the glare resolution
algorithm outlined below is only considered for calls which are to the
same room. The algorithm is as follows:

-   If an `m.call.invite` to a room is received whilst the client is
    **preparing to send** an `m.call.invite` to the same room:
    -   the client should cancel its outgoing call and instead
        automatically accept the incoming call on behalf of the user.
-   If an `m.call.invite` to a room is received **after the client has
    sent** an `m.call.invite` to the same room and is waiting for a
    response:
    -   the client should perform a lexicographical comparison of the
        call IDs of the two calls and use the *lesser* of the two calls,
        aborting the greater. If the incoming call is the lesser, the
        client should accept this call on behalf of the user.

The call setup should appear seamless to the user as if they had simply
placed a call and the other party had accepted. This means any media
stream that had been setup for use on a call should be transferred and
used for the call that replaces it.

#### Server behaviour

The homeserver MAY provide a TURN server which clients can use to
contact the remote party. The following HTTP API endpoints will be used
by clients in order to get information about the TURN server.

{{% http-api spec="client-server" api="voip" %}}

#### Security considerations

Calls should only be placed to rooms with one other user in them. If
they are placed to group chat rooms it is possible that another user
will intercept and answer the call.
