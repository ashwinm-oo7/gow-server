const WebSocket = require("ws");
const db = require("../../db");
const { ObjectId } = require("mongodb");

const { default: axios } = require("axios");
const extractOrderId = (message) => {
  const match = message.match(/[a-f\d]{24}/i); // MongoDB ObjectId format
  return match ? match[0] : null;
};
// const fs = require("fs");

// Read content from a text or PDF (converted to text beforehand)
// const contentFromFile = fs.readFileSync("./your-details.txt", "utf8"); // Make sure it's a plain text file

// const messages = [
//   {
//     role: "system",
//     content: contentFromFile,
//   },
// ];

const wss = new WebSocket.Server({ noServer: true });

wss.on("connection", (ws) => {
  console.log("Client connected");
  ws.send("👋 Welcome to Galaxy of Wishes Chatbot!\nHow can I help you today?");
  const pendingTrackRequests = new Map();

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
      lowerText.includes("track  order") ||
      lowerText.includes("order status");

    if (trackingIntent && !emailMatch && !phoneMatch && !orderIdMatch) {
      pendingTrackRequests.set(ws, true);
      return ws.send(
        "🔍 Please provide your Order ID, Email, or Phone Number so I can check the order status for you."
      );
    }
    const isPending = pendingTrackRequests.get(ws);

    // Check for order tracking intent
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

    console.log("Received:", userInput);

    try {
      const aiRes = await axios.post(
        // "https://openrouter.ai/api/v1/chat/completions",
        "http://localhost:11434/api/chat",
        {
          // model: "openai/gpt-3.5-turbo",
          model: "mistral",

          messages: [
            {
              role: "system",
              content: `
              You are a helpful and friendly shopping assistant for * Galaxy of Wishes* — an online store with multiple locations in India.
              Be helpful, informative, and friendly. Provide order tracking only if the order ID is present.
              If you want to track order then text: Track my Order orderIDNumber or Email Or MobileNumber. 
              Here are some important details to remember:
              
              🏪 Store Info:
              - Brand:  Galaxy of Wishes
              - Locations: Mumbai, Pune, Hyderabad, Pratapgarh, Kanpur
              - Contact: 📞 9869904331 | ✉️ support@galaxyofwishes.com
              - Website: https://galaxyofwishes.vercel.app
              
              🚚 Shipping Policy:
              - Orders are delivered within 3–7 business days.
              - Real-time tracking is available via order ID, email, or phone number.
              
              🔁 Return Policy:
              - Returns are accepted within 7 days of delivery.
              - Refunds are processed within 3–5 business days after return approval.
              
              🎁 Products:
              - We sell unique curated gifts, electronics, home decor, fashion, and more.
              - Our catalog is updated frequently with the latest trends.
              
              Locations Of Branches: 📍 We are available at the following locations:\n
              🏙️ Mumbai: https://maps.app.goo.gl/uimHaaLuHBercqGv5\n
              🏙️ Pune: https://maps.app.goo.gl/JuCrf9848e3JjC4R7\n
              🏙️ Hyderabad: https://maps.app.goo.gl/fvFzAnFDq2xzZd2B7\n
              🏙️ Pratapgarh: https://maps.app.goo.gl/SfBChwTuZZNLByDMA\n
              🏙️ Kanpur: https://maps.app.goo.gl/E9LRRgf85oQRgNBE9\n

              Menu: 🔐 Here's how you can login or view your account on *Galaxy of Wishes*:\n\n
            🖥️ **On Desktop**:  
            - Go to the top of the website, beside the right of the search bar.  
            - Hover on the "👤 Profile" menu.  
            - From there:  
              1. **Login** if you're not logged in.  
              2. **My Account** (4th option) to view your details (only after login).  
              3. **History Invoice** (5th option) to view past purchases.  
              4. **Logout** option appears once you're logged in.\n\n
            📱 **On Mobile**:  
            - Click on the ☰ menu at the top right corner.  
            - Tap on "👤 Profile" to find Login or Logout options.\n\n
            🔗 You can also login directly here: [Login Page](https://galaxyofwishes.vercel.app/login)
              there is no Logout Page Link because there is only one way to logout click on Logout Option or another way clear the cookies for browser data 
              History:
              Owner of this  Website: https://galaxyofwishes.vercel.app is Ashwin Maurya from D G Ruparel College Completed MSCIt in 2021 also 5 Years of experience In backend Developer and Recently he working on SabInfotech Company which is ErpSoftware services Provider.
              owner resume link or contact with : https://ashwinmaurya.vercel.app/
              owner Friends : there are many close friends Like Yogesh Krishna Pallavi Jash Jadhav Nitesh Komal Preeti Sahil Kajini they all are from college degree friends from D G Ruparel College Only one friend is Nitesh From Sabinfotech Company yogesh school and college both.
              ownere new Trainee : Archana Upadhay she's from village very smart but lazy she's never give him choclate if owner asked for a choclate she's excuse every time i dont have a money ill give you whenever i got the salary. Sometimes she's is doung great Job Like she's delete all the record of demotrainee database from MSSQL in sabinfotech and rejected infront of  him like she's is not doing this  
              Always answer in a helpful and friendly tone. If the user asks something unrelated to shopping or the brand, you can still try to help like a smart assistant.
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
      const data = aiRes.data;

      if (data.error) {
        console.error("AI Error:", data.error.message);
        ws.send(`🚧 AI Error: ${data.error.message}`);
        return;
      }

      const choices = aiRes?.data?.choices;
      if (!choices || choices.length === 0 || !choices[0].message) {
        throw new Error("Invalid AI response format");
      }

      const botReply = choices[0].message.content.trim();
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
