
### Receipts

{{< changed-in v="1.4" >}} Added private read receipts.

This module adds in support for receipts. These receipts are a form of
acknowledgement of an event. This module defines the `m.read` receipt
for indicating that the user has read up to a given event, and `m.read.private`
to achieve the same purpose without any other user being aware. Primarily,
`m.read.private` is intended to clear [notifications](#receiving-notifications)
without advertising read-up-to status to others.

Sending a receipt for each event can result in sending large amounts of
traffic to a homeserver. To prevent this from becoming a problem,
receipts are implemented using "up to" markers. This marker indicates
that the acknowledgement applies to all events "up to and including" the
event specified. For example, marking an event as "read" would indicate
that the user had read all events *up to* the referenced event. See the
[Receiving notifications](#receiving-notifications) section for more
information on how read receipts affect notification counts.

{{< added-in v="1.4" >}} Read receipts exist in three major forms:
* Unthreaded: Denotes a read-up-to receipt regardless of threads. This is how
  pre-threading read receipts worked.
* Threaded, main timeline: Denotes a read-up-to receipt for events not in a
  particular thread. Identified by the thread ID `main`.
* Threaded, in a thread: Denotes a read-up-to receipt within a particular
  thread. Identified by the event ID of the thread root.

Threaded read receipts are discussed in further detail [below](#threaded-read-receipts).

#### Events

{{< changed-in v="1.4" >}} Each `user_id`, `receipt_type`, and categorisation
(unthreaded, or `thread_id`) tuple must be associated with only a single
`event_id`.

{{% event event="m.receipt" %}}

#### Client behaviour

{{< changed-in v="1.4" >}} Altered to support threaded read receipts.

In `/sync`, receipts are listed under the `ephemeral` array of events
for a given room. New receipts that come down the event streams are
deltas which update existing mappings. Clients should replace older
receipt acknowledgements based on `user_id`, `receipt_type`, and the
`thread_id` (if present).
For example:

    Client receives m.receipt:
      user = @alice:example.com
      receipt_type = m.read
      event_id = $aaa:example.com
      thread_id = undefined

    Client receives another m.receipt:
      user = @alice:example.com
      receipt_type = m.read
      event_id = $bbb:example.com
      thread_id = main

    The client does not replace any acknowledgements, yet.

    Client receives yet another m.receipt:
      user = @alice:example.com
      receipt_type = m.read
      event_id = $ccc:example.com
      thread_id = undefined

    The client replaces the older acknowledgement for $aaa:example.com
    with this new one for $ccc:example.com, but does not replace the
    acknowledgement for $bbb:example.com because it belongs to a thread.

    Client receives yet another m.receipt:
      user = @alice:example.com
      receipt_type = m.read
      event_id = $ddd:example.com
      thread_id = main

    Now the client replaces the older $bbb:example.com acknowledgement with
    this new $ddd:example.com acknowledgement. The client does NOT replace the
    older acknowledgement for $ccc:example.com as it is unthreaded.

Clients should send read receipts when there is some certainty that the
event in question has been **displayed** to the user. Simply receiving
an event does not provide enough certainty that the user has seen the
event. The user SHOULD need to *take some action* such as viewing the
room that the event was sent to or dismissing a notification in order
for the event to count as "read". Clients SHOULD NOT send read receipts
for events sent by their own user.

Similar to the rules for sending receipts, threaded receipts should appear
in the context of the thread. If a thread is rendered behind a disclosure,
the client hasn't yet shown the event (or any applicable read receipts)
to the user. Once they expand the thread though, a threaded read receipt
would be sent and per-thread receipts from other users shown.

A client can update the markers for its user by interacting with the
following HTTP APIs.

{{% http-api spec="client-server" api="receipts" %}}

##### Private read receipts

{{% added-in v="1.4" %}}

Some users would like to mark a room as read, clearing their [notification counts](#receiving-notifications),
but not give away the fact that they've read a particular message yet. To
achieve this, clients can send `m.read.private` receipts instead of `m.read`
to do exactly that: clear notifications and not broadcast the receipt to
other users.

Servers MUST NOT send the `m.read.private` receipt to any other user than the
one which originally sent it.

Between `m.read` and `m.read.private`, the receipt which is more "ahead" or
"recent" is used when determining the highest read-up-to mark. See the
[notifications](#receiving-notifications) section for more information on
how this affects notification counts.

If a client sends an `m.read` receipt which is "behind" the `m.read.private`
receipt, other users will see that change happen but the sending user will
not have their notification counts rewound to that point in time. While
uncommon, it is considered valid to have an `m.read` (public) receipt lag
several messages behind the `m.read.private` receipt, for example.

##### Threaded read receipts

{{% added-in v="1.4" %}}

If a client does not use [threading](#threading), then they will simply only
send "unthreaded" read receipts which affect the whole room regardless of threads.

A threaded read receipt is simply one which has a `thread_id` on it, targeting
either a thread root's event ID or `main` for the main timeline.

Threading introduces a concept of multiple conversations being held in the same
room and thus deserve their own read receipts and notification counts. An event is
considered to be "in a thread" if:

* It has a `rel_type` of `m.thread`, or
* Following the event relationships, it has a parent event which references
  the thread root with a `rel_type` of `m.thread`. Implementations should
  not recurse infinitely, though: a maximum of 3 hops is recommended to
  cover indirect relationships.

Events not in a thread but still in the room are considered to be in the "main
timeline". When referring to the main timeline as a thread (e.g. in receipts
and notifications counts) a special thread ID of `main` is used.

Thread roots are considered to be in the main timeline, as are events that are
related to a thread root via non-thread relations.

The following is an example DAG for a room, with dotted lines showing event
relationships and solid lines showing topological ordering.

![threaded-dag](/diagrams/threaded-dag.png)

This DAG can be represented as 3 threaded timelines, with `A` and `B` being thread
roots:

![threaded-dag-threads](/diagrams/threaded-dag-threads.png)

With this, we can demonstrate that:
* A threaded read receipt on `I` would mark `A`, `B`, and `I` as read.
* A threaded read receipt on `E` would mark `C` and `E` as read.
* An unthreaded read receipt on `D` would mark `A`, `B`, `C`, and `D` as read.

Note that marking `A` as read with a threaded read receipt would not mean
that `C`, `E`, `G`, or `H` get marked as read: Thread A's timeline would need
its own threaded read receipt at `H` to accomplish that.

The read receipts for the above 3 examples would be:

```json
{
  "$I": {
    "m.read": {
      "@user:example.org": {
        "ts": 1661384801651,
        "thread_id": "main" // because `I` is not in a thread, but is a threaded receipt
      }
    }
  },
  "$E": {
    "m.read": {
      "@user:example.org": {
        "ts": 1661384801651,
        "thread_id": "$A" // because `E` is in Thread `A`
      }
    }
  },
  "$D": {
    "m.read": {
      "@user:example.org": {
        "ts": 1661384801651
        // no `thread_id` because the receipt is *unthreaded*
      }
    }
  }
}
```

Conditions on sending read receipts apply similarly to threaded and unthreaded read
receipts. For example, a client might send a private read receipt for a threaded
event when the user expands that thread.

#### Server behaviour

For efficiency, receipts SHOULD be batched into one event per room and thread
before delivering them to clients.

Some receipts are sent across federation as EDUs with type `m.receipt`. The
format of the EDUs are:

```
{
    <room_id>: {
        <receipt_type>: {
            <user_id>: { <content (ts & thread_id, currently)> }
        },
        ...
    },
    ...
}
```

These are always sent as deltas to previously sent receipts. Currently
only a single `<receipt_type>` should be used: `m.read`. `m.read.private`
MUST NOT appear in this federated `m.receipt` EDU.

#### Security considerations

As receipts are sent outside the context of the event graph, there are
no integrity checks performed on the contents of `m.receipt` events.
