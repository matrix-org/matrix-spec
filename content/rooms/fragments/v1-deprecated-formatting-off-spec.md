---
toc_hide: true
---

Events sent into rooms of this version can have formats which are different
from their normal schema. Those cases are documented here.

{{% boxes/warning %}}
The behaviour described here is preserved strictly for backwards compatibility
only. A homeserver should take reasonable precautions to prevent users from
sending these so-called "malformed" events, and must never rely on the behaviours
described here as a default.
{{% /boxes/warning %}}
