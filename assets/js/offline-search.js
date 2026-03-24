/*
Copyright 2026 The Matrix.org Foundation C.I.C.

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
Adapted from [1] to combine Docsy's built-in search UI with the Pagefind
search backend.

  [1]: https://github.com/matrix-org/docsy/blob/71d103ebb20ace3d528178c4b6d92b6cc4f7fd53/assets/js/offline-search.js
*/

(function ($) {
  "use strict";

  $(document).ready(async function () {
    // This is going to be loaded from ${deployment}/js/main.js so to use a relative path
    // to the Pagefind script we need to navigate one level up.
    const pagefind = await import("../pagefind/pagefind.js");
    const $searchInput = $(".td-search input");

    //
    // Lazily initialise Pagefind only when the user is about to start a search.
    //

    $searchInput.focus(() => {
      pagefind.init();
    });

    //
    // Set up search input handler.
    //

    $searchInput.on("keypress", (event) => {
      // Start searching only upon Enter.
      if (event.which === 13) {
        event.preventDefault();
        render($(event.target));
        return;
      }
    });

    // Prevent reloading page by enter key on sidebar search.
    $searchInput.closest("form").on("submit", () => {
      return false;
    });

    //
    // Callback for searching and rendering the results.
    //

    const render = async ($targetSearchInput) => {
      //
      // Dispose any existing popover.
      //

      disposePopover($targetSearchInput);

      //
      // Check if we need to do a search at all.
      //

      const searchQuery = $targetSearchInput.val();
      if (searchQuery === "") {
        return;
      }

      //
      // Prepare the results popover.
      //

      const $html = $("<div>");

      // Add the header and close button.
      $html.append($("<div>")
        .css({
          display: "flex",
          justifyContent: "space-between",
          marginBottom: "1em",
        })
        .append($("<span>")
          .text("Search results")
          .css({ fontWeight: "bold" }))
        .append($("<button>")
          .addClass("td-offline-search-results__close-button")
          .addClass("btn")
          .addClass("btn-sm")
          .addClass("btn-link")
          .attr("type", "button")
          .attr("aria-label", "Close")
          .on("click", () => {
            $targetSearchInput.val("");
            disposePopover($targetSearchInput);
          })
        )
      );

      // Add the main search results body.
      const $searchResultBody = $("<div>").css({
        maxHeight: `calc(100vh - ${
          $targetSearchInput.offset().top - $(window).scrollTop() + 180
        }px)`,
        overflowY: "auto",
      });
      $html.append($searchResultBody);

      // Append a spinner while we're busy.
      const $spinner = createSpinner();
      $searchResultBody.append($spinner)

      // Display the popover.
      const popover = new bootstrap.Popover($targetSearchInput[0], {
        content: $html[0],
        html: true,
        customClass: "td-offline-search-results",
        placement: "bottom",
      });
      popover.show();

      //
      // Kick off the search, load the results and inject them into the popover.
      //

      const search = await pagefind.debouncedSearch(searchQuery);
      if (search === null) {
        // A more recent search call has been made, nothing to do.
        return;
      }

      if (search.results.length === 0) {
        $searchResultBody.append(
          $("<p>").text(`No results found for query "${searchQuery}"`)
        );
      } else {
        await loadAndRenderResults(search.results, 0, $spinner, $searchResultBody);
      }
    };
  });
})(jQuery);

//
// Helpers
//

const disposePopover = ($targetSearchInput) => {
  const popover = bootstrap.Popover.getInstance($targetSearchInput[0]);
  if (popover !== null) {
    popover.dispose();
  }
}

const createSpinner = () => {
  return $("<div>")
    .addClass("spinner-container")
    .append($("<div>")
      .addClass("spinner-border")
      .attr("role", "status")
      .append($("<div>")
        .addClass("visually-hidden")
        .text("Loading...")))
    .append($("<p>")
      .text("Loading..."));
}

const loadAndRenderResults = async (results, offset, $spinner, $searchResultBody) => {
  // Load and render the first three results and hide the remainder behind a
  // button to not freeze the browser by loading results that may not be
  // displayed.
  const LIMIT = 3;

  for (const [index, result] of results.entries()) {
    if (index < LIMIT) {
      // Insert a container for the result *before* the spinner. This
      // will push down the spinner as new content is loaded and keep
      // it at the end of the popover.
      const $container = $("<div>");
      $spinner.before($container);

      renderResult(await result.data(), index + offset, $container);
    } else if (index === LIMIT) {
      const num_hidden_results = results.length - index;
      const $loader = $("<button>")
        .attr("type", "button")
        .addClass("td-offline-search-results__expander-button")
        .addClass("btn")
        .addClass("btn-sm")
        .addClass("btn-link")
        .text(`Load more results from ${num_hidden_results} other ${pagesString(num_hidden_results)}`)
        .on("click", async () => {
          // Remove the button.
          $loader.remove();

          // Add a spinner while we're busy.
          const $spinner = createSpinner();
          $searchResultBody.append($spinner)

          // Load and render the results.
          await loadAndRenderResults(results.slice(LIMIT), LIMIT + offset, $spinner, $searchResultBody);
        });
      $spinner.before($loader)
    }
  }

  // Remove the spinner now that everything was loaded.
  $spinner.remove();
}

const renderResult = (data, index, $container) => {
  // Add the main result's page title.
  $container.append($("<div>")
    .append($("<a>")
      .css({
        fontSize: "1.2rem",
      })
      .attr("href", data.url)
      .text(data.meta.title))
    .append($("<span>")
      .addClass("text-body-secondary")
      .text(` – ${data.sub_results.length} ${resultsString(data.sub_results.length)}`)));
  
  // Render the first 3 subresults per page and wrap the rest
  // in a collapsed container.
  const LIMIT = 3;
  let $wrapper = null;

  data.sub_results.forEach((s, index_s) => {
    if (index_s === LIMIT) {
      const num_hidden_results = data.sub_results.length - index_s;
      const wrapper_id = `collapsible-subresults-${index}`;
      const $action = $("<span>").text("▶ Show");
      const $expander = $("<button>")
        .attr("data-bs-toggle", "collapse")
        .attr("data-bs-target", `#${wrapper_id}`)
        .attr("aria-expanded", "false")
        .attr("aria-controls", wrapper_id)
        .attr("type", "button")
        .addClass("td-offline-search-results__expander-button")
        .addClass("btn")
        .addClass("btn-sm")
        .addClass("btn-link")
        .append($action)
        .append($("<span>").text(` ${num_hidden_results} more ${resultsString(num_hidden_results)} from ${data.meta.title}`));

      $container.append($("<p>").append($expander));
      $wrapper = $("<div>")
        .addClass("collapse td-offline-search-results__subresults")
        .attr("id", wrapper_id)
        .on("hide.bs.collapse", _ => $action.text("▶ Show"))
        .on("show.bs.collapse", _ => $action.text("▼ Hide"));
      $container.append($wrapper);
    }

    const $entry = $("<div>")
      .css("margin-top", "0.5rem");

    $entry.append(
      $("<a>")
        .addClass("d-block")
        .attr("href", s.url)
        .text(s.title)
    );

    $entry.append($("<p>").html(s.excerpt));

    if (index_s < LIMIT) {
      $container.append($entry);
    } else {
      $wrapper.append($entry);
    }
  });
};

const resultsString = (n) => {
  return n === 1 ? "result" : "results";
};

const pagesString = (n) => {
  return n === 1 ? "page" : "pages";
};
