window.addEventListener('DOMContentLoaded', () => {
  const selector = document.getElementById("version-selector")

  // Get the current version number and check that it or "latest" appears in the URL.
  let current = selector.querySelector("option[selected]").value
  let current_segment
  console.log("current", current)
  if (window.location.href.includes("/" + current + "/")) {
    current_segment = "/" + current + "/"
  } else if (window.location.href.includes("/latest/")) {
    current_segment = "/latest/"
  } else {
    // If not, ditch the selector dropdown.
    let parent = selector.parentElement
    let fallback = parent.querySelector("noscript")
    parent.removeChild(fallback)
    parent.removeChild(selector)
    parent.appendChild(document.createTextNode(fallback.innerText))
    return
  }

  selector.addEventListener("change", event => {
    let chosen = event.target.value
    if (chosen === "historical") {
        // Go to the "historical version" in the current spec's revision.
        let parts = window.location.href.split(current_segment, 2)
        window.location.href = parts[0] + current_segment + "changelog/#historical-versions"
    } else {
        window.location.href = window.location.href.replace(current_segment, "/" + chosen + "/")
    }
  })
});
