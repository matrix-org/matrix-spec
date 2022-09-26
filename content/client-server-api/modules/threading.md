---
type: module
---

### Threading

{{% added-in v="1.4" %}}

Threads allow users to visually branch their conversations in a room. Typically most used
when a room is discussing multiple topics, threads provide more organisation of communication
that traditional [rich replies](#rich-replies) can't always offer.

Clients SHOULD render threads differently to regular messages or replies in the timeline, such
as by providing some context to what is going on in the thread but keeping the full conversation
history behind a disclosure.

Threads are established using a `rel_type` of `m.thread` and reference the *thread root* (the
first event in a thread). It is not possible to create a thread from an event with a `rel_type`,
which includes not being able to nest threads. All conversation in a thread reference the thread
root instead of the most recent message, unlike rich reply chains.

As a worked example, the following represents a thread and how it'd be formed:

```json
{
  // irrelevant fields excluded
  "type": "m.room.message",
  "event_id": "$alice_hello",
  "sender": "@alice:example.org",
  "content": {
    "msgtype": "m.text",
    "body": "Hello world! How are you?"
  }
}
```

```json
{
  // irrelevant fields excluded
  "type": "m.room.message",
  "event_id": "$bob_hello",
  "sender": "@bob:example.org",
  "content": {
    "m.relates_to": {
      "rel_type": "m.thread",
      "event_id": "$alice_hello"
    },
    "msgtype": "m.text",
    "body": "I'm doing okay, thank you! How about yourself?"
  }
}
```

```json
{
  // irrelevant fields excluded
  "type": "m.room.message",
  "event_id": "$alice_reply",
  "sender": "@alice:example.org",
  "content": {
    "m.relates_to": {
      "rel_type": "m.thread",
      "event_id": "$alice_hello" // note: always references the *thread root*
    },
    "msgtype": "m.text",
    "body": "I'm doing great! Thanks for asking."
  }
}
```

As shown, any event without a `rel_type` can become a thread root by simply referencing it
using an `m.thread` relationship.

#### Fallback for unthreaded clients

Clients which understand how to work with threads should simply do so, however clients which
might not be aware of threads (due to age or scope) might not be able to helpfully represent
the conversation history to its users.

To work around this, events sent by clients which understand threads include [rich reply](#rich-replies)
metadata to attempt to form a reply chain representation of the conversation. This representation
is not ideal for heavily threaded rooms, but allows for users to have context as to what is
being discussed with respect to other messages in the room.

This representation is achieved by merging the two relationships and setting a new `is_falling_back`
flag to `true`.

```json
// within an event's content...
"m.relates_to": {
  // The m.thread relationship structure
  "rel_type": "m.thread",
  "event_id": "$root",

  // The rich reply structure
  "m.in_reply_to": {
    // The most recent message known to the client in the thread.
    // This should be something with a high chance of being rendered by the other client,
    // such as an `m.room.message` event.
    "event_id": "$target"
  },

  // A flag to denote that this is a thread with reply fallback
  "is_falling_back": true
}
```

For `m.room.message` events represented this way, no [reply fallback](#fallbacks-for-rich-replies)
is specified. This allows thread-aware clients to discard the `m.in_reply_to` object entirely
when `is_falling_back` is `true`.

{{% boxes/note %}}
Clients which are acutely aware of threads (they do not render threads, but are otherwise
aware of the feature existing in the spec) can treat rich replies to an event with a `rel_type`
of `m.thread` as a threaded reply, for conversation continuity on the threaded client's side.

To do this, copy the `event_id` (thread root) from the event being replied to, add the
`m.in_reply_to` metadata, and add `is_falling_back: true` to `m.relates_to`.
{{% /boxes/note %}}

#### Replies within threads

In the [fallback for unthreaded clients](#fallback-for-unthreaded-clients) section, a new
`is_falling_back` flag is added to `m.relates_to`. This flag defaults to `false` when not
provided, which also allows a threaded message to contain a reply itself.

Aside from `is_falling_back` being `false` (or not specified), the fallback for unthreaded
clients is used to create a reply within a thread: clients should render the event accordingly.

#### Server behaviour

##### Validation of `m.thread` relationships

Servers SHOULD reject client requests which attempt to start a thread off an event with a
`rel_type`. If the client attempts to target an event which already has an `m.thread`,
`m.reference`, or any other `rel_type` then it should receive a HTTP 400 error response
with appropriate error message, as per the [standard error response](#standard-error-response)
structure.

{{% boxes/note %}}
A specific error code is not currently available for this case: servers should use `M_UNKNOWN`
alongside the HTTP 400 status code.
{{% /boxes/note %}}

##### Server-side aggreagtion of `m.thread` relationships

Given threads always reference the thread root, an event can have multiple "child" events which
then form the thread itself. These events should be [aggregated](#aggregations) by the server.

The aggregation for threads includes some information about the user's participation in the thread,
the approximate number of events in the thread (as known to the server), and the most recent event
in the thread (topologically). This is then bundled into the event as `m.thread`:

```json
{
  "event_id": "$root_event",
  // irrelevant fields not shown
  "unsigned": {
    "m.relations": {
      "m.thread": {
        "latest_event": {
          // A serialized copy of the latest event in the thread.
          // Some fields are not shown here for brevity.
          "event_id": "$message",
          "sender": "@alice:example.org",
          "room_id": "!room:example.org",
          "type": "m.room.message",
          "content": {
            "msgtype": "m.text",
            "body": "Woo! Threads!"
          }
        },
        "count": 7,
        "current_user_participated": true
      }
    }
  }
}
```

`latest_event` is the most recent event (topologically to the server) in the thread sent by an
un-[ignored user](#ignoring-users).

Note that any bundled aggregations on `latest_event` should also be present. The server should be
careful to avoid loops, though loops are not currently possible due to `m.thread` not being possible
to target an event with a `rel_type` already.

`count` is simply the number of events using `m.thread` as a `rel_type` pointing to the target event.
It does not include events sent by [ignored users](#ignoring-users).

`current_user_participated` is `true` when the authenticated user is either:
1. The `sender` of the event receiving the bundle (they sent the thread root).
2. The `sender` of an event which references the thread root with a `rel_type` of `m.thread`.

#### Client behaviour

Client-specific behaviours are described throughout this module and are not repeated here.

Clients might wish to read up on the following endpoints to achieve thread-specific functionality,
however:
* [`GET /relations`](#get_matrixclientv1roomsroomidrelationseventidreltype) using the thread root
  ID to retrieve all events in a thread.
* ***DEVNOTE***: Normally we'd talk about `related_by_rel_types` and `related_by_senders` filters here,
  but because MSC3856 literally replaces them we just don't bother speccing them at this point. At the
  time you're reading this, the commit is targeting MSC3440 specifically and doesn't want to bleed too
  much into the other MSCs, for reasons of clarity. Then again, here I am leaving a long comment explaining
  why we aren't including a relatively short MSC in this commit. You're welcome.
