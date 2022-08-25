---
type: module
---

### Receipts

{{< changed-in v="1.4" >}} Added private read receipts.

This module adds in support for receipts. These receipts are a form of
acknowledgement of an event. This module defines the `m.read` receipt
for indicating that the user has read up to a given event, and `m.read.private`
to achieve the same purpose without any other user being aware. Primarily,
`m.read.private` is meant to clear [notifications](#receiving-notifications)
without advertising read-up-to status to others.

Sending a receipt for each event can result in sending large amounts of
traffic to a homeserver. To prevent this from becoming a problem,
receipts are implemented using "up to" markers. This marker indicates
that the acknowledgement applies to all events "up to and including" the
event specified. For example, marking an event as "read" would indicate
that the user had read all events *up to* the referenced event. See the
[Receiving notifications](#receiving-notifications) section for more
information on how read receipts affect notification counts.

#### Events

Each `user_id`, `receipt_type` pair must be associated with only a
single `event_id`.

{{% event event="m.receipt" %}}

#### Client behaviour

In `/sync`, receipts are listed under the `ephemeral` array of events
for a given room. New receipts that come down the event streams are
deltas which update existing mappings. Clients should replace older
receipt acknowledgements based on `user_id` and `receipt_type` pairs.
For example:

    Client receives m.receipt:
      user = @alice:example.com
      receipt_type = m.read
      event_id = $aaa:example.com

    Client receives another m.receipt:
      user = @alice:example.com
      receipt_type = m.read
      event_id = $bbb:example.com

    The client should replace the older acknowledgement for $aaa:example.com with
    this one for $bbb:example.com

Clients should send read receipts when there is some certainty that the
event in question has been **displayed** to the user. Simply receiving
an event does not provide enough certainty that the user has seen the
event. The user SHOULD need to *take some action* such as viewing the
room that the event was sent to or dismissing a notification in order
for the event to count as "read". Clients SHOULD NOT send read receipts
for events sent by their own user.

A client can update the markers for its user by interacting with the
following HTTP APIs.

{{% http-api spec="client-server" api="receipts" %}}

##### Private read receipts

{{% added-in v="1.4" %}}

Some users would like to clear their [notification counts](#receiving-notifications),
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

#### Server behaviour

For efficiency, receipts SHOULD be batched into one event per room
before delivering them to clients.

Some receipts are sent across federation as EDUs with type `m.receipt`. The
format of the EDUs are:

```
{
    <room_id>: {
        <receipt_type>: {
            <user_id>: { <content> }
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
