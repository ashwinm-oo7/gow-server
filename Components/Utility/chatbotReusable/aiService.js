const fs = require("fs");
const path = require("path");

function readSystemPrompt() {
  try {
    const filePath = path.join(__dirname, "SystemSetup.md");
    return fs.readFileSync(filePath, "utf-8");
  } catch (err) {
    console.error("⚠️ Error reading system prompt:", err);
    return "";
  }
}

function buildPrompt(
  userMessage,
  history = [],
  brandList,
  trending,
  categories,
  responsesub,
  Priceresponse
) {
  const systemPrompt = readSystemPrompt();

  const categoryText = categories.join(", ");

  const chatHistory = history
    .map((m) => `${m.sender === "user" ? "User" : "Assistant"}: ${m.text}`)
    .join("\n");
  const trendText =
    trending &&
    trending
      .map(
        (p, i) =>
          `${i + 1}. ${p.name} (Brand: ${p.brand}, Category: ${
            p.category
          }) – Sold ${p.totalSold} times`
      )
      .join("\n");
  return `
You are an  chatbot for Galaxy of Wishes.

${systemPrompt}

${chatHistory}
The following brands are currently available in the product catalog:
${brandList}.
Here is a list of the current top trending products based on sales:
${trendText}.
These are the available product categories:
${categoryText}.
These are the available product Subcategories:
${responsesub}.

${Priceresponse ? `💰 Product Pricing Info:\n${Priceresponse}` : ""}


User: ${userMessage}

Respond helpfully and concisely, informatively, listing available brands where relevant.
`.trim();
}

module.exports = { buildPrompt };
