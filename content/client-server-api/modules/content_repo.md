
### Content repository

The content repository (or "media repository") allows users to upload
files to their homeserver for later use. For example, files which the
user wants to send to a room would be uploaded here, as would an avatar
the user wants to use.

Uploads are POSTed to a resource on the user's local homeserver which
returns an `mxc://` URI which can later be used to GET the download. Content
is downloaded from the recipient's local homeserver, which must first
transfer the content from the origin homeserver using the same API
(unless the origin and destination homeservers are the same).

When serving content, the server SHOULD provide a
`Content-Security-Policy` header. The recommended policy is
`sandbox; default-src 'none'; script-src 'none'; plugin-types application/pdf; style-src 'unsafe-inline'; object-src 'self';`.

{{% boxes/added-in-paragraph %}}
{{< added-in v="1.4" >}} The server SHOULD additionally provide
`Cross-Origin-Resource-Policy: cross-origin` when serving content to allow
(web) clients to access restricted APIs such as `SharedArrayBuffer` when
interacting with the media repository.
{{% /boxes/added-in-paragraph %}}

{{% boxes/added-in-paragraph %}}
{{< changed-in v="1.11" >}} The unauthenticated download endpoints have been
deprecated in favour of newer, authenticated, ones. This change included updating
the pathing of all media endpoints from `/_matrix/media/*` to `/_matrix/client/{version}/media/*`,
with the exception of the `/upload` and `/create` endpoints. The upload/create
endpoints are expected to undergo a similar transition in a later version of the
specification.
{{% /boxes/added-in-paragraph %}}

#### Matrix Content (`mxc://`) URIs

Content locations are represented as Matrix Content (`mxc://`) URIs. They
look like:

```
mxc://<server-name>/<media-id>

<server-name> : The name of the homeserver where this content originated, e.g. matrix.org
<media-id> : An opaque ID which identifies the content.
```

#### Client behaviour {id="content-repo-client-behaviour"}

Clients can access the content repository using the following endpoints.

{{% boxes/added-in-paragraph %}}
{{< changed-in v="1.11" >}} Clients SHOULD NOT use the deprecated media endpoints
described below. Instead, they SHOULD use the new endpoints which require authentication.
{{% /boxes/added-in-paragraph %}}

{{% boxes/warning %}}
By Matrix 1.12, servers SHOULD "freeze" the deprecated, unauthenticated, endpoints
to prevent newly-uploaded media from being downloaded. This SHOULD mean that any
media uploaded *before* the freeze remains accessible via the deprecated endpoints,
and any media uploaded *after* (or *during*) the freeze SHOULD only be accessible
through the new, authenticated, endpoints. For remote media, "newly-uploaded" is
determined by the date the cache was populated. This may mean the media is older
than the freeze, but because the server had to re-download it, it is now considered
"new".

Clients SHOULD update to support the authenticated endpoints before servers freeze
unauthenticated access.

Servers SHOULD consider their local ecosystem impact before enacting a freeze.
This could mean ensuring their users' typical clients support the new endpoints
when available, or updating bridges to start using media proxies.

An *example* timeline for a server may be:

* Matrix 1.11 release: Clients begin supporting authenticated media.
* Matrix 1.12 release: Servers freeze unauthenticated media access.
  * Media uploaded prior to this point still works with the deprecated endpoints.
  * Newly uploaded (or cached) media *only* works on the authenticated endpoints.

Matrix 1.12 is expected to be released in the July-September 2024 calendar quarter.
{{% /boxes/warning %}}

{{% http-api spec="client-server" api="authed-content-repo" %}}

{{% http-api spec="client-server" api="content-repo" %}}

##### Thumbnails

The homeserver SHOULD be able to supply thumbnails for uploaded images
and videos. The exact file types which can be thumbnailed are not
currently specified - see [Issue
\#1938](https://github.com/matrix-org/matrix-doc/issues/1938) for more
information.

The thumbnail methods are "crop" and "scale". "scale" tries to return an
image where either the width or the height is smaller than the requested
size. The client should then scale and letterbox the image if it needs
to fit within a given rectangle. "crop" tries to return an image where
the width and height are close to the requested size and the aspect
matches the requested size. The client should scale the image if it
needs to fit within a given rectangle.

The dimensions given to the thumbnail API are the minimum size the
client would prefer. Servers must never return thumbnails smaller than
the client's requested dimensions, unless the content being thumbnailed
is smaller than the dimensions. When the content is smaller than the
requested dimensions, servers should return the original content rather
than thumbnail it.

Servers SHOULD produce thumbnails with the following dimensions and
methods:

-   32x32, crop
-   96x96, crop
-   320x240, scale
-   640x480, scale
-   800x600, scale

In summary:
-   "scale" maintains the original aspect ratio of the image
-   "crop" provides an image in the aspect ratio of the sizes given in
    the request
-   The server will return an image larger than or equal to the
    dimensions requested where possible.

Servers MUST NOT upscale thumbnails under any circumstance. Servers MUST
NOT return a smaller thumbnail than requested, unless the original
content makes that impossible.

#### Security considerations

The HTTP GET endpoint does not require any authentication. Knowing the
URL of the content is sufficient to retrieve the content, even if the
entity isn't in the room.

`mxc://` URIs are vulnerable to directory traversal attacks such as
`mxc://127.0.0.1/../../../some_service/etc/passwd`. This would cause the
target homeserver to try to access and return this file. As such,
homeservers MUST sanitise `mxc://` URIs by allowing only alphanumeric
(`A-Za-z0-9`), `_` and `-` characters in the `server-name` and
`media-id` values. This set of whitelisted characters allows URL-safe
base64 encodings specified in RFC 4648. Applying this character
whitelist is preferable to blacklisting `.` and `/` as there are
techniques around blacklisted characters (percent-encoded characters,
UTF-8 encoded traversals, etc).

Homeservers have additional content-specific concerns:

-   Clients may try to upload very large files. Homeservers should not
    store files that are too large and should not serve them to clients,
    returning a HTTP 413 error with the `M_TOO_LARGE` code.
-   Clients may try to upload very large images. Homeservers should not
    attempt to generate thumbnails for images that are too large,
    returning a HTTP 413 error with the `M_TOO_LARGE` code.
-   Remote homeservers may host very large files or images. Homeservers
    should not proxy or thumbnail large files or images from remote
    homeservers, returning a HTTP 502 error with the `M_TOO_LARGE` code.
-   Clients may try to upload a large number of files. Homeservers
    should limit the number and total size of media that can be uploaded
    by clients, returning a HTTP 403 error with the `M_FORBIDDEN` code.
-   Clients may try to access a large number of remote files through a
    homeserver. Homeservers should restrict the number and size of
    remote files that it caches.
-   Clients or remote homeservers may try to upload malicious files
    targeting vulnerabilities in either the homeserver thumbnailing or
    the client decoders.
