const { ObjectId } = require("mongodb");
const { getProductPriceInfo } = require("./trendingService");

async function handleOrderTracking({
  db,
  ws,
  userId,
  orderId,
  email,
  phone,
  isTracking,
  pendingTrackRequests,
}) {
  const userCollection = db.collection("customer");

  if (!userId) {
    return ws.send(
      "🔐 Please log in to track your orders.\n 🔗 [Login Page](https://galaxyofwishes.vercel.app/login)"
    );
  }

  const loggedInUser = await userCollection.findOne({
    _id: new ObjectId(userId),
  });
  if (!loggedInUser) {
    return ws.send(
      "🔐 Please log in to track your orders.\n 🔗 [Login Page](https://galaxyofwishes.vercel.app/login)"
    );
  }

  if (!orderId && !email && !phone && !userId) {
    pendingTrackRequests.set(ws, true);
    return ws.send("🔍 Please share your Order ID, Email, or Phone Number.");
  }

  const order = await findOrder({ db, orderId, email, phone, userId });
  pendingTrackRequests.delete(ws);
  return ws.send(formatOrderStatus(order));
}
async function findOrder({ db, email, phone, orderId, userId }) {
  const orderCollection = db.collection("order");

  if (userId && !email && !phone && !orderId) {
    const customerCollection = db.collection("customer"); // Assuming 'customers' is your collection
    const customer = await customerCollection.findOne(
      { _id: new ObjectId(userId) },
      { projection: { email: 1 } }
    );

    if (!customer) return null; // userId invalid
    email = customer.email; // override email
  }

  if (orderId) {
    return await orderCollection.findOne(
      { _id: new ObjectId(orderId) },
      { projection: { orderStatus: 1, orderTimeline: 1 } }
    );
  }

  if (email) {
    return await orderCollection.findOne(
      { userEmail: email },
      {
        sort: { createdAt: -1 },
        projection: {
          orderStatus: 1,
          orderTimeline: 1,
          InvoiceNumber: 1,
          deliveryAddress: 1,
          amountPaid: 1,
          totalQuantity: 1,
          paymentMethod: 1,
          products: 1,
        },
      }
    );
  }

  if (phone) {
    return await orderCollection.findOne(
      {
        $or: [
          { phoneNumber: { $regex: phone, $options: "i" } },
          { mobileNumber: { $regex: phone, $options: "i" } },
        ],
      },
      {
        sort: { createdAt: -1 },
        projection: {
          orderStatus: 1,
          orderTimeline: 1,
          InvoiceNumber: 1,
          deliveryAddress: 1,
          amountPaid: 1,
          totalQuantity: 1,
          paymentMethod: 1,
          products: 1,
        },
      }
    );
  }

  return null;
}

function formatOrderStatus(order) {
  if (!order) return "🔍 Sorry, no matching order found.";

  let response = `📦 Order Status: ${order.orderStatus}\n`;

  if (order.InvoiceNumber)
    response += `🧾 Invoice Number: ${order.InvoiceNumber}\n`;
  if (order.amountPaid) response += `💳 Amount Paid: ₹${order.amountPaid}\n`;
  if (order.totalQuantity)
    response += `📦 Total Items: ${order.totalQuantity}\n`;
  if (order.paymentMethod)
    response += `💰 Payment Mode: ${order.paymentMethod}\n`;
  if (order.deliveryAddress)
    response += `🏠 Delivery Address: ${order.deliveryAddress}\n`;

  if (order.products?.length > 0) {
    response += `🛍️ Products Ordered:\n`;
    order.products.forEach((p, i) => {
      response += `  ${i + 1}. ${p.productName || "Unnamed Product"} – Qty: ${
        p.quantity || 1
      }, Price: ₹${p.price || "N/A"}\n`;
    });
  }

  response += `\n📘 Timeline:\n`;
  order.orderTimeline.forEach(({ timestamp, status, note }) => {
    const time = new Date(timestamp).toLocaleString();
    response += `- ${status} (${time}): ${note}\n`;
  });

  return response;
}

async function getBrandList(db) {
  const productCollection = db.collection("product");
  const brands = await productCollection.distinct("brandName");
  return brands || [];
}

async function handleProductPriceQuery({ db, userText, ws, model }) {
  const results = await getProductPriceInfo(db, userText);

  if (!results || results.length === 0) {
    ws.send(
      "😔 Sorry, I couldn't find any products matching that brand or name."
    );
    return "";
  }
  let totalQuantity = 0;
  let allPrices = [];

  const response = results
    .map(({ products, variants }) => {
      let reply = `🛍️ *Product:* ${products?.productName}\n`;
      reply += `🧵 *Brand:* ${products?.brandName}\n`;

      variants.forEach((v) => {
        v.sizes.forEach((size) => {
          reply += `📏 Size: ${size.size} – ₹${size.price} (MRP: ₹${size.mrpPrice})\n`;
          reply += `📦 In Stock: ${size.quantity}\n`;
          totalQuantity += size.quantity;
          allPrices.push({ name: products?.productName, price: size.price });
        });
      });

      reply += `🔗 [View Online](https://galaxyofwishes.vercel.app)\n`;
      return reply;
    })
    .join("\n--------------------\n");

  // ws.send(response);
  const lowest = allPrices.reduce(
    (min, p) => (p.price < min.price ? p : min),
    allPrices[0]
  );
  const highest = allPrices.reduce(
    (max, p) => (p.price > max.price ? p : max),
    allPrices[0]
  );

  const priceResponse = `${response}\n\n📊 Total Quantity: ${totalQuantity}\n💸 Lowest Price: ${lowest.name} – ₹${lowest.price}\n💰 Highest Price: ${highest.name} – ₹${highest.price}`;

  // 👉 Now send this data to Gemini for a more conversational response
  const aiSummary = await runGeminiPrompt(
    `Summarize this product price info for a user:\n${priceResponse}`,
    model
  );

  return aiSummary; // You can also: ws.send(aiSummary);
}
async function runGeminiPrompt(promptText, model) {
  const result = await model.generateContent([promptText]);

  const response = await result.response;
  const text = response.text();

  return text;
}

function extractData(message) {
  return {
    orderId: message.match(/[a-f\d]{24}/i)?.[0] || null,
    email:
      message.match(
        /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/
      )?.[0] || null,
    phone: message.match(/(\+91)?[6-9]\d{9}/)?.[0] || null,
    isTracking: /(track.*order|order status|track|track my order)/i.test(
      message
    ),
    wantsBrands:
      message.includes("brand") || message.includes("available brands"),
    trending:
      message.includes("trending brand") ||
      message.includes("top brands") ||
      message.includes("top product") ||
      message.includes("best seller") ||
      message.includes("what's trending"),
  };
}

module.exports = {
  findOrder,
  formatOrderStatus,
  extractData,
  handleOrderTracking,
  handleProductPriceQuery,
  getBrandList,
};
