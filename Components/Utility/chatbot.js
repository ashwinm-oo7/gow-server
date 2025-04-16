const WebSocket = require("ws");
const db = require("../../db");
const { ObjectId } = require("mongodb");
const { default: axios } = require("axios");

const wss = new WebSocket.Server({ noServer: true });

const extractOrderId = (message) => {
  const match = message.match(/[a-f\d]{24}/i); // MongoDB ObjectId format
  return match ? match[0] : null;
};

wss.on("connection", (ws) => {
  console.log("Client connected");
  ws.send("👋 Welcome to Galaxy of Wishes Chatbot!\nHow can I help you today?");
  const pendingTrackRequests = new Map();

  ws.on("message", async (message) => {
    const text = message.toString().toLowerCase();
    const userInput = message.toString();
    const lowerText = userInput.toLowerCase();

    console.log("User asked:", text);
    const emailMatch = userInput.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
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
          order = await orderCollection.findOne(
            { _id: new ObjectId(orderIdMatch[0]) },
            { projection: { orderStatus: 1, orderTimeline: 1 } }
          );
        } else if (emailMatch) {
          order = await orderCollection.findOne(
            { userEmail: emailMatch[0] },
            {
              sort: { createdAt: -1 },
              projection: { orderStatus: 1, orderTimeline: 1 },
            }
          );
        } else if (phoneMatch) {
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
          return ws.send("🔍 Sorry, no matching order found. Please double-check the email, phone number, or Order ID.");
        }

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

    // General Assistant - OpenRouter AI
    try {
      const aiRes = await axios.post(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          model: "openai/gpt-3.5-turbo",
          messages: [
            {
              role: "system",
              content: `
You are a helpful and friendly shopping assistant for *Galaxy of Wishes* — an online store with multiple locations in India.
Provide order tracking only if order ID, email, or phone number is present. Be friendly, informative, and responsive.

🏪 **Store Info**
- Brand: Galaxy of Wishes
- Locations: Mumbai, Pune, Hyderabad, Pratapgarh, Kanpur
- Contact: 📞 9869904331 | ✉️ support@galaxyofwishes.com
- Website: https://galaxyofwishes.vercel.app

🚚 **Shipping Policy**
- Delivered in 3–7 business days.
- Real-time tracking via Order ID, Email, or Phone.

🔁 **Return Policy**
- Returns accepted within 7 days of delivery.
- Refunds within 3–5 business days after approval.

🎁 **Products**
- Unique curated gifts, electronics, fashion, decor, etc.

📍 **Branches**
- Mumbai: https://maps.app.goo.gl/uimHaaLuHBercqGv5
- Pune: https://maps.app.goo.gl/JuCrf9848e3JjC4R7
- Hyderabad: https://maps.app.goo.gl/fvFzAnFDq2xzZd2B7
- Pratapgarh: https://maps.app.goo.gl/SfBChwTuZZNLByDMA
- Kanpur: https://maps.app.goo.gl/E9LRRgf85oQRgNBE9

🔐 **Login Instructions**
🖥️ Desktop:
- Hover on "👤 Profile" at top right.
- Use **Login**, **My Account**, or **History Invoice** options.

📱 Mobile:
- Open ☰ menu > Tap on 👤 Profile > Login or Logout.

🔗 Direct Login: https://galaxyofwishes.vercel.app/login

🧑‍💻 Owner: Ashwin Maurya – MSc IT from D G Ruparel College, Backend Dev with 5+ years of experience, currently at SabInfotech.
Resume: https://ashwinmaurya.vercel.app

👫 Owner's Friends: Yogesh, Krishna, Pallavi, Jash, Jadhav, Nitesh (from SabInfotech), Komal, Preeti, Sahil, Kajini (all from college)

🎓 Trainee: Archana Upadhyay – smart but lazy, known for a database delete mistake 😅.

Always be helpful and if the question is not shopping-related, still try to assist like a smart assistant.
              `.trim(),
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

      const botReply = aiRes.data.choices?.[0]?.message?.content || "🤖 I'm here to assist you!";
      ws.send(botReply);
    } catch (err) {
      console.error("AI assistant error:", err);
      ws.send("⚠️ Sorry, I couldn’t process that. Please try again.");
    }
  });
});

module.exports = wss;
