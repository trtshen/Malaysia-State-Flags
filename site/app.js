const cards = [...document.querySelectorAll("[data-flag-card]")];
const searchInput = document.querySelector("[data-search-input]");
const filterButtons = [...document.querySelectorAll("[data-filter]")];
const styleSelect = document.querySelector("[data-style-select]");
const sizeSelect = document.querySelector("[data-size-select]");
const resultCount = document.querySelector("[data-result-count]");
const emptyState = document.querySelector("[data-empty-state]");
const copyStatus = document.querySelector("[data-copy-status]");

let activeFilter = "all";

function matchesType(card) {
  if (activeFilter === "all") return true;
  if (activeFilter === "state") return card.dataset.type === "state";
  return card.dataset.type !== "state";
}

function updateResults() {
  const query = searchInput.value.trim().toLocaleLowerCase();
  let visibleCount = 0;

  for (const card of cards) {
    const visible = matchesType(card) && card.dataset.search.includes(query);
    card.hidden = !visible;
    if (visible) visibleCount += 1;
  }

  resultCount.textContent = `${visibleCount} ${visibleCount === 1 ? "flag" : "flags"} shown`;
  emptyState.hidden = visibleCount !== 0;
}

function updateAssets() {
  const style = styleSelect.value;
  const size = sizeSelect.value;

  for (const card of cards) {
    const path = `assets/png/${style}/${size}/${card.dataset.id}.png`;
    card.querySelector("[data-preview]").src = path;
    card.querySelector("[data-png-link]").href = path;
  }
}

async function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.className = "clipboard-fallback";
  document.body.append(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) throw new Error("Copy command was rejected.");
}

searchInput.addEventListener("input", updateResults);

for (const button of filterButtons) {
  button.addEventListener("click", () => {
    activeFilter = button.dataset.filter;
    for (const candidate of filterButtons) {
      candidate.setAttribute("aria-pressed", String(candidate === button));
    }
    updateResults();
  });
}

styleSelect.addEventListener("change", updateAssets);
sizeSelect.addEventListener("change", updateAssets);

for (const button of document.querySelectorAll("[data-copy-button]")) {
  button.addEventListener("click", async () => {
    const card = button.closest("[data-flag-card]");
    const image = card.querySelector("[data-preview]");
    const snippet = `<img src="./${image.getAttribute("src")}" alt="${image.alt}">`;
    try {
      await copyText(snippet);
      button.textContent = "Copied";
      copyStatus.textContent = `${card.querySelector("h3").textContent} HTML copied to the clipboard.`;
      window.setTimeout(() => { button.textContent = "Copy HTML"; }, 1800);
    } catch {
      copyStatus.textContent = "Copying was unavailable. Select and copy the example in the usage section instead.";
    }
  });
}
