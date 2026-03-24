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

    $searchInput.on("change", (event) => {
      render($(event.target));
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

      {
        let popover = bootstrap.Popover.getInstance($targetSearchInput[0]);
        if (popover !== null) {
          popover.dispose();
        }
      }

      //
      // Kick off the search and collect the results.
      //

      const searchQuery = $targetSearchInput.val();
      if (searchQuery === "") {
        return;
      }

      // Show the results popover with a spinner while we're busy.
      const $spinner = $("<div>")
        .addClass("spinner-container")
        .append($("<div>")
          .addClass("spinner-border")
          .attr("role", "status")
          .append($("<div>")
            .addClass("visually-hidden")
            .text("Loading...")))
        .append($("<p>")
          .text("Loading..."));
      const popover = new bootstrap.Popover($targetSearchInput[0], {
        content: $spinner[0],
        html: true,
        customClass: "td-offline-search-results",
        placement: "bottom",
      });
      popover.show();

      // Kick off the search.
      const search = await pagefind.debouncedSearch(searchQuery);
      if (search === null) {
        // A more recent search call has been made, nothing to do.
        return;
      }

      // Load all result details. We may want to switch to a paged UI in future for better performance.
      const results = await Promise.all(search.results.slice(0, 100).map(r => r.data()));

      //
      // Construct the search results html.
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
        .append($("<span>")
          .addClass("td-offline-search-results__close-button")
          .attr("role", "button")
          .attr("aria-label", "Close")
          .on("click", () => {
            $targetSearchInput.val("");
            $targetSearchInput.trigger("change");
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

      if (results.length === 0) {
        $searchResultBody.append(
          $("<p>").text(`No results found for query "${searchQuery}"`)
        );
      } else {
        results.forEach((r, index_r) => {
          // Add the main result's page title.
          $searchResultBody.append($("<div>")
            .append($("<a>")
              .css({
                fontSize: "1.2rem",
              })
              .attr("href", r.url)
              .text(r.meta.title))
            .append($("<span>")
              .addClass("text-body-secondary")
              .text(` – ${r.sub_results.length} ${resultsString(r.sub_results.length)}`)));
          
          // Render the first 3 subresults per page and wrap the rest
          // in a collapsed container.
          const LIMIT = 3;
          let $wrapper = null;

          r.sub_results.forEach((s, index_s) => {
            if (index_s === LIMIT) {
              const num_hidden_results = r.sub_results.length - index_s;
              const wrapper_id = `collapsible-subresults-${index_r}`;
              const $action = $("<span>").text("▶ Show");
              const $expander = $("<button>")
                .attr("data-bs-toggle", "collapse")
                .attr("data-bs-target", `#${wrapper_id}`)
                .attr("aria-expanded", "false")
                .attr("aria-controls", wrapper_id)
                .attr("type", "button")
                .addClass("btn")
                .addClass("btn-sm")
                .addClass("btn-outline-secondary")
                .append($action)
                .append($("<span>").text(` ${num_hidden_results} more ${resultsString(num_hidden_results)} from ${r.meta.title}`));

              $searchResultBody.append($("<p>").append($expander));
              $wrapper = $("<div>")
                .addClass("collapse td-offline-search-results__subresults")
                .attr("id", wrapper_id)
                .on("hide.bs.collapse", _ => $action.text("▶ Show"))
                .on("show.bs.collapse", _ => $action.text("▼ Hide"));
              $searchResultBody.append($wrapper);
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
              $searchResultBody.append($entry);
            } else {
              $wrapper.append($entry);
            }
          });
        });
      }

      // Finally, show the search results.
      //
      // Ideally we would just call setContent but there appears to be a bug in Bootstrap
      // that causes the popover to be hidden when setContent is called after the popover
      // has been shown. To work around this, we use the hack from [1] to inject the HTML
      // content manually.
      //
      // [1]: https://github.com/twbs/bootstrap/issues/37206#issuecomment-1259541205
      $(popover.tip.querySelector('.popover-body')).html($html[0]);
      popover.update();
    };
  });
})(jQuery);

//
// Helpers
//

const resultsString = (n) => {
  return n === 1 ? "result" : "results";
};
