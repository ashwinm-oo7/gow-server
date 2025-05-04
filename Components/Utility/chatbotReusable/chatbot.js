const WebSocket = require("ws");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const db = require("../../../db");
const { findOrder, formatOrderStatus } = require("./chatService");
const { buildPrompt } = require("./aiService");
require("dotenv").config();
const {
  getTrendingProducts,
  getProductCategories,
  getSubcategoriesByCategory,
  getAllSubcategories,
  getProductPriceInfo,
} = require("./trendingService");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const wss = new WebSocket.Server({ noServer: true });
function cleanMarkdownLinks(text) {
  return text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)");
}

const extractData = (message) => ({
  orderId: message.match(/[a-f\d]{24}/i)?.[0] || null,
  email:
    message.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/)?.[0] ||
    null,
  phone: message.match(/(\+91)?[6-9]\d{9}/)?.[0] || null,
  isTracking: /(track.*order|order status)/i.test(message),
  wantsBrands:
    message.includes("brand") || message.includes("available brands"),
  trending:
    message.includes("trending brand") ||
    message.includes("top brands") ||
    message.includes("top product") ||
    message.includes("best seller") ||
    message.includes("what's trending"),
});

wss.on("connection", (ws) => {
  console.log("Client connected");
  ws.send("👋 Welcome to Galaxy of Wishes! How can I assist you today?");
  const pendingTrackRequests = new Map();
  let history = [];

  ws.on("message", async (msg) => {
    const userText = msg.toString().toLowerCase();
    const dbInstance = await db.connectDatabase();
    const dbConn = await dbInstance.getDb();
    const priceKeywords = ["price", "cost", "how much", "rate"];
    const isPriceQuery = priceKeywords.some((kw) => userText.includes(kw));
    let Priceresponse = "";
    if (isPriceQuery) {
      const result = await getProductPriceInfo(dbConn, userText);
      if (result) {
        const { product, variants } = result;
        Priceresponse = `🛍️ Product: ${product.productName}\n`;
        Priceresponse += `🧵 Brand: ${product.brandName}\n`;
        variants.forEach((v, i) => {
          v.sizes.forEach((size) => {
            Priceresponse += `📏 Size: ${size.size} – ₹${size.price} (MRP: ₹${size.mrpPrice})\n`;
            Priceresponse += `📦 In Stock: ${size.quantity}\n`;
          });
        });
        Priceresponse += `🔗 View Online: https://galaxyofwishes.vercel.app\n`;
      }
    }
    const productCollection = dbConn.collection("product");
    const brands = await productCollection.distinct("brandName");
    const brandList = brands.join(", ");
    const trending = await getTrendingProducts(dbConn);
    const categories = await getProductCategories(dbConn);
    const categoryMatch = userText.match(/under (\w+)/i);
    if (categoryMatch) {
      const category = categoryMatch[1];
      const subcats = await getSubcategoriesByCategory(dbConn, category);
    }
    const allSubcats = await getAllSubcategories(dbConn);
    const grouped = allSubcats.reduce((acc, cur) => {
      acc[cur.categoryName] = acc[cur.categoryName] || [];
      acc[cur.categoryName].push(cur.subCategoryName);
      return acc;
    }, {});
    let responsesub = "📁 **Available Subcategories**:\n";
    for (const [cat, subs] of Object.entries(grouped)) {
      responsesub += `- ${cat}: ${subs.join(", ")}\n`;
    }

    const { orderId, email, phone, isTracking, wantsBrands } = extractData(
      userText.toLowerCase()
    );

    history.push({ sender: "user", text: userText });

    try {
      if (isTracking && !orderId && !email && !phone) {
        pendingTrackRequests.set(ws, true);
        return ws.send(
          "🔍 Please share your Order ID, Email, or Phone Number."
        );
      }

      if (isTracking || pendingTrackRequests.get(ws)) {
        const order = await findOrder({ db: dbConn, orderId, email, phone });

        pendingTrackRequests.delete(ws);
        return ws.send(formatOrderStatus(order));
      }

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
