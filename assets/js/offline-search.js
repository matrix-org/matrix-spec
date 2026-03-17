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
  'use strict';

  $(document).ready(async function () {
    const pagefind = await import("/pagefind/pagefind.js");
    const $searchInput = $('.td-search input');

    //
    // Lazily initialise Pagefind only when the user is about to start a search.
    //

    $searchInput.focus(() => {
      pagefind.init();
    });

    //
    // Register handler
    //

    $searchInput.on('change', (event) => {
      render($(event.target));

      // Hide keyboard on mobile browser
      $searchInput.blur();
    });

    // Prevent reloading page by enter key on sidebar search.
    $searchInput.closest('form').on('submit', () => {
      return false;
    });

    //
    // Pagefind
    //

    const render = async ($targetSearchInput) => {
      //
      // Dispose existing popover
      //

      {
        let popover = bootstrap.Popover.getInstance($targetSearchInput[0]);
        if (popover !== null) {
          popover.dispose();
        }
      }

      //
      // Search
      //

      const searchQuery = $targetSearchInput.val();
      if (searchQuery === '') {
        return;
      }

      const search = await pagefind.debouncedSearch(searchQuery);
      if (search === null) {
        // A more recent search call has been made, nothing to do.
        return;
      }
      const results = await Promise.all(search.results.slice(0, 20).map(r => r.data()));

      //
      // Make result html
      //

      const $html = $('<div>');

      $html.append(
        $('<div>')
          .css({
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: '1em',
          })
          .append(
            $('<span>').text('Search results').css({ fontWeight: 'bold' })
          )
          .append(
            $('<span>').addClass('td-offline-search-results__close-button')
          )
      );

      const $searchResultBody = $('<div>').css({
        maxHeight: `calc(100vh - ${
          $targetSearchInput.offset().top - $(window).scrollTop() + 180
        }px)`,
        overflowY: 'auto',
      });
      $html.append($searchResultBody);

      if (results.length === 0) {
        $searchResultBody.append(
          $('<p>').text(`No results found for query "${searchQuery}"`)
        );
      } else {
        results.forEach((r) => {
          r.sub_results.forEach((s) => {
            const href = s.url;

            const $entry = $('<div>').addClass('mt-4');

            $entry.append(
              $('<small>').addClass('d-block text-body-secondary').text(r.meta.title)
            );

            $entry.append(
              $('<a>')
                .addClass('d-block')
                .css({
                  fontSize: '1.2rem',
                })
                .attr('href', href)
                .text(s.title)
            );

            $entry.append($('<p>').html(s.excerpt));

            $searchResultBody.append($entry);
          });
        });
      }

      $targetSearchInput.one('shown.bs.popover', () => {
        $('.td-offline-search-results__close-button').on('click', () => {
          $targetSearchInput.val('');
          $targetSearchInput.trigger('change');
        });
      });

      const popover = new bootstrap.Popover($targetSearchInput, {
        content: $html[0],
        html: true,
        customClass: 'td-offline-search-results',
        placement: 'bottom',
      });
      popover.show();
    };
  });
})(jQuery);
