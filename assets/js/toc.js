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
  Only call the given function once every 250 milliseconds to avoid impacting
  the performance of the browser.
  Source: https://remysharp.com/2010/07/21/throttling-function-calls
*/
function throttle(fn) {
  const threshold = 250;
  let last = null;
  let deferTimer = null;

  return function (...args) {
    const now = new Date();

    if (last && now < last + threshold) {
      // Hold on to it.
      clearTimeout(deferTimer);
      deferTimer = setTimeout(() => {
        last = now;
        fn.apply(this, args);
      }, threshold);
    } else {
      last = now;
      fn.apply(this, args);
    }
  }
}

/*
  Get the list of headings that appear in the ToC.
  This is not as simple as querying all the headings in the content, because
  some headings are not rendered in the ToC (e.g. in the endpoint definitions).
*/
function getHeadings() {
  let headings = [];

  // First get the anchors in the ToC.
  const toc_anchors = document.querySelectorAll("#toc nav a");

  for (const anchor of toc_anchors) {
    // Then get the heading from its selector in the anchor's href.
    const selector = anchor.getAttribute("href");
    if (!selector) {
      console.error("Got ToC anchor without href");
      continue;
    }
    
    const heading = document.querySelector(selector);
    if (!heading) {
      console.error("Heading not found for selector:", selector);
      continue;
    }

    headings.push(heading);
  }

  return headings;
}

/*
  Get the heading of the text visible at the top of the viewport.
  This is the first heading above or at the top of the viewport.
*/
function getCurrentHeading(headings, headerOffset) {
  const scrollTop = document.documentElement.scrollTop;
  let prevHeading = null;
  let currentHeading = null;
  let index = 0;

  for (const heading of headings) {
    // Compute the position compared to the viewport.
    const rect = heading.getBoundingClientRect();

    if (rect.top >= headerOffset && rect.top <= headerOffset + 30) {
      // This heading is at the top of the viewport, this is the current heading.
      currentHeading = heading;
      break;
    }
    if (rect.top >= headerOffset) {
      // This is in or below the viewport, the current heading should be the
      // previous one.
      if (prevHeading) {
        currentHeading = prevHeading;
      } else {
        // The first heading does not have a prevHeading.
        currentHeading = heading;
      }
      break;
    }

    prevHeading = heading;
    index += 1;
  }

  // At the bottom of the page we might not have a heading.
  if (!currentHeading) {
    currentHeading = prevHeading;
  }

  return currentHeading;
}

/*
  Select the ToC entry that points to the given ID.
  Clear any previously highlighted ToC items, select the new one,
  and adjust the ToC scroll position.
*/
function selectTocEntry(id) {
  // Deselect previously selected entries.
  const activeEntries = document.querySelectorAll("#toc nav a.active");
  for (const activeEntry of activeEntries) {
    activeEntry.classList.remove('active');
  }

  // Find the new entry and select it.
  const newEntry = document.querySelector(`#toc nav a[href="#${id}"]`);
  if (!newEntry) {
    console.error("ToC entry not found for ID:", id);
    return;
  }
  newEntry.classList.add('active');

  // Don't scroll the sidebar nav if the main content is not scrolled
  const nav = document.querySelector("#td-section-nav");
  const content = document.querySelector("html");
  if (content.scrollTop !== 0) {
    nav.scrollTop = newEntry.offsetTop - 100;
  } else {
    nav.scrollTop = 0;
  }
}

/*
  Track when the view is scrolled, and use this to update the highlight for the
  corresponding ToC entry.
*/
window.addEventListener('DOMContentLoaded', () => {
  // Part of the viewport is below the header so we should take it into account.
  const headerOffset = document.querySelector("body > header > nav").clientHeight;
  const headings = getHeadings();

  const onScroll = throttle((_e) => {
    // Update the ToC.
    let heading = getCurrentHeading(headings, headerOffset);
    selectTocEntry(heading.id);
  });

  // Initialize the state of the ToC.
  onScroll();

  // Listen to scroll and resizing changes.
  document.addEventListener('scroll', onScroll, false);
  document.addEventListener('resize', onScroll, false);
});
