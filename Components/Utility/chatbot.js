const WebSocket = require("ws");
const db = require("../../db");
const { ObjectId } = require("mongodb");
require("dotenv").config();
const { GoogleGenerativeAI } = require("@google/generative-ai");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const fs = require("fs");
const path = require("path");

const { default: axios } = require("axios");
const extractOrderId = (message) => {
  const match = message.match(/[a-f\d]{24}/i); // MongoDB ObjectId format
  return match ? match[0] : null;
};

const wss = new WebSocket.Server({ noServer: true });
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
You are an ERP software assistant.

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
    const userText = message.toString();
    history.push({ sender: "user", text: userText });

    const prompt = formatPrompt(userText, history);

    try {
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const result = await model.generateContent(prompt);
      const botReply =
        result?.response?.text() || "Sorry, I couldn't understand.";

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
