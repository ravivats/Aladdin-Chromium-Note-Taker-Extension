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

const MAX_WORDS = 12000;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "GENERATE_NOTES") {
    return false;
  }

  generateNotes()
    .then((result) => sendResponse({ ok: true, ...result }))
    .catch((error) => sendResponse({ ok: false, error: error.message || "Unable to generate notes." }));

  return true;
});

async function generateNotes() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab?.id) {
    throw new Error("No active tab found.");
  }

  if (isRestrictedChromeUrl(tab.url)) {
    throw new Error("Chrome does not allow extensions to read this page. Try a regular webpage.");
  }

  const pageText = await extractPageText(tab.id);

  if (!pageText) {
    throw new Error("No readable page content found.");
  }

  const { text, wasTruncated } = truncateWords(pageText, MAX_WORDS);
  const settings = normalizeSettings(await chrome.storage.local.get(DEFAULT_SETTINGS));
  const notes = settings.provider === "ollama"
    ? await callOllama(settings, text)
    : await callOpenAI(settings, text);

  return {
    notes,
    warning: wasTruncated ? `Page content was truncated to about ${MAX_WORDS.toLocaleString()} words before sending.` : ""
  };
}

function normalizeSettings(settings) {
  return {
    ...settings,
    instructionPrompt: settings.instructionPrompt === OLD_DEFAULT_INSTRUCTION
      ? DEFAULT_INSTRUCTION
      : settings.instructionPrompt
  };
}

function isRestrictedChromeUrl(url = "") {
  return /^(chrome|chrome-extension|edge|brave|about):/i.test(url);
}

async function extractPageText(tabId) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content.js"]
    });

    return (results?.[0]?.result || "").trim();
  } catch (error) {
    throw new Error(`Could not extract content from this page: ${error.message}`);
  }
}

function truncateWords(text, maxWords) {
  const words = text.split(/\s+/).filter(Boolean);

  if (words.length <= maxWords) {
    return { text, wasTruncated: false };
  }

  return {
    text: words.slice(0, maxWords).join(" "),
    wasTruncated: true
  };
}

function buildMessages(instructionPrompt, pageText) {
  return [
    { role: "system", content: instructionPrompt },
    { role: "user", content: pageText }
  ];
}

async function callOpenAI(settings, pageText) {
  const apiKey = settings.openaiApiKey?.trim();

  if (!apiKey) {
    throw new Error("Missing OpenAI API key. Add it in Settings.");
  }

  let response;
  try {
    response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: settings.openaiModel || DEFAULT_SETTINGS.openaiModel,
        messages: buildMessages(settings.instructionPrompt, pageText),
        temperature: 0.2
      })
    });
  } catch {
    throw new Error("OpenAI endpoint is unreachable. Check your network connection and try again.");
  }

  const data = await parseJsonResponse(response, "OpenAI");
  const notes = data?.choices?.[0]?.message?.content?.trim() || "";

  if (!notes) {
    throw new Error("OpenAI returned an empty response.");
  }

  return notes;
}

async function callOllama(settings, pageText) {
  const endpoint = settings.ollamaEndpoint || DEFAULT_SETTINGS.ollamaEndpoint;

  let response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: settings.ollamaModel || DEFAULT_SETTINGS.ollamaModel,
        messages: buildMessages(settings.instructionPrompt, pageText),
        stream: false
      })
    });
  } catch {
    throw new Error("Local Ollama endpoint is unreachable. Check that Ollama is running and the endpoint is correct.");
  }

  const data = await parseJsonResponse(response, "Ollama");
  const notes = data?.message?.content?.trim() || data?.response?.trim() || "";

  if (!notes) {
    throw new Error("Ollama returned an empty response.");
  }

  return notes;
}

async function parseJsonResponse(response, providerName) {
  let data = null;

  try {
    data = await response.json();
  } catch {
    throw new Error(`${providerName} returned a non-JSON response.`);
  }

  if (!response.ok) {
    const message = data?.error?.message || data?.message || `${providerName} request failed with HTTP ${response.status}.`;

    if (response.status === 401 || response.status === 403) {
      throw new Error(`${providerName} authentication failed. Check your API key or endpoint access.`);
    }

    if (response.status === 429) {
      throw new Error(`${providerName} rate limit reached. Try again later.`);
    }

    throw new Error(message);
  }

  return data;
}
