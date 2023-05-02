
### Voice over IP

This module outlines how two users in a room can set up a Voice over IP
(VoIP) call to each other. Voice and video calls are built upon the
WebRTC 1.0 standard. Call signalling is achieved by sending [message
events](#events) to the room. In this version of the spec, only two-party
communication is supported (e.g. between two peers, or between a peer
and a multi-point conferencing unit). This means that clients MUST only
send call events to rooms with exactly two participants.

All VoIP events have a `version` field. This will be used to determine whether
devices support this new version of the protocol. For example, clients can use
this field to know whether to expect an `m.call.select_answer` event from their
opponent. If clients see events with `version` other than `0` or `"1"`
(including, for example, the numeric value `1`), they should treat these the
same as if they had `version` == `"1"`.

Note that this implies any and all future versions of VoIP events should be
backwards-compatible.  If it does become necessary to introduce a non
backwards-compatible VoIP spec, the intention would be for it to simply use a
separate set of event types.

#### Events

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

##### Streams

Clients are expected to send one stream with one track of kind `audio` (creating a
voice call). They can optionally send a second track in the same stream of kind
`video` (creating a video call).

Clients implementing this specification use the first stream and will ignore
any streamless tracks. Note that in the Javascript WebRTC API, this means
`addTrack()` must be passed two parameters: a track and a stream, not just a
track, and in a video call the stream must be the same for both audio and video
track.

A client may send other streams and tracks but the behaviour of the other party
with respect to presenting such streams and tracks is undefined.

##### Invitees
The `invitee` field should be added whenever the call is intended for one
specific user , and should be set to the Matrix user ID of that user. Invites
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
