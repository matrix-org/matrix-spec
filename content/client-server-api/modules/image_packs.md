### Image packs

{{% added-in v="1.19" %}}

Image packs allow users to organise custom emoticons and stickers into named
collections and share them with others.

An **emoticon** (also called an emote) is a custom image sent inline within a
message, analogous to emoji but defined outside the Unicode standard. A
**sticker** is a standalone image sent as an [`m.sticker`](#msticker) event.
Image packs provide a distribution and discovery mechanism for both.

{{% boxes/note %}}
Emoticons are distinct from the [`m.emote`](#mroommessage-msgtypes) message
type. `m.emote` is used to describe an action (for example, "/me waves
hello"), whereas emoticons are images expressing emotions or other concepts.
{{% /boxes/note %}}

#### Shortcode grammar

Each image in a pack is identified by a **shortcode**: a short, human-readable
string used to search for and reference images. Shortcodes are not intended to
serve as accessible descriptions of an image; that purpose is served by the
`body` property of the image object.

A shortcode MUST match the following grammar:

```
shortcode = 1*100shortcode_char
shortcode_char = ALPHA / DIGIT / "-" / "_"
```

Where `ALPHA` and `DIGIT` are as defined in
[RFC 5234](https://datatracker.ietf.org/doc/html/rfc5234). Shortcodes are
case-sensitive. The length of a shortcode MUST NOT exceed 100 bytes.

The `:` character is specifically excluded because it is widely used across messaging
platforms as a delimiter for triggering emote search (for example, typing
`:cat` to search for an emote named `cat`). The `/` character is excluded
because clients MAY use it to separate a shortcode from a pack name in
completion UI (for example, `:cat/my_pack:`). Spaces are excluded to avoid
ambiguity and common usability issues. This character set matches that used
by Discord and Slack, simplifying bridging.

Homeservers MAY enforce this grammar when `m.room.image_pack` events are
submitted by clients via
[`PUT /_matrix/client/v3/rooms/{roomId}/state/{eventType}/{stateKey}`](/client-server-api/#put_matrixclientv3roomsroomidstateeventtypestatekey).
However, homeservers MUST NOT reject or drop `m.room.image_pack` events
received over federation for failing this grammar. Homeservers MAY locally
soft-fail such events.

Clients SHOULD render emotes and stickers that have malformed shortcodes, so
that users can identify and correct them. Clients SHOULD enforce this grammar
when creating or editing image packs.

#### Events

{{% event event="m.room.image_pack" %}}

#### Account data

{{% event event="m.image_pack.rooms" %}}

#### Image properties

Emoticons SHOULD be at least 128×128 pixels. Stickers SHOULD be at least
512×512 pixels. These minimums ensure that images look sharp on high-DPI
displays.

Accepted image formats are the same as those permitted for
[`m.image`](#mimage) events. Images MAY be animated; clients MAY pause
animations based on user preferences.

#### Room image packs

A room MAY contain any number of image packs, each defined by an
`m.room.image_pack` state event with a distinct `state_key`. Clients SHOULD
present the images in a room's packs only when the user is interacting in
that room.

#### User image packs

To make a room's image pack available globally across all rooms, a user adds
a reference to the pack in their `m.image_pack.rooms` account data event. The
reference consists of the room ID and the `state_key` of the pack.

For example, to enable two packs from different rooms:

```json
{
  "rooms": {
    "!someroom:example.org": {
      "": {}
    },
    "!anotherroom:example.org": {
      "": {},
      "sticker_pack": {}
    }
  }
}
```

#### Space image packs

Clients SHOULD surface image packs defined in the canonical space of the
current room, if the user is also a member of that space. This applies
recursively: if the canonical space itself has a canonical space, the packs
of that space SHOULD also be surfaced. Care SHOULD be taken to avoid cycles
when traversing the space hierarchy, and implementations SHOULD impose a
reasonable limit on the traversal depth.

#### Image pack source priority

When presenting image suggestions to the user, clients SHOULD display image
packs in the following order:

1. Packs referenced in the user's `m.image_pack.rooms` account data.
2. Packs defined in the current room's state.
3. Packs from the canonical space hierarchy of the current room.

The ordering of images *within* a pack is currently up to implementations.

#### Client behaviour

##### Sending custom emotes

Custom emotes are sent as `<img>` elements within the `formatted_body` of an
[`m.room.message`](#mroommessage) event (with `format` set to
`org.matrix.custom.html`). The `data-mx-emoticon` attribute identifies the
element as a custom emote:

```html
<img data-mx-emoticon
     src="mxc://example.org/abc123"
     alt="a waving cat"
     title="cat_wave"
     height="32" />
```

A client MUST treat an `<img>` element as a custom emote if and only if the
`data-mx-emoticon` attribute is present. If the attribute has a value, that
value MUST be ignored (some HTML serialisers MAY produce
`data-mx-emoticon=""`).

The attributes of the `<img>` element are defined as follows.

The `src` attribute MUST be a valid
[`mxc://` URI](/client-server-api/#matrix-content-mxc-uris). Clients MUST
NOT attempt to render images from other URI schemes, as this could result in
unintended network requests.

The `alt` attribute SHOULD be present and set to the `body` of the image
object, or if absent, the image's shortcode. This attribute provides an
accessible text description of the emote as defined by the
[HTML specification](https://html.spec.whatwg.org/multipage/images.html#alt).

The `title` attribute SHOULD be present and set to the shortcode of the
emote. Clients MAY display this as a tooltip.

The `height` attribute MUST be present for backwards compatibility with
clients that do not support custom emotes. Clients SHOULD set this to "32".
Clients implementing image pack support SHOULD override this value when
rendering based on the user's font size or other environmental factors. The
`width` attribute SHOULD be omitted to preserve the image's aspect ratio.

Clients MAY render messages that consist entirely of custom emotes at a larger
size.

##### Sending stickers

When sending an image from a pack as a sticker, the `body` property of the
[`m.sticker`](#msticker) event SHOULD be set to the image object's `body`
property, or if absent, the image's shortcode. The `info` property of the
`m.sticker` event SHOULD be set to the image object's `info` property, or if
absent, an empty object.

##### Emote picker suggestions

Clients MAY use the `:` character as a trigger to initiate emote search in the message composer. When
multiple packs contain images with the same shortcode, clients SHOULD provide
disambiguation UI rather than silently resolving to one image. Clients MAY
disambiguate by appending a slugified pack display name separated by `/`
(for example, `:cat_wave/my_pack:`).

Because pack names are not globally
unique, clients SHOULD NOT attempt to automatically resolve a shortcode to a
specific image. Clients SHOULD instead present a search modal or similar UI
to allow the user to select the intended image.

#### Security considerations

##### Encrypted image packs

Image packs and the images they contain are not encrypted. Media referenced
from image packs is therefore visible to homeservers. Encryption of image
packs depends on encrypted state events, which are not currently defined by
the Matrix specification.

In addition, a homeserver could correlate the timing of encrypted message
events with media access requests to infer which emote was used in an
encrypted event. This attack is analogous to URL preview correlation and is
not unique to image packs. Client-side caching of media can reduce the
frequency of such requests.

Clients SHOULD warn users that media referenced from image packs in
end-to-end encrypted rooms is not encrypted and is therefore visible to the
homeserver.

##### Abusive content

A user who enables a room image pack globally via `m.image_pack.rooms`
implicitly trusts the pack's administrator not to introduce abusive imagery.
If abusive content is added to a pack, the affected user SHOULD remove the
reference from their `m.image_pack.rooms` account data.

#### Unstable prefix

Before this feature was included in the Matrix specification, the following
unstable identifiers were in use. Clients SHOULD migrate to the stable
identifiers defined in this specification.

| Stable identifier | Unstable identifier |
|---|---|
| `m.room.image_pack` | `im.ponies.room_emotes` |
| `m.image_pack.rooms` | `im.ponies.emote_rooms` |
