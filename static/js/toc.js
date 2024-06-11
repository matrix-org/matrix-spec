/*
Copyright 2020, 2021 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

/*
Set a new ToC entry.
Clear any previously highlighted ToC items, set the new one,
and adjust the ToC scroll position.
*/
function setTocEntry(newEntry) {
  const activeEntries = document.querySelectorAll("#toc a.active");
  for (const activeEntry of activeEntries) {
    activeEntry.classList.remove('active');
  }

  newEntry.classList.add('active');
  // don't scroll the sidebar nav if the main content is not scrolled
  const nav = document.querySelector("#td-section-nav");
  const content = document.querySelector("html");
  if (content.scrollTop !== 0) {
    nav.scrollTop = newEntry.offsetTop - 100;
  } else {
    nav.scrollTop = 0;
  }
}

/*
Test whether a node is in the viewport
*/
function isInViewport(node) {
  const rect = node.getBoundingClientRect();
  return (
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
    rect.right <= (window.innerWidth || document.documentElement.clientWidth)
  );
}

/*
The callback we pass to the IntersectionObserver constructor.

Called when any of our observed nodes starts or stops intersecting
with the viewport.
*/
function handleIntersectionUpdate(entries) {

  /*
  Special case: If the current URL hash matches a ToC entry, and
  the corresponding heading is visible in the viewport, then that is
  made the current ToC entry, and we don't even look at the intersection
  observer data.
  This means that if the user has clicked on a ToC entry,
  we won't unselect it through the intersection observer.
  */
  const hash = document.location.hash;
  if (hash) {
    let tocEntryForHash = document.querySelector(`nav li a[href="${hash}"]`);
    // if the hash isn't a direct match for a ToC item, check the data attributes
    if (!tocEntryForHash) {
      const fragment = hash.substring(1);
      tocEntryForHash = document.querySelector(`nav li a[data-${fragment}]`);
    }
    if (tocEntryForHash) {
      const headingForHash = document.querySelector(hash);
      if (headingForHash && isInViewport(headingForHash)) {
        setTocEntry(tocEntryForHash);
        return;
      }
    }
  }

  let newEntry = null;

  for (const entry of entries) {
    if (entry.intersectionRatio > 0) {
      const heading = entry.target;
      /*
      This sidebar nav consists of two sections:
      * at the top, a sitenav containing links to other pages
      * under that, the ToC for the current page

      Since the sidebar scrolls to match the document position,
      the sitenav will tend to scroll off the screen.

      If the user has scrolled up to (or near) the top of the page,
      we want to show the sitenav so.

      So: if the H1 (title) for the current page has started
      intersecting, then always scroll the sidebar back to the top.
      */
      if (heading.tagName === "H1" && heading.parentNode.tagName === "DIV") {
        const nav = document.querySelector("#td-section-nav");
        nav.scrollTop = 0;
        return;
      }
      /*
      Otherwise, get the ToC entry for the first entry that
      entered the viewport, if there was one.
      */
      const id = entry.target.getAttribute('id');
      let tocEntry = document.querySelector(`nav li a[href="#${id}"]`);
      // if the id isn't a direct match for a ToC item,
      // check the ToC entry's `data-*` attributes
      if (!tocEntry) {
        tocEntry = document.querySelector(`nav li a[data-${id}]`);
      }
      if (tocEntry && !newEntry) {
        newEntry = tocEntry;
      }
    }
  }

  if (newEntry) {
    setTocEntry(newEntry);
    return;
  }
}

/*
Track when headings enter the viewport, and use this to update the highlight
for the corresponding ToC entry.
*/
window.addEventListener('DOMContentLoaded', () => {

  const toc = document.querySelector("#toc");
  toc.addEventListener("click", event => {
    if (event.target.tagName === "A") {
      setTocEntry(event.target);
    }
  });

  const observer = new IntersectionObserver(handleIntersectionUpdate);

  document.querySelectorAll("h1, h2, h3, h4, h5, h6").forEach((section) => {
    observer.observe(section);
  });

});
