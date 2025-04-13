const WebSocket = require("ws");
const db = require("../../db");
const { ObjectId } = require("mongodb");

const { default: axios } = require("axios");
const extractOrderId = (message) => {
  const match = message.match(/[a-f\d]{24}/i); // MongoDB ObjectId format
  return match ? match[0] : null;
};

function checkCustomReply(userMessage) {
  const text =
    typeof userMessage === "string" ? userMessage?.toLowerCase() : "";

  const predefinedReplies = [
    {
      keywords: ["contact", "phone", "number", "call", "support", "reach"],
      response:
        "📞 You can contact our support team via call or WhatsApp us at: 9869904331",
    },
    {
      keywords: ["email", "mail", "gmail", "support mail", "help mail"],
      response: "📧 You can reach us at: support@mauryagalaxyofwishes.com",
    },
    {
      keywords: [
        "location",
        "address",
        "where",
        "place",
        "located",
        "map",
        "find",
        "shop",
        "store",
      ],
      response: `📍 We are available at the following locations:\n
    🏙️ Mumbai: https://maps.app.goo.gl/uimHaaLuHBercqGv5\n
    🏙️ Pune: https://maps.app.goo.gl/JuCrf9848e3JjC4R7\n
    🏙️ Hyderabad: https://maps.app.goo.gl/fvFzAnFDq2xzZd2B7\n
    🏙️ Pratapgarh: https://maps.app.goo.gl/SfBChwTuZZNLByDMA\n
    🏙️ Kanpur: https://maps.app.goo.gl/E9LRRgf85oQRgNBE9\n
    Feel free to visit or check us on Google Maps!`,
    },
  ];

  for (const rule of predefinedReplies) {
    for (const keyword of rule.keywords) {
      if (text.toLowerCase().includes(keyword)) {
        return rule.response;
      }
    }
  }

  return null;
}

const wss = new WebSocket.Server({ noServer: true });

wss.on("connection", (ws) => {
  console.log("Client connected");
  ws.send("👋 Welcome to Galaxy of Wishes Chatbot!\nHow can I help you today?");

  ws.on("message", async (message) => {
    const text = message.toString().toLowerCase();
    const userInput = message.toString();
    const lowerText = userInput.toLowerCase();

    console.log("User asked:", text);
    const emailMatch = userInput.match(
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/
    );
    const phoneMatch = userInput.match(/(\+91)?[6-9]\d{9}/); // Indian numbers
    const orderIdMatch = userInput.match(/[a-f\d]{24}/i);
    const trackingIntent =
      lowerText.includes("track my order") ||
      lowerText.includes("order status");

    // Check for order tracking intent
    if (trackingIntent) {
      // if (!orderId) {
      //   return ws.send("❗ Please provide a valid Order ID to track.");
      // }

      try {
        const dbInstance = await db.connectDatabase();
        const db1 = await dbInstance.getDb();
        const orderCollection = db1.collection("order");

        // const order = await orderCollection.findOne(
        //   { _id: new ObjectId(orderId) },
        //   {
        //     projection: {
        //       orderStatus: 1,
        //       orderTimeline: 1,
        //       _id: 0,
        //     },
        //   }
        // );

        // if (!order) {
        //   return ws.send("❌ Sorry, no order found with that ID.");
        // }

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

    const customReply = checkCustomReply(message.toString());

    if (customReply) {
      ws.send(customReply);
      return;
    }

    console.log("Received:", userInput);

    try {
      const aiRes = await axios.post(
        "https://openrouter.ai/api/v1/chat/completions", // or any compatible free API
        {
          model: "openai/gpt-3.5-turbo", // Or any model available
          messages: [
            {
              role: "system",
              content:
                "You are a helpful shopping assistant for  Galaxy of Wishes.",
            },
            { role: "user", content: userInput },
          ],
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );

      const botReply = aiRes.data.choices[0].message.content.trim();
      ws.send(botReply);
    } catch (error) {
      console.error("Chatbot error:", error.message);
      ws.send("🚧 Oops! I couldn't respond at the moment. Try again later.");
    }
  });

  ws.on("close", () => {
    console.log("Client disconnected");
  });
});

module.exports = wss;
