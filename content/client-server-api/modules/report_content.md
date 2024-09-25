
### Reporting Content

Users may encounter content which they find inappropriate and should be
able to report it to the server administrators or room moderators for
review. This module defines a way for users to report content.

#### Client behaviour

{{% http-api spec="client-server" api="report_content" %}}

#### Server behaviour

Servers are free to handle the reported content however they desire.
This may be a dedicated room to alert server administrators to the
reported content or some other mechanism for notifying the appropriate
people.

Particularly during waves of harmful content, users may report whole
rooms instead of individual events. Server administrators and safety teams
should, therefore, be cautious not to shut down rooms that might otherwise
be legitimate.

{{< changed-in v="1.8" >}} When processing event reports, servers MUST
verify that the reporting user is currently joined to the room the event
is in before accepting a report.

{{< added-in v="1.12" >}} Contrarily, servers MUST NOT restrict room reports
based on whether or not the reporting user is joined to the room. This is
because users can be exposed to harmful content without being joined to a
room, for instance, through room directories.
