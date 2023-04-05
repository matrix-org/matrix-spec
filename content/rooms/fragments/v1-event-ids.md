An event has exactly one event ID. Event IDs in this room version have the
format:

    $opaque_id:domain

where `domain` is the [server name](/appendices/#server-name) of the homeserver
which created the room, and `opaque_id` is a locally-unique string.

The domain is used only for namespacing to avoid the risk of clashes of
identifiers between different homeservers. There is no implication that the
room or event in question is still available at the corresponding homeserver.
