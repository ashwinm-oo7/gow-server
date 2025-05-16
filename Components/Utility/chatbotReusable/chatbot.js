const WebSocket = require("ws");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const db = require("../../../db");
const {
  extractData,
  handleOrderTracking,
  handleProductPriceQuery,
  getBrandList,
} = require("./chatService");
const { buildPrompt, getIntent } = require("./aiService");
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
    // Get brand list
    // 🏷️ getBrandList() → All available brands
    cache.brandList = await getBrandList(dbConn);
    // Get trending & category info
    cache.trending = await getTrendingProducts(dbConn);
    cache.categories = await getProductCategories(dbConn);
    // 🧩 getSubcategorySummary() → Grouped subcategories
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

  // Session-specific memory
  const session = {
    userId: "",
    history: [],
    pendingTrackRequests: new Map(),
    priceResponse: "",
  };

  ws.on("message", async (msg) => {
    // const userText = msg.toString().toLowerCase();
    const {
      userId: uid,
      text,
      context = [],
      replyTo = null,
    } = JSON.parse(msg.toString());
    userText = text.toLowerCase();
    userId = uid;
    console.log("userId", userId);
    console.log(`[User ${userId}] → ${text}`);
    if (replyTo) console.log(`↪ Replying to: ${replyTo}`);

    const dbInstance = await db.connectDatabase();
    const dbConn = await dbInstance.getDb();

    // Match intent
    const priceKeywords = ["price", "cost", "how much", "rate", "stock"];
    const isPriceQuery = priceKeywords.some((kw) => userText.includes(kw));
    const { orderId, email, phone, isTracking, wantsBrands } = extractData(
      userText.toLowerCase()
    );
    let priceResponse = "";
    const intent = await getIntent(genAI, userText);

    console.log("🎯 Detected Intent:", intent);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    switch (intent) {
      case "track_order":
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

      case "price_query":
      case "stock_list":
        priceResponse = await handleProductPriceQuery({
          db: dbConn,
          userText,
          ws,
          model,
        });
        if (replyTo) {
          history.push({
            sender: "user",
            text: `↪️ [Replying to]: ${replyTo}`,
          });
        }

        history.push({ sender: "user", text: userText });
        if (priceResponse) {
          const prompt = `Here is the product data:\n${priceResponse}\n\nNow, as an AI assistant, respond to the user with a clear summary —
           for example: 'The highest priced Adidas product is XYZ at ₹amount'. Make the response human-like and complete the sentence.`;

          // const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
          const result = await model.generateContent(prompt);
          const finalText =
            result?.response?.text() || "🤖 Sorry, I didn't get that.";

          history.push({ sender: "bot", text: finalText });
          ws.send(cleanMarkdownLinks(finalText));
          return;
        } else {
          ws.send("❌ Sorry, I couldn't find that product's price.");
          return;
        }
      // break;

      case "brand_list":
        ws.send(`🏷️ Available Brands:\n${cache.brandList.join(", ")}`);
        return;

      case "category_list":
        ws.send(`📦 Categories:\n${cache.categories.join(", ")}`);
        return;

      case "subcategory_list":
        ws.send(`📦 subcategories:\n${cache.subcategories.join(", ")}`);
        return;

      case "trending_products":
        const trendingList = cache.trending.map((p) => p.name).join(", ");
        ws.send(`🔥 Trending Products:\n${trendingList}`);
        return;

      case "general_chat":
      default:
        // Construct history with reply-to if provided
        const extendedHistory = [...history];
        if (replyTo) {
          extendedHistory.push({
            sender: "user",
            text: `↪️ [Replying to]: ${replyTo}`,
          });
        }

        extendedHistory.push({ sender: "user", text: userText });

        const prompt = buildPrompt(
          userText,
          // history,
          extendedHistory,
          cache.brandList,
          cache.trending,
          cache.categories,
          cache.subcategories,
          priceResponse
        );
        // const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent(prompt);
        const botText =
          result?.response?.text() || "🤖 Sorry, I didn't get that.";
        // const shouldStore = [
        //   "price_query",
        //   "stock_list",
        //   "brand_list",
        //   "trending_products",
        //   "track_order",
        // ].includes(intent);
        if (userId) {
          const { intent, shouldStore } = await getIntent(
            genAI,
            userText,
            botText
          );

          if (userId && shouldStore) {
            const latest = await dbConn
              .collection("chat_logs")
              .findOne({ userId }, { sort: { createdAt: -1 } });

            const isDuplicate =
              latest &&
              latest.userMessage === userText &&
              latest.botReply === cleanMarkdownLinks(botText);

            if (!isDuplicate) {
              const chatLog = {
                userId,
                userMessage: userText,
                replyTo: replyTo || null,
                botReply: cleanMarkdownLinks(botText),
                intent,
                createdAt: new Date(),
              };
              try {
                await dbConn.collection("chat_logs").insertOne(chatLog);
                console.log("💾 Stored business-relevant chat in DB.");
              } catch (err) {
                console.error("❌ Failed to save chat log:", err);
              }
            } else {
              console.log("⚠️ Skipped storing duplicate chat.");
            }
          }
        }

        history.push({ sender: "user", text: userText });
        if (replyTo) {
          history.push({
            sender: "user",
            text: `↪️ [Replying to]: ${replyTo}`,
          });
        }

        history.push({ sender: "bot", text: botText });
        ws.send(cleanMarkdownLinks(botText));
        return;
    }

    // const brandList = cache.brandList;
    // const trending = cache.trending;
    // const categories = cache.categories;
    // const responsesub = cache.subcategories;

    // 🔍 handleProductPriceQuery() → Price & stock info
    // let Priceresponse = "";
    // if (isPriceQuery) {
    //   Priceresponse = await handleProductPriceQuery({
    //     db: dbConn,
    //     userText,
    //     ws,
    //   });
    // }
    // console.log("Priceresponse", Priceresponse);

    // history.push({ sender: "user", text: userText });

    // Order ###tracking
    // try {
    //   if (isTracking) {
    //     await handleOrderTracking({
    //       db: dbConn,
    //       ws,
    //       userId,
    //       orderId,
    //       email,
    //       phone,
    //       isTracking,
    //       pendingTrackRequests,
    //     });
    //     return;
    //   }
    //   const prompt = buildPrompt(
    //     userText,
    //     history,
    //     brandList,
    //     trending,
    //     categories,
    //     responsesub,
    //     Priceresponse
    //   );
    //   const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    //   const result = await model.generateContent(prompt);
    //   const botText =
    //     result?.response?.text() || "🤖 Sorry, I didn't get that.";

    //   history.push({ sender: "bot", text: botText });
    //   const cleanReply = cleanMarkdownLinks(botText);

    //   ws.send(cleanReply);
    // } catch (err) {
    //   console.error("🔥 Chat Error:", err);
    //   ws.send("⚠️ Oops! Something went wrong. Please try again.");
    // }
  });

  ws.on("close", () => {
    console.log("Client disconnected");
  });
});

module.exports = wss;
