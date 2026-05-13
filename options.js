const OLD_DEFAULT_INSTRUCTION = "Analyze this webpage and produce detailed, structured notes covering all key points.";
const DEFAULT_INSTRUCTION = [
  "Analyze this webpage and produce detailed, structured notes covering all key points.",
  "Focus only on the page's substantive content. Do not describe navigation, buttons, menus, layout, UI controls, ads, cookie banners, or other interface elements unless they are central to the page content.",
  "Do not end with offers, follow-up suggestions, or phrases like \"if you want, I can...\". This is a single-turn note-taking task."
].join("\n\n");

const DEFAULT_SETTINGS = {
  provider: "openai",
  openaiApiKey: "",
  openaiModel: "gpt-4o",
  ollamaEndpoint: "http://localhost:11434/api/chat",
  ollamaModel: "llama3",
  instructionPrompt: DEFAULT_INSTRUCTION
};

const form = document.getElementById("optionsForm");
const saveStatus = document.getElementById("saveStatus");
const providerNote = document.getElementById("providerNote");
const providerSections = Array.from(document.querySelectorAll("[data-provider-section]"));

const fields = {
  providerOpenAI: document.getElementById("providerOpenAI"),
  providerOllama: document.getElementById("providerOllama"),
  openaiApiKey: document.getElementById("openaiApiKey"),
  openaiModel: document.getElementById("openaiModel"),
  ollamaEndpoint: document.getElementById("ollamaEndpoint"),
  ollamaModel: document.getElementById("ollamaModel"),
  instructionPrompt: document.getElementById("instructionPrompt")
};

function getSelectedProvider() {
  return fields.providerOllama.checked ? "ollama" : "openai";
}

function updateProviderDisplay() {
  const provider = getSelectedProvider();
  const providerLabel = provider === "ollama" ? "Local Ollama" : "OpenAI";

  providerNote.textContent = `${providerLabel} is currently selected for note generation.`;

  providerSections.forEach((section) => {
    section.classList.toggle("active-provider-section", section.dataset.providerSection === provider);
  });
}

async function loadSettings() {
  const settings = await chrome.storage.local.get(DEFAULT_SETTINGS);
  const shouldMigratePrompt = settings.instructionPrompt === OLD_DEFAULT_INSTRUCTION;
  const instructionPrompt = shouldMigratePrompt ? DEFAULT_INSTRUCTION : settings.instructionPrompt;

  if (shouldMigratePrompt) {
    await chrome.storage.local.set({ instructionPrompt });
  }

  fields.providerOpenAI.checked = settings.provider === "openai";
  fields.providerOllama.checked = settings.provider === "ollama";
  fields.openaiApiKey.value = settings.openaiApiKey;
  fields.openaiModel.value = settings.openaiModel;
  fields.ollamaEndpoint.value = settings.ollamaEndpoint;
  fields.ollamaModel.value = settings.ollamaModel;
  fields.instructionPrompt.value = instructionPrompt;
  updateProviderDisplay();

  if (location.hash === "#instructionPrompt") {
    fields.instructionPrompt.scrollIntoView({ block: "center" });
    fields.instructionPrompt.focus();
  }
}

fields.providerOpenAI.addEventListener("change", updateProviderDisplay);
fields.providerOllama.addEventListener("change", updateProviderDisplay);

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const settings = {
    provider: getSelectedProvider(),
    openaiApiKey: fields.openaiApiKey.value.trim(),
    openaiModel: fields.openaiModel.value.trim() || DEFAULT_SETTINGS.openaiModel,
    ollamaEndpoint: fields.ollamaEndpoint.value.trim() || DEFAULT_SETTINGS.ollamaEndpoint,
    ollamaModel: fields.ollamaModel.value.trim() || DEFAULT_SETTINGS.ollamaModel,
    instructionPrompt: fields.instructionPrompt.value.trim() || DEFAULT_SETTINGS.instructionPrompt
  };

  await chrome.storage.local.set(settings);
  saveStatus.textContent = "Saved.";
  saveStatus.className = "status success";

  setTimeout(() => {
    saveStatus.textContent = "";
    saveStatus.className = "status";
  }, 1800);
});

loadSettings();
