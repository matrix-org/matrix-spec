### Recently used emoji

{{% added-in v="1.18" %}}

This module enables clients to track a user's cumulated emoji usage across different
devices. The data is stored in the [`m.recent_emoji`](#mrecent_emoji)
global [account data](https://spec.matrix.org/v1.15/client-server-api/#client-config) and can, 
among other things, be used to generate recommendations
in emoji pickers.

#### Events

{{% event event="m.recent_emoji" %}}

#### Client behaviour

What exactly constitutes trackable emoji usage is left as an implementation detail
for clients. It is RECOMMENDED to include sending emoji in both messages and
annotations.

When an emoji is used, the sending client moves (or adds) it to the beginning of
the `recent_emoji` array and increments (or initializes) its counter. This keeps
the array ordered by last usage time which facilitates evaluating the data. How
exactly the client evaluates and uses the collected data is deliberately left
unspecified.

To prevent excessive growth of the event as new emoji are being used, clients
SHOULD limit the length of the `recent_emoji` array by dropping elements from
its end. A RECOMMENDED maximum length is 100 emoji.

To enable future extension, clients MUST tolerate and preserve array elements
within `recent_emoji` regardless of whether they understand or support the
contained `emoji` value. This means ignoring entries with unrecognised values
of `emoji` when deciding what to display to the user while retaining them when
modifying the array (unless the modification is for truncation).

To prevent undefined behavior, clients SHOULD remove array elements that
don't conform to the event schema such as elements with negative counters.



