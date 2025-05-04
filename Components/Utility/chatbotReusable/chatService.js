const { ObjectId } = require("mongodb");

async function findOrder({ db, email, phone, orderId }) {
  const orderCollection = db.collection("order");

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
        projection: { orderStatus: 1, orderTimeline: 1 },
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

module.exports = { findOrder, formatOrderStatus };
