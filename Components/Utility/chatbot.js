const WebSocket = require("ws");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const db = require("../../db");
const { ObjectId } = require("mongodb");
const fs = require("fs");
const path = require("path");
require("dotenv").config();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const wss = new WebSocket.Server({ noServer: true });

const { default: axios } = require("axios");

function readSystemPrompt() {
  const filePath = path.join(__dirname, "SystemSetup.md"); // adjust if needed
  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch (err) {
    console.error("Error reading system setup:", err);
    return "";
  }
}

// Format prompt
function formatPrompt(userMessage, history = []) {
  const systemPrompt = readSystemPrompt();
  const formattedHistory = history
    .map(
      (msg) => `${msg.sender === "user" ? "User" : "Assistant"}: ${msg.text}`
    )
    .join("\n");

  return `
You are an Maurya software  for Galaxy of Wishes assistant.

${systemPrompt}

${formattedHistory}

User: ${userMessage}

Now respond with a helpful answer.
  `.trim();
}

wss.on("connection", (ws) => {
  console.log("Client connected");
  ws.send("👋 Welcome to Galaxy of Wishes Chatbot!\nHow can I help you today?");
  const pendingTrackRequests = new Map();
  let history = []; // Optional: maintain conversation state

  ws.on("message", async (message) => {
    const userText = message.toString().toLowerCase();

    history.push({ sender: "user", text: userText });
    const userInput = userText;
    const lowerText = userInput;

    const emailMatch = userInput.match(
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/
    );
    const phoneMatch = userInput.match(/(\+91)?[6-9]\d{9}/); // Indian numbers
    const orderIdMatch = userInput.match(/[a-f\d]{24}/i);
    const trackingIntent =
      lowerText.includes("track my order") ||
      lowerText.includes("track  order") ||
      lowerText.includes("order status");

    if (trackingIntent && !emailMatch && !phoneMatch && !orderIdMatch) {
      pendingTrackRequests.set(ws, true);
      return ws.send(
        "🔍 Please provide your Order ID, Email, or Phone Number so I can check the order status for you."
      );
    }
    const isPending = pendingTrackRequests.get(ws);
    if (isPending || trackingIntent) {
      try {
        const dbInstance = await db.connectDatabase();
        const db1 = await dbInstance.getDb();
        const orderCollection = db1.collection("order");

        let order = null;

        if (orderIdMatch) {
          // Search by Order ID
          order = await orderCollection.findOne(
            { _id: new ObjectId(orderIdMatch[0]) },
            { projection: { orderStatus: 1, orderTimeline: 1 } }
          );
        } else if (emailMatch) {
          // Search latest by email
          order = await orderCollection.findOne(
            { userEmail: emailMatch[0] },
            {
              sort: { createdAt: -1 },
              projection: { orderStatus: 1, orderTimeline: 1 },
            }
          );
        } else if (phoneMatch) {
          // Search latest by phone
          order = await orderCollection.findOne(
            {
              phoneNumber: { $regex: phoneMatch[0], $options: "i" },
            },
            {
              sort: { createdAt: -1 },
              projection: { orderStatus: 1, orderTimeline: 1 },
            }
          );
        }
        pendingTrackRequests.delete(ws);

        if (!order) {
          return ws.send(
            "🔍 Sorry, no matching order found. Please double-check the email, phone number, or Order ID."
          );
        }

        // Format response
        let response = `📦 Your order is currently: **${order.orderStatus}**\n\n📘 Order Timeline:\n`;
        order.orderTimeline.forEach((entry) => {
          const date = new Date(entry.timestamp).toLocaleString();
          response += `- ${entry.status} (${date}): ${entry.note}\n`;
        });

        return ws.send(response);
      } catch (err) {
        console.error("Error tracking order:", err);
        return ws.send("⚠️ Something went wrong while checking your order.");
      }
    }

    const prompt = formatPrompt(userText, history);

    try {
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const result = await model.generateContent(prompt);
      const botReply =
        result?.response?.text() || "Sorry, I couldn't understand.";

      // Optionally extract topic
      // const topicMatch = botReply.match(/TOPIC:\s*(.+)/i);
      // const topic = topicMatch ? topicMatch[1].trim() : "General";
      const cleanedReply = botReply.replace(/\s*(.+)$/i, "").trim();

      history.push({ sender: "bot", text: botReply });

      // Send to client
      ws.send(botReply);
    } catch (err) {
      console.error("Error generating AI response:", err);
      ws.send("Sorry, there was an error processing your request.");
    }
  });

  ws.on("close", () => {
    console.log("Client disconnected");
  });
});

module.exports = wss;
