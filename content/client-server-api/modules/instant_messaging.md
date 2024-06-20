
### Instant Messaging

This module adds support for sending human-readable messages to a room.
It also adds support for associating human-readable information with the
room itself such as a room name and topic.

#### Events

{{% event event="m.room.message" desired_example_name="m.room.message$m.text" %}}

{{% event event="m.room.name" %}}

{{% event event="m.room.topic" %}}

{{% event event="m.room.avatar" %}}

{{% event event="m.room.pinned_events" %}}

##### m.room.message msgtypes

Each [m.room.message](#mroommessage) MUST have a `msgtype` key which identifies the
type of message being sent. Each type has their own required and
optional keys, as outlined below. If a client cannot display the given
`msgtype` then it SHOULD display the fallback plain text `body` key
instead.

Some message types support HTML in the event content that clients should
prefer to display if available. Currently `m.text`, `m.emote`, `m.notice`,
`m.image`, `m.file`, `m.audio`, `m.video` and `m.key.verification.request`
support an additional `format` parameter of `org.matrix.custom.html`. When this
field is present, a `formatted_body` with the HTML must be provided. The plain
text version of the HTML should be provided in the `body`.

{{% boxes/note %}}
{{% changed-in v="1.10" %}}
In previous versions of the specification, the `format` and `formatted` fields
were limited to `m.text`, `m.emote`, `m.notice`, and
`m.key.verification.request`. This list is expanded to include `m.image`,
`m.file`, `m.audio` and `m.video` for [media captions](#media-captions).
{{% /boxes/note %}}

Clients should limit the HTML they render to avoid Cross-Site Scripting,
HTML injection, and similar attacks. The strongly suggested set of HTML
tags to permit, denying the use and rendering of anything else, is:
`del`, `h1`, `h2`, `h3`, `h4`, `h5`, `h6`, `blockquote`, `p`, `a`, `ul`,
`ol`, `sup`, `sub`, `li`, `b`, `i`, `u`, `strong`, `em`, `s`, `code`,
`hr`, `br`, `div`, `table`, `thead`, `tbody`, `tr`, `th`, `td`,
`caption`, `pre`, `span`, `img`, `details`, `summary`.

{{% boxes/note %}}
{{% added-in v="1.10" %}}
HTML features MAY be deprecated and replaced by their modern equivalent without
requiring a [Spec Change Proposal](/proposals) when they are deprecated in the
[WHATWG HTML Living Standard](https://html.spec.whatwg.org/multipage/).
{{% /boxes/note %}}

{{% boxes/note %}}
{{% changed-in v="1.10" %}}
In previous versions of the specification, the `font` tag was suggested with the
`data-mx-bg-color`, `data-mx-color` and `color` attributes. This tag is now
deprecated in favor of the `span` tag with the `data-mx-bg-color` and
`data-mx-color` attributes in new messages.
{{% /boxes/note %}}

Not all attributes on those tags should be permitted as they may be
avenues for other disruption attempts, such as adding `onclick` handlers
or excessively large text. Clients should only permit the attributes
listed for the tags below. Where `data-mx-bg-color` and `data-mx-color`
are listed, clients should translate the value (a `#` character followed
by a 6-character hex color code) to the appropriate CSS/attributes for
the tag.

| Tag    | Permitted Attributes                                                                                                                       |
|--------|--------------------------------------------------------------------------------------------------------------------------------------------|
| `span` | `data-mx-bg-color`, `data-mx-color`, `data-mx-spoiler` (see [spoiler messages](#spoiler-messages)), `data-mx-maths` (see [mathematical messages](#mathematical-messages)) |
| `a`    | `name`, `target`, `href` (provided the value is not relative and has a scheme matching one of: `https`, `http`, `ftp`, `mailto`, `magnet`) |
| `img`  | `width`, `height`, `alt`, `title`, `src` (provided it is a [Matrix Content (`mxc://`) URI](#matrix-content-mxc-uris))                      |
| `ol`   | `start`                                                                                                                                    |
| `code` | `class` (only classes which start with `language-` for syntax highlighting)                                                                |
| `div` | `data-mx-maths` (see [mathematical messages](#mathematical-messages))                                                                      |

Additionally, web clients should ensure that *all* `a` tags get a
`rel="noopener"` to prevent the target page from referencing the
client's tab/window.

Tags must not be nested more than 100 levels deep. Clients should only
support the subset of tags they can render, falling back to other
representations of the tags where possible. For example, a client may
not be able to render tables correctly and instead could fall back to
rendering tab-delimited text.

In addition to not rendering unsafe HTML, clients should not emit unsafe
HTML in events. Likewise, clients should not generate HTML that is not
needed, such as extra paragraph tags surrounding text due to Rich Text
Editors. HTML included in events should otherwise be valid, such as
having appropriate closing tags, appropriate attributes (considering the
custom ones defined in this specification), and generally valid
structure.

A special tag, `mx-reply`, may appear on rich replies (described below)
and should be allowed if, and only if, the tag appears as the very first
tag in the `formatted_body`. The tag cannot be nested and cannot be
located after another tag in the tree. Because the tag contains HTML, an
`mx-reply` is expected to have a partner closing tag and should be
treated similar to a `div`. Clients that support rich replies will end
up stripping the tag and its contents and therefore may wish to exclude
the tag entirely.

{{% boxes/note %}}
A future iteration of the specification will support more powerful and
extensible message formatting options, such as the proposal
[MSC1767](https://github.com/matrix-org/matrix-spec-proposals/pull/1767).
{{% /boxes/note %}}

{{% msgtypes %}}

#### Client behaviour

Clients SHOULD verify the structure of incoming events to ensure that
the expected keys exist and that they are of the right type. Clients can
discard malformed events or display a placeholder message to the user.
Redacted `m.room.message` events MUST be removed from the client. This
can either be replaced with placeholder text (e.g. "\[REDACTED\]") or
the redacted message can be removed entirely from the messages view.

Events which have attachments (e.g. `m.image`, `m.file`) SHOULD be
uploaded using the [content repository module](#content-repository)
where available. The resulting `mxc://` URI can then be used in the `url`
key.

Clients MAY include a client generated thumbnail image for an attachment
under a `info.thumbnail_url` key. The thumbnail SHOULD also be a
`mxc://` URI. Clients displaying events with attachments can either use
the client generated thumbnail or ask its homeserver to generate a
thumbnail from the original attachment using the [content repository
module](#content-repository).

##### Recommendations when sending messages

In the event of send failure, clients SHOULD retry requests using an
exponential-backoff algorithm for a certain amount of time T. It is
recommended that T is no longer than 5 minutes. After this time, the
client should stop retrying and mark the message as "unsent". Users
should be able to manually resend unsent messages.

Users may type several messages at once and send them all in quick
succession. Clients SHOULD preserve the order in which they were sent by
the user. This means that clients should wait for the response to the
previous request before sending the next request. This can lead to
head-of-line blocking. In order to reduce the impact of head-of-line
blocking, clients should use a queue per room rather than a global
queue, as ordering is only relevant within a single room rather than
between rooms.

##### Local echo

Messages SHOULD appear immediately in the message view when a user
presses the "send" button. This should occur even if the message is
still sending. This is referred to as "local echo". Clients SHOULD
implement "local echo" of messages. Clients MAY display messages in a
different format to indicate that the server has not processed the
message. This format should be removed when the server responds.

Clients need to be able to match the message they are sending with the
same message which they receive from the event stream. The echo of the
same message from the event stream is referred to as "remote echo". Both
echoes need to be identified as the same message in order to prevent
duplicate messages being displayed. Ideally this pairing would occur
transparently to the user: the UI would not flicker as it transitions
from local to remote. Flickering can be reduced through clients making
use of the transaction ID they used to send a particular event. The
transaction ID used will be included in the event's `unsigned` data as
`transaction_id` when it arrives through the event stream.

Clients unable to make use of the transaction ID are likely to
experience flickering when the remote echo arrives on the event stream
*before* the request to send the message completes. In that case the
event arrives before the client has obtained an event ID, making it
impossible to identify it as a remote echo. This results in the client
displaying the message twice for some time (depending on the server
responsiveness) before the original request to send the message
completes. Once it completes, the client can take remedial actions to
remove the duplicate event by looking for duplicate event IDs.

##### Calculating the display name for a user

Clients may wish to show the human-readable display name of a room
member as part of a membership list, or when they send a message.
However, different members may have conflicting display names. Display
names MUST be disambiguated before showing them to the user, in order to
prevent spoofing of other users.

To ensure this is done consistently across clients, clients SHOULD use
the following algorithm to calculate a disambiguated display name for a
given user:

1.  Inspect the `m.room.member` state event for the relevant user id.
2.  If the `m.room.member` state event has no `displayname` field, or if
    that field has a `null` value, use the raw user id as the display
    name. Otherwise:
3.  If the `m.room.member` event has a `displayname` which is unique
    among members of the room with `membership: join` or
    `membership: invite`, use the given `displayname` as the
    user-visible display name. Otherwise:
4.  The `m.room.member` event has a non-unique `displayname`. This
    should be disambiguated using the user id, for example "display name
    (@id:homeserver.org)".

Developers should take note of the following when implementing the above
algorithm:

-   The user-visible display name of one member can be affected by
    changes in the state of another member. For example, if
    `@user1:matrix.org` is present in a room, with `displayname: Alice`,
    then when `@user2:example.com` joins the room, also with
    `displayname: Alice`, *both* users must be given disambiguated
    display names. Similarly, when one of the users then changes their
    display name, there is no longer a clash, and *both* users can be
    given their chosen display name. Clients should be alert to this
    possibility and ensure that all affected users are correctly
    renamed.
-   The display name of a room may also be affected by changes in the
    membership list. This is due to the room name sometimes being based
    on user display names (see [Calculating the display name for a
    room](#calculating-the-display-name-for-a-room)).
-   If the entire membership list is searched for clashing display
    names, this leads to an O(N^2) implementation for building the list
    of room members. This will be very inefficient for rooms with large
    numbers of members. It is recommended that client implementations
    maintain a hash table mapping from `displayname` to a list of room
    members using that name. Such a table can then be used for efficient
    calculation of whether disambiguation is needed.

##### Displaying membership information with messages

Clients may wish to show the display name and avatar URL of the room
member who sent a message. This can be achieved by inspecting the
`m.room.member` state event for that user ID (see [Calculating the
display name for a user](#calculating-the-display-name-for-a-user)).

When a user paginates the message history, clients may wish to show the
**historical** display name and avatar URL for a room member. This is
possible because older `m.room.member` events are returned when
paginating. This can be implemented efficiently by keeping two sets of
room state: old and current. As new events arrive and/or the user
paginates back in time, these two sets of state diverge from each other.
New events update the current state and paginated events update the old
state. When paginated events are processed sequentially, the old state
represents the state of the room *at the time the event was sent*. This
can then be used to set the historical display name and avatar URL.

##### Calculating the display name for a room

Clients may wish to show a human-readable name for a room. There are a
number of possibilities for choosing a useful name. To ensure that rooms
are named consistently across clients, clients SHOULD use the following
algorithm to choose a name:

1.  If the room has an [m.room.name](#mroomname) state event with a non-empty
    `name` field, use the name given by that field.
2.  If the room has an [m.room.canonical\_alias](#mroomcanonical_alias) state event with a
    valid `alias` field, use the alias given by that field as the name.
    Note that clients should avoid using `alt_aliases` when calculating
    the room name.
3.  If none of the above conditions are met, a name should be composed
    based on the members of the room. Clients should consider
    [m.room.member](#mroommember) events for users other than the logged-in user, as
    defined below.
    1.  If the number of `m.heroes` for the room are greater or equal to
        `m.joined_member_count + m.invited_member_count - 1`, then use
        the membership events for the heroes to calculate display names
        for the users ([disambiguating them if
        required](#calculating-the-display-name-for-a-user)) and
        concatenating them. For example, the client may choose to show
        "Alice, Bob, and Charlie (@charlie:example.org)" as the room
        name. The client may optionally limit the number of users it
        uses to generate a room name.
    2.  If there are fewer heroes than
        `m.joined_member_count + m.invited_member_count - 1`, and
        `m.joined_member_count + m.invited_member_count` is greater than
        1, the client should use the heroes to calculate display names
        for the users ([disambiguating them if
        required](#calculating-the-display-name-for-a-user)) and
        concatenating them alongside a count of the remaining users. For
        example, "Alice, Bob, and 1234 others".
    3.  If `m.joined_member_count + m.invited_member_count` is less than
        or equal to 1 (indicating the member is alone), the client
        should use the rules above to indicate that the room was empty.
        For example, "Empty Room (was Alice)", "Empty Room (was Alice
        and 1234 others)", or "Empty Room" if there are no heroes.

Clients SHOULD internationalise the room name to the user's language
when using the `m.heroes` to calculate the name. Clients SHOULD use
minimum 5 heroes to calculate room names where possible, but may use
more or less to fit better with their user experience.

##### Spoiler messages

{{% added-in v="1.1" %}}

Parts of a message can be hidden visually from the user through use of spoilers.
This does not affect the server's representation of the event content - it
is simply a visual cue to the user that the message may reveal important
information about something, spoiling any relevant surprise.

To send spoilers clients MUST use the `formatted_body` and therefore the
`org.matrix.custom.html` format, described above. This makes spoilers valid on
any `msgtype` which can support this format appropriately.

Spoilers themselves are contained with `span` tags, with the reason (optionally)
being in the `data-mx-spoiler` attribute. Spoilers without a reason must at least
specify the attribute, though the value may be empty/undefined.

An example of a spoiler is:

```json
{
  "msgtype": "m.text",
  "format": "org.matrix.custom.html",
  "body": "Alice [Spoiler](mxc://example.org/abc123) in the movie.",
  "formatted_body": "Alice <span data-mx-spoiler>lived happily ever after</span> in the movie."
}
```

If a reason were to be supplied, it would look like:

```json
{
  "msgtype": "m.text",
  "format": "org.matrix.custom.html",
  "body": "Alice [Spoiler for health of Alice](mxc://example.org/abc123) in the movie.",
  "formatted_body": "Alice <span data-mx-spoiler='health of alice'>lived happily ever after</span> in the movie."
}
```

When sending a spoiler, clients SHOULD provide the fallback in the `body` as shown above
(including the reason). The fallback SHOULD NOT include the text containing spoilers since
`body` might show up in text-only clients or in notifications. To prevent spoilers showing up in
such situations, clients are strongly encouraged to first upload the text containing spoilers
to the media repository, then reference the `mxc://` URI in a markdown-style link, as shown above.

Clients SHOULD render spoilers differently with some sort of disclosure. For example, the
client could blur the actual text and ask the user to click on it for it to be revealed.

##### Media captions

{{% added-in v="1.10" %}}

Media messages, comprised of `m.image`, `m.file`, `m.audio` and `m.video`, can
include a caption to convey additional information about the media.

To send captions, clients MUST use the `filename` and the `body`, and optionally
the `formatted_body` with the `org.matrix.custom.html` format, described above.

If the `filename` is present, and its value is different than `body`, then
`body` is considered to be a caption, otherwise `body` is a filename. `format`
and `formatted_body` are only used for captions.

{{% boxes/note %}}
In previous versions of the specification, `body` was usually used to set the
filename of the uploaded file, and `filename` was only present on `m.file` with
the same purpose.
{{% /boxes/note %}}

An example of a media message with a caption is:

```json
{
    "msgtype": "m.image",
    "url": "mxc://example.org/abc123",
    "filename": "dog.jpg",
    "body": "this is a ~~cat~~ picture :3",
    "format": "org.matrix.custom.html",
    "formatted_body": "this is a <s>cat</s> picture :3",
    "info": {
        "w": 479,
        "h": 640,
        "mimetype": "image/jpeg",
        "size": 27253
    },
    "m.mentions": {}
}
```

Clients MUST render the caption alongside the media and SHOULD prefer its
formatted representation.

##### Mathematical messages

{{% added-in v="1.11" %}}

Users might want to send mathematical notations in their messages.

To send mathematical notations clients MUST use the `formatted_body` and
therefore the `org.matrix.custom.html` format, described above. This makes
mathematical notations valid on any `msgtype` which can support this format
appropriately.

Mathematical notations themselves use the `span` or `div` tags, depending
whether the notation should be presented inline or not. The mathematical
notation is written in [LaTeX](https://www.latex-project.org/) format using the
`data-mx-maths` attribute.

The contents of the tag should be a fallback representation for clients that
cannot render the LaTeX format. The fallback representation could be, for
example, an image, or an HTML approximation, or the raw LaTeX source. When using
an image as a fallback, the sending client should be aware of issues that may
arise from the receiving client using a different background colour. The `body`
should include a textual representation of the notation.

An example of a mathematical notation is:

```json
{
  "msgtype": "m.text",
  "format": "org.matrix.custom.html",
  "body": "This is an equation: sin(x)=a/b.",
  "formatted_body": "This is an equation:
      <span data-mx-maths=\"\\sin(x)=\\frac{a}{b}\">
        sin(<i>x</i>)=<sup><i>a</i></sup>/<sub><i>b</i></sub>
      </span>"
}
```

The LaTeX format is poorly defined and has several extensions, so if a client
encounters syntax that it cannot render, it SHOULD present the fallback
representation instead. Clients SHOULD, however, aim to support, at minimum, the
basic [LaTeX2e](https://www.latex-project.org/) maths commands and the
[TeX](https://tug.org/) maths commands, with the possible exception of commands
that could be security risks.

{{% boxes/warning %}}
In general, LaTeX places a heavy burden on client authors to ensure that it is
processed safely. Certain commands, such as [those that can create macros](https://katex.org/docs/supported#macros),
are potentially dangerous. Clients should either decline to process those
commands, or should take care to ensure that they are handled in safe ways (such
as by limiting recursion). In general, LaTeX commands should be filtered by
allowing known-good commands rather than forbidding known-bad commands.

Therefore, clients should not render mathematics by calling a LaTeX compiler
without proper sandboxing, as those executables were not written to handle
untrusted input. Some LaTeX rendering libraries are better suited for that by
allowing only a subset of LaTeX and enforcing recursion limits.
{{% /boxes/warning %}}

#### Server behaviour

Homeservers SHOULD reject `m.room.message` events which don't have a
`msgtype` key, or which don't have a textual `body` key, with an HTTP
status code of 400.

#### Security considerations

Messages sent using this module are not encrypted, although end to end
encryption is in development (see [E2E module](#end-to-end-encryption)).

Clients should sanitise **all displayed keys** for unsafe HTML to
prevent Cross-Site Scripting (XSS) attacks. This includes room names and
topics.
