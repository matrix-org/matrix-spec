### Key backup enabled

{{% added-in v="1.19" %}}

This module enables clients to track a user's preference about enabling or
disabling [server-side backups of room keys](#server-side-key-backups). The data
is stored in the [`m.key_backup`](#mkey_backup) global
[account data](#client-config).

#### Events

{{% event event="m.key_backup" %}}

#### Client behaviour on sign-in

When a user signs in to a client which supports encryption and key backup:

* If this event type exists in account data and contains the specified property
  in the correct format, clients which support key backup MUST take account of
  its contents in their behaviour. For example, clients may automatically turn
  on/off key backup based on the property, or prompt the user, using the
  property value as a default. (Because this property is server-controlled,
  clients may wish to confirm the user's intention.)

* If this event type does not exist in account data, or if it does not contain
  the `enabled` property, or if the value of `enabled` is not a boolean value,
  clients MUST ignore the existing value and MAY decide whether or not to
  perform key backup, possibly based on user input.

#### Client behaviour on setting change

If the user turns on key backups, clients MUST set this event type in account
data, to `"enabled": true`.

If the user turns off key backups, clients MUST set this event type in account
data, to `"enabled": false`.

#### Not actively monitoring this setting

Clients are not required to monitor the `m.key_backup` account data actively.
Clients MAY monitor the setting but should be aware that changing this setting
without user interaction based on choices made in a different client (or a
compromised homeserver) may cause unforeseen security problems or simply be
unexpected by users.
