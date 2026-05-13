const generateButton = document.getElementById("generateButton");
const copyButton = document.getElementById("copyButton");
const notesOutput = document.getElementById("notesOutput");
const statusEl = document.getElementById("status");
const spinner = document.getElementById("spinner");
const openOptions = document.getElementById("openOptions");
const openInstruction = document.getElementById("openInstruction");

function setLoading(isLoading) {
  generateButton.disabled = isLoading;
  spinner.classList.toggle("visible", isLoading);
  generateButton.querySelector(".button-label").textContent = isLoading ? "Generating..." : "Generate Notes";
}

function setStatus(message, type = "info") {
  statusEl.textContent = message;
  statusEl.className = `status ${type}`;
}

openOptions.addEventListener("click", (event) => {
  event.preventDefault();
  chrome.runtime.openOptionsPage();
});

openInstruction.addEventListener("click", async (event) => {
  event.preventDefault();

  try {
    await chrome.tabs.create({ url: chrome.runtime.getURL("options.html#instructionPrompt") });
  } catch {
    chrome.runtime.openOptionsPage();
  }
});

generateButton.addEventListener("click", async () => {
  setLoading(true);
  setStatus("Extracting webpage content...");
  notesOutput.value = "";
  copyButton.disabled = true;

  try {
    const response = await chrome.runtime.sendMessage({ type: "GENERATE_NOTES" });

    if (!response || !response.ok) {
      throw new Error(response?.error || "Unable to generate notes.");
    }

    notesOutput.value = response.notes;
    copyButton.disabled = !response.notes;

    if (response.warning) {
      setStatus(response.warning, "warning");
    } else {
      setStatus("Notes generated.", "success");
    }
  } catch (error) {
    setStatus(error.message || "Something went wrong.", "error");
  } finally {
    setLoading(false);
  }
});

copyButton.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(notesOutput.value);
    setStatus("Copied to clipboard.", "success");
  } catch {
    setStatus("Could not copy notes to clipboard.", "error");
  }
});
