### Media preview configuration

{{% added-in v="1.19" %}}

This module allows users to specify their preferred media preview behaviour. This is designed for
users who may use Matrix in a public setting, and may wish to opt-out of media previews.

#### Events

{{% event event="m.media_preview_config" %}}

#### Client behaviour

A *media preview* is any media in a room that a client may render automatically,
without the user first asking to see it. The user's preferences for media previews are
kept in an [`m.media_preview_config`](#mmedia_preview_config) event in their
[account data](#client-config), which may be set globally and, optionally, per room.

Clients MUST consult the resolved configuration described below before automatically
rendering a media preview.

##### Resolving the configuration

The global `m.media_preview_config` event defines the user's preference for all rooms.
A room-level `m.media_preview_config` event overrides the global event for that room only.

Clients MUST resolve each property independently: if the room account data event defines
the property, that value is used; otherwise the value from the global account data event is
used; otherwise the property defaults to `on`.

For example, given the room account data:

```json
{
  "media_previews": "on"
}
```

and the global account data:

```json
{
  "media_previews": "off",
  "invite_avatars": "off"
}
```

the configuration for that room resolves to:

```json
{
  "media_previews": "on",
  "invite_avatars": "off"
}
```

{{% boxes/note %}}
This per-property fallback from room account data to global account data is specific to
`m.media_preview_config` and is performed by the client. Account data in general has no
inheritance mechanism; see [Client Config](#client-config).
{{% /boxes/note %}}

Where room account data is not available to the client, such as for rooms the user has
been invited to but has not joined, clients MUST use the global account data event alone.

Clients MUST treat any unrecognised value for either property as `off`. This allows new
values to be introduced in the future without clients that do not understand them falling
back to unsafe behaviour.

##### Media previews

The `media_previews` property controls whether media in a room is shown automatically.
Clients SHOULD apply it to at least the following:

* [`m.image`](#mimage), [`m.video`](#mvideo) and [`m.file`](#mfile) messages, which may
  carry thumbnail information or be thumbnailed by the homeserver.
* [`m.sticker`](#msticker) events.
* Inline images sent with the `img` tag in the `formatted_body` of an
  [`m.room.message`](#mroommessage-msgtypes) event.
* Any other event which includes thumbnail information or may be
  [thumbnailed](#thumbnails) by the homeserver.
* Thumbnails returned by [URL previews](#get_matrixclientv1mediapreview_url).

This list is not exhaustive. Other features which automatically render media SHOULD also
respect this setting.

The avatars of users in rooms the user has joined are not affected by this setting. By
joining a room, the user is considered to have consented to seeing the avatars of the other
members of that room.

The property takes one of the following values:

`off`
: Clients MUST NOT automatically show any media preview in the room. Media MAY be hidden
  entirely, or placed behind a prompt which the user must interact with to reveal it.

`private`
: Clients MAY automatically show media previews in *private* rooms, and MUST NOT do so in
  any other room. A room is private if it has an [`m.room.join_rules`](#mroomjoin_rules)
  state event whose `join_rule` is one of `invite`, `knock`, `restricted` or
  `knock_restricted`. Rooms with any other `join_rule`, rooms without an
  `m.room.join_rules` state event, and rooms whose join rule the client cannot determine
  MUST be treated as public.

`on`
: Clients SHOULD automatically show media previews in the room.

Regardless of the resolved value, users MAY choose to reveal individual media which would
otherwise be hidden, or to hide individual media which would otherwise be shown. Clients
SHOULD offer such controls, and SHOULD remember the user's choice so that it is respected
over the configured default the next time the media is displayed. How this choice is
recorded is an implementation detail.

##### Invite avatars

The `invite_avatars` property controls whether a client shows the avatar of a room in
which the user's membership is `invite`, for example in an invite dialog or a room list.
This covers both the room's [`m.room.avatar`](#mroomavatar) and, for direct messages, the
inviting user's `avatar_url`.

Clients MUST NOT render any avatar for a room invite unless permitted by this property.

The property takes one of the following values:

`off`
: Clients MUST NOT automatically show avatars for room invites.

`on`
: Clients SHOULD show avatars for room invites.


#### Server behaviour

Homeservers MAY set a default value for`m.media_preview_config`, but MUST NOT prevent users from changing it.
