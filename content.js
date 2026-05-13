function extractReadableText() {
  const selectors = ["article", "main", "[role='main']"];
  const container = selectors.map((selector) => document.querySelector(selector)).find(Boolean) || document.body;

  if (!container) {
    return "";
  }

  return container.innerText
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

extractReadableText();
