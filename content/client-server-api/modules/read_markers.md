### Read and unread markers

#### Fully read markers

The history for a given room may be split into three sections: messages
the user has read (or indicated they aren't interested in them),
messages the user might have read some but not others, and messages the
user hasn't seen yet. The "fully read marker" (also known as a "read
marker") marks the last event of the first section, whereas the user's
read receipt marks the last event of the second section.

##### Events

The user's fully read marker is kept as an event in the room's [account
data](#client-config). The event may be read to determine the user's
current fully read marker location in the room, and just like other
account data events the event will be pushed down the event stream when
updated.

The fully read marker is kept under an `m.fully_read` event. If the
event does not exist on the user's account data, the fully read marker
should be considered to be the user's read receipt location.

{{% event event="m.fully_read" %}}

##### Client behaviour

The client cannot update fully read markers by directly modifying the
`m.fully_read` account data event. Instead, the client must make use of
the read markers API to change the values.

{{% changed-in v="1.4" %}} `m.read.private` receipts can now be sent from
`/read_markers`.

The read markers API can additionally update the user's read receipt
(`m.read` or `m.read.private`) location in the same operation as setting
the fully read marker location. This is because read receipts and read
markers are commonly updated at the same time, and therefore the client
might wish to save an extra HTTP call. Providing `m.read` and/or
`m.read.private` performs the same task as a request to
[`/receipt/{receiptType}/{eventId}`](#post_matrixclientv3roomsroomidreceiptreceipttypeeventid).

{{% http-api spec="client-server" api="read_markers" %}}

##### Server behaviour

The server MUST prevent clients from setting `m.fully_read` directly in
room account data. The server must additionally ensure that it treats
the presence of `m.read` and `m.read.private` in the `/read_markers`
request the same as how it would for a request to
[`/receipt/{receiptType}/{eventId}`](#post_matrixclientv3roomsroomidreceiptreceipttypeeventid).

Upon updating the `m.fully_read` event due to a request to
`/read_markers`, the server MUST send the updated account data event
through to the client via the event stream (eg: `/sync`), provided any
applicable filters are also satisfied.

#### Unread markers

{{% added-in v="1.12" %}}

Clients may use "unread markers" to allow users to label rooms for later
attention irrespective of [read receipts](#receipts) or
[fully read markers](#fully-read-markers).

##### Events

The user's unread marker in a room is kept under an `m.marked_unread`
event in the room's [account data](#client-config). The event may be read
to determine the user's current unread marker state in the room. Just
like other account data events, the event will be pushed down the event
stream when updated.

{{% event event="m.marked_unread" %}}

##### Client behaviour

Clients MUST update unread markers by directly modifying the `m.marked_unread`
room account data event. When marking a room as unread, clients SHOULD NOT change
the `m.fully_read` marker, so that the user's read position in the room is
retained.

When the `unread` field is `true`, clients SHOULD visually annotate the room
to indicate that it is unread. Exactly how this is achieved is left as an
implementation detail. It is RECOMMENDED that clients use a treatment similar
to how they represent rooms with unread notifications.

Clients SHOULD reset the unread marker by setting `unread` to `false` when
opening a room to display its timeline.

Clients that offer functionality to mark a room as _read_ by sending a read
receipt for the last event, SHOULD reset the unread marker simultaneously.

If the `m.marked_unread` event does not exist on the user's account data,
clients MUST behave as if `unread` was `false`.

##### Server behaviour

Servers have no additional requirements placed on them by this submodule.
