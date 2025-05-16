const WebSocket = require("ws");
const { ObjectId } = require("mongodb");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const db = require("../../../db");
const {
  extractData,
  handleOrderTracking,
  handleProductPriceQuery,
  getBrandList,
} = require("./chatService");
const { buildPrompt } = require("./aiService");
require("dotenv").config();
const {
  getTrendingProducts,
  getProductCategories,
  getAllSubcategories,
  getSubcategorySummary,
} = require("./trendingService");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const wss = new WebSocket.Server({ noServer: true });

// 🔄 In-memory cache (24hr update)
const cache = {
  brandList: null,
  trending: null,
  categories: null,
  subcategories: null,
};

// ⏰ Refresh cache every 24 hours
const refreshCache = async () => {
  try {
    const dbInstance = await db.connectDatabase();
    const dbConn = await dbInstance.getDb();
    cache.brandList = await getBrandList(dbConn);
    cache.trending = await getTrendingProducts(dbConn);
    cache.categories = await getProductCategories(dbConn);
    cache.subcategories = await getSubcategorySummary(dbConn);
    console.log("✅ Refreshed chatbot cache");
  } catch (err) {
    console.error("❌ Error refreshing chatbot cache:", err);
  }
};
refreshCache(); // initial run
setInterval(refreshCache, 24 * 60 * 60 * 1000); // every 24hr

function cleanMarkdownLinks(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, "$1") // bold
    .replace(/\*(.*?)\*/g, "$1") // italics
    .replace(/`(.*?)`/g, "$1") // inline code
    .replace(/\n+/g, "\n") // clean extra newlines
    .replace(/^- /gm, "") // bullets
    .replace(/^\d+\. /gm, "") // numbered lists
    .trim();
}

wss.on("connection", (ws) => {
  console.log("Client connected");
  ws.send("👋 Welcome to Galaxy of Wishes! How can I assist you today?");
  const pendingTrackRequests = new Map();
  let history = [];
  let userText = "";

  let userId = "";
  ws.on("message", async (msg) => {
    // const userText = msg.toString().toLowerCase();
    const { userId: uid, text } = JSON.parse(msg.toString());
    userText = text.toLowerCase();
    userId = uid;
    console.log("userId", userId);
    const dbInstance = await db.connectDatabase();
    const dbConn = await dbInstance.getDb();

    // Match intent
    const priceKeywords = ["price", "cost", "how much", "rate", "stock"];
    const isPriceQuery = priceKeywords.some((kw) => userText.includes(kw));
    const { orderId, email, phone, isTracking, wantsBrands } = extractData(
      userText.toLowerCase()
    );

    // Get brand list
    // 🏷️ getBrandList() → All available brands
    // const brandList = await getBrandList(dbConn);

    // Get trending & category info
    // const trending = await getTrendingProducts(dbConn);
    // const categories = await getProductCategories(dbConn);

    // 🧩 getSubcategorySummary() → Grouped subcategories
    // const responsesub = await getSubcategorySummary(dbConn);

    const brandList = cache.brandList;
    const trending = cache.trending;
    const categories = cache.categories;
    const responsesub = cache.subcategories;

    // 🔍 handleProductPriceQuery() → Price & stock info
    let Priceresponse = "";
    if (isPriceQuery) {
      Priceresponse = await handleProductPriceQuery({
        db: dbConn,
        userText,
        ws,
      });
    }
    console.log("Priceresponse", Priceresponse);

    history.push({ sender: "user", text: userText });

    // Order tracking
    try {
      // Step: Check if user is authenticated
      // 🧾 handleOrderTracking() → Order status
      if (isTracking) {
        await handleOrderTracking({
          db: dbConn,
          ws,
          userId,
          orderId,
          email,
          phone,
          isTracking,
          pendingTrackRequests,
        });
        return;
      }

      // Gemini AI
      const prompt = buildPrompt(
        userText,
        history,
        brandList,
        trending,
        categories,
        responsesub,
        Priceresponse
      );
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const result = await model.generateContent(prompt);
      const botText =
        result?.response?.text() || "🤖 Sorry, I didn't get that.";

      history.push({ sender: "bot", text: botText });
      const cleanReply = cleanMarkdownLinks(botText);

      ws.send(cleanReply);
    } catch (err) {
      console.error("🔥 Chat Error:", err);
      ws.send("⚠️ Oops! Something went wrong. Please try again.");
    }
  });

  ws.on("close", () => {
    console.log("Client disconnected");
  });
});

module.exports = wss;
