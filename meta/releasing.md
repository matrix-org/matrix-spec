# How to release the specification

The whole specification is now released as a single unit/artifact. This document is
the process for releasing the specification and a description of how the (public)
machinery works.

## Timeline

The spec is released each calendar quarter. The target release dates are within the
following ranges:

* Q1: January 20-27 (critically, before FOSDEM).
* Q2: May 20-27.
* Q3: August 20-27.
* Q4: November 1-15 (before recurring November conflicts, like IETF).

The SCT aims to have dates picked out by:

* Q1: January 10.
* Q2: May 1.
* Q3: August 1.
* Q4: October 15.

When a release date is picked, a [checklist](https://github.com/matrix-org/matrix-spec/issues/new?assignees=&labels=release-blocker&projects=&template=release.md&title=Matrix+1.X)
issue is created to track details of the release. Release blockers should continue to
be accepted up until 7 calendar days prior to the release date.

**Release dates are not promises.** The SCT reserves the ability to change, cancel,
postpone, etc a release for any reason. Do not rely on a release happening on a given
day until the release has actually happened & blog post published.

Once a release is scheduled, the SCT will begin planning what the next release is
expected to look like. The plan should be included in the spec release blog post,
and be ready for exeuction on spec release day. Plans are guides and not promises.

A blog post for the SCT members to review should be ready at minimum 1 week before
the target release date. 1-2 days before the release itself, the prerequisite steps
below are executed to ensure the spec release can go ahead.

## Release composition

*This section is a work in progress.*

Mentioned above, the SCT aims to have spec releases quarterly. Each quarter has a
slightly different theme to it:

* Q1: Massive feature release, if possible. This generally happens thanks to FOSDEM.
* Q2: Regular feature release, if possible.
* Q3: Momentum-continuing feature release, if possible.
* Q4: Preferably a maintenance release, but will accept features per normal.

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

From time to time we'll need to update a release in the wild. Examples include fixing typos,
updating build machinery, etc. Typically it is not considered a good idea to patch a release
more than 1 month after the original release date - this is because the administrative effort
is typically best reserved for the next release cycle.

**Patch releases are not to be used for spec changes. Only typos and equivalent.**

1. Add the required changes to the release branch (`release/v1.2` for example).
2. Fast forward the `v1.2` tag to the release branch head.
3. Push both the release branch and fast-forwarded tag.
4. Wait for the GitHub Actions build to complete on the tag.
5. Update the assets on the GitHub release to those generated by the latest Actions build.
6. Deploy the release on the webserver. See internal wiki.
7. Remove the changelog entries from `main`, if the changes landed on `main`.
8. Update the github release changelog and changelog on `main`, likely by hand.
