const fs = require("fs");
const path = require("path");
const {
  getAllProjectFiles,
  getRecentFiles,
  trimCode,
  loadProjectFiles,
  findProjectRoot,
} = require("../../../loadProjectFiles");

async function getFilesBasedOnUserId(userId) {
  const dbInstance = await db.connectDatabase();
  const db1 = await dbInstance.getDb();
  const customerCollection = db1.collection("customer");

  const user = await customerCollection.findOne({ _id: userId });
  const isAdmin = user?._isAdmin === true;

  const projectRoot = findProjectRoot();

  // Set admin-only files here
  const extraAllowedFiles = isAdmin ? ["ProductController.js"] : [];

  const allFiles = loadProjectFiles(
    projectRoot,
    [".js", ".json"],
    extraAllowedFiles
  );
  const recentFiles = getRecentFiles(allFiles, 5);

  return recentFiles; // or send in prompt, etc.
}

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
  let debugCodeText = "";
  if (userMessage.toLowerCase().includes("debugfilecheck")) {
    const allFiles = getAllProjectFiles();
    debugCodeText = `🧠 Debug Info from Recent Files:\n\n${getRecentFiles(
      allFiles
    )}`;
  }
  return `
You are an  chatbot for Galaxy of Wishes.

${systemPrompt}

=== Chat History ===
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

=== User Command ===
User: ${userMessage}

=== Full Project Codebase (trimmed if needed) ===
${debugCodeText}

Respond helpfully and concisely, informatively, listing available brands where relevant.
- Use the context of this project's code to answer questions, fix bugs, or explain code.
- Suggest improvements in code structure, optimization, or missing pieces where appropriate.
`.trim();
}

async function getIntent(genAI, userText, botReply = "") {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  const prompt = `
  You are an AI that helps classify user queries and determine their business importance.

You are an AI assistant that classifies user queries into one of the following intents:
- track_order
- price_query
- brand_list
- category_list
- trending_products
- subcategory_list
- stock_list
- general_chat

Then decide if this message should be stored for business purposes like product interest, order info, price checking, etc. Respond strictly in this format:

intent: <one of the above>
store: <yes or no>
User message:
"${userText}"

Bot reply (if any):
"${botReply}"

Return only the intent in lowercase. Here is the user query:
"${userText}"
`;
  const result = await model.generateContent(prompt);
  // const intent = result?.response?.text()?.trim().toLowerCase();
  const text = result?.response?.text()?.toLowerCase();

  let intent = "general_chat";
  let store = false;

  if (text) {
    const intentMatch = text.match(/intent:\s*(\w+)/);
    const storeMatch = text.match(/store:\s*(yes|no)/);

    if (intentMatch) intent = intentMatch[1];
    if (storeMatch) store = storeMatch[1] === "yes";
  }

  return { intent, shouldStore: store };
}

module.exports = { buildPrompt, getIntent };
