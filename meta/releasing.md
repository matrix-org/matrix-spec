# How to release the specification

The whole specification is now released as a single unit/artifact. This document is
the process for releasing the specification and a description of how the (public)
machinery works.

## Timeline

The spec is released each calendar quarter. The target release dates are within the
following ranges:

* Q1: January 20-27 (if needed before FOSDEM) or February 21-28.
* Q2: May 15-22.
* Q3: August 1-7 or August 20-27 depending on feature requirements.
* Q4: November 1-15 (before recurring November conflicts, like IETF).

The SCT aims to have dates picked out 2 weeks before the chosen release date. When
possible, releases should be scheduled for Thursdays and Fridays to allow a few
consecutive business days for identifying blockers.

When a release date is picked, a [checklist](https://github.com/matrix-org/matrix-spec/issues/new?assignees=&labels=release-blocker&projects=&template=release.md&title=Matrix+1.X)
issue is created to track details of the release. Release blockers should continue
to be accepted at the discretion of whoever is doing the release (typically, blockers
should be allowed up to 1-2 days before the release date).

**Release dates are not promises.** The SCT reserves the ability to change, cancel,
postpone, etc a release for any reason. Do not rely on a release happening on a given
day until the release has actually happened & blog post published.

Once a release is *scheduled*, the SCT will begin planning what the next release is
expected to look like. The plan should be included in the spec release blog post,
and be ready for execution on spec release day. Plans are guides and not promises.

A blog post for the SCT members to review should be ready 2-3 days prior to the
release at minimum. Preferably a week in advance.

1-2 days before the release itself, the prerequisite steps below are executed to
ensure the spec release can go ahead.

## Release composition

*This section is a work in progress.*

Spec releases do not currently have attached themes, though when planning a release
a broad theme may be considered. Ideally, each release contains a "hero feature"
which is highlighted in the later blog post.

Maintenance-only releases are discouraged, but typical in Q4 to give implementations
a small bit of reprieve from feature development.

## Prerequisites / preparation

First, can we even release the spec? This stage is mostly preparation work needed
to ensure a consistent and reliable specification.

1. Ensure `main` is committed with all the spec changes you expect to be there.
2. Review the changelog to look for typos, wording inconsistencies, or lines which
   can be merged. For example, "Fix typos" and "Fix spelling" can be condensed to
   "Fix various typos throughout the specification".
3. Do a quick skim to ensure changelogs reference the MSCs which brought the changes
   in. They should be linked to the GitHub MSC PR (not the markdown document).

## The release

Assuming the preparation work is complete, all that remains is the actual specification
release.

1. Create a `release/v1.2` branch where `v1.2` is the version you're about to release.
2. Update the `params.version` section of `config.toml` to use the following template:
   ```toml
   [params.version]
   status = "stable"
   current_version_url = "https://spec.matrix.org/latest"

   # This will be the spec version you're releasing. If that's v1.2, then `major = "1"`
   # and `minor = "2"`
   major = "1"
   minor = "2"

   # Today's date. Please use the format implied here for consistency.
   release_date = "October 01, 2021"
   ```
3. Commit the changes.
4. Generate the changelog.
   1. Activate your python virtual environment.
   2. Run `./scripts/generate-changelog.sh v1.2 "October 01, 2021"` (using the correct
      version number and same `release_date` format from the hugo config).
   3. Commit the result.
5. Tag the branch with the spec release with a format of `v1.2` (if releasing Matrix 1.2).
6. Push the release branch and the tag.
7. GitHub Actions will run its build steps. Wait until these are successful. If fixes
   need to be made to repair the pipeline or spec build, delete and re-tag the release.
   You may need to fix up the changelog file by hand in this case.
8. Check out and fast-forward `main` to the release branch.
9. Create a new release on GitHub from the newly created tag.
   * The title should be just "v1.2" (for example).
   * The description should be a copy/paste of the changelog. The generated changelog
     will be at `content/changelog/v1.2.md` - copy/paste verbatim.
   * Upload the artifacts of the GitHub Actions build for the release to the GitHub
     release as artifacts themselves. This should be the tarball that will be deployed
     to spec.matrix.org.
10. Commit a reversion to `params.version` of `config.toml` on `main`:
    ```toml
    [params.version]
    status = "unstable"
    current_version_url = "https://spec.matrix.org/latest"
    # major = "1"
    # minor = "2"
    # release_date = "October 01, 2021"
    ```
11. Push pending commits and ensure the unstable spec updates accordingly from the
    GitHub Actions pipeline.
12. Deploy the release on the webserver. See internal wiki.

## Patching a release

Patch releases are used to fix the most recent release on record. Typically a patch
release will be deployed if there is an issue with the build machinery, a factual
error is introduced by the release, or there are notable clarity issues introduced
by the release which may affect implementation. In all cases, patch releases should
*not* be used if more than 2-4 weeks have passed since the release.

Typos and similar do not generally require a patch release.

**Patch releases must not to be used for spec changes (new MSCs, etc) beyond fixing
factual errors.**

1. Add the required changes to the release branch (`release/v1.2` for example).
2. Fast forward the `v1.2` tag to the release branch head.
3. Push both the release branch and fast-forwarded tag.
4. Wait for the GitHub Actions build to complete on the tag.
5. Update the assets on the GitHub release to those generated by the latest Actions build.
6. Deploy the release on the webserver. See internal wiki.
7. Remove the changelog entries from `main`, if the changes landed on `main`.
8. Update the github release changelog and changelog on `main`, likely by hand.
