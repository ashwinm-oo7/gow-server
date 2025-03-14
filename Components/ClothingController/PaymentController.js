const express = require("express");
const router = express.Router();
const db = require("../../db");
const { ObjectId } = require("mongodb");
const QRCode = require("qrcode");

const AdminupiId = "9702359576@ptsbi";
const name = "ASHISH RAJBALI MAURYA"; // Replace with your name
const note = "Good Service";

router.get("/generate-upi-link", async (req, res) => {
  try {
    const { amount } = req.query;

    // Validate presence of amount
    if (!amount) {
      return res.status(400).json({ error: "Amount is required" });
    }

    // Validate that amount is a positive number
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res
        .status(400)
        .json({ error: "Invalid amount. Amount must be a positive number." });
    }

    // Construct UPI link
    const upiLink = `upi://pay?pa=${encodeURIComponent(
      AdminupiId
    )}&pn=${encodeURIComponent(name)}&am=${encodeURIComponent(
      parsedAmount
    )}&tn=${encodeURIComponent(note)}&cu=INR`;

    // Generate QR code for the UPI payment link
    QRCode.toDataURL(upiLink, (err, qrCodeDataUrl) => {
      if (err) {
        console.error("QR Code generation error:", err);
        return res.status(500).json({ error: "Failed to generate QR code" });
      }

      // Respond with the UPI link and QR code data URL
      res.status(200).json({
        upiLink,
        qrCode: qrCodeDataUrl,
      });
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    res
      .status(500)
      .json({ error: "An unexpected error occurred. Please try again later." });
  }
});
// Route to add payment details
router.post("/add", async (req, res) => {
  try {
    const {
      userEmail,
      deliveryAddress,
      paymentMethod,
      SubTotal,
      amountPaid,
      Tax,
      totalQuantity,
      size,
      name,
      cardNumber,
      cvv,
      expiryDates,
      upiID,
      selectedUPIApp,
      paymentUpdate,
      products,
      mobileNumber,
      transactionId,
    } = req.body;

    // Validate the payment details
    if (!deliveryAddress || !paymentMethod) {
      return res.status(400).json({
        message: "Delivery address & Payment Information is required",
      });
    }
    if (paymentMethod === "CashOnDelivery") {
      if (!paymentUpdate) {
        return res.status(400).json({
          message: "Please select payment status for Cash on Delivery.",
        });
      }
      // You can add additional validations specific to Cash on Delivery here
    }

    const parsedAmountPaid = parseFloat(amountPaid);

    // Get current timestamp
    const createdAt = new Date().toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
    });
    const currentYear = new Date().getFullYear().toString().slice(-2);
    const dbInstance = await db.connectDatabase();
    const db1 = await dbInstance.getDb();
    const paymentCollection = db1.collection("order");

    const maxInvoice = await paymentCollection.findOne(
      {},
      { sort: { InvoiceNumber: -1 }, projection: { _id: 0, InvoiceNumber: 1 } }
    );
    let nextInvoiceNumber = 1;
    if (maxInvoice) {
      nextInvoiceNumber = parseInt(maxInvoice.InvoiceNumber.split("/")[1]) + 1;
    }
    const batch = currentYear.padStart(2, "0"); // Ensure 2 digits for the year
    const invoiceNumber = `${batch}/${nextInvoiceNumber
      .toString()
      .padStart(4, "0")}`; // Format as YY/0001

    // Include common fields in the payment object
    const paymentWithDate = {
      InvoiceNumber: invoiceNumber, // Assign the generated InvoiceNumber
      userEmail,
      deliveryAddress,
      paymentMethod,
      totalQuantity,
      size,
      SubTotal,
      Tax,
      amountPaid: parsedAmountPaid,
      products,
      createdAt,
    };

    if (paymentMethod === "Online") {
      // Handle online payments
      if (selectedUPIApp) {
        // Save selected UPI app
        paymentWithDate.selectedUPIApp = selectedUPIApp;
        paymentWithDate.mobileNumber = mobileNumber;
      } else if (upiID) {
        // Save UPI ID
        paymentWithDate.upiID = upiID;
      } else if (transactionId) {
        paymentWithDate.transactionId = transactionId;
      }

      const result = await paymentCollection.insertOne(paymentWithDate);

      res.status(200).json({
        message: "Payment submitted successfully",
        paymentId: result.insertedId,
      });
    } else if (paymentMethod === "CardPayment") {
      if (!name || !cardNumber || !cvv || !expiryDates) {
        return res.status(400).json({ message: "Incomplete card details" });
      }

      paymentWithDate.name = name;
      paymentWithDate.cardNumber = cardNumber;
      paymentWithDate.cvv = cvv;
      paymentWithDate.cardExpiryDate = expiryDates;

      // Insert payment details into the database
      const result = await paymentCollection.insertOne(paymentWithDate);

      res.status(200).json({
        message: "Payment submitted successfully",
        paymentId: result.insertedId,
      });
    } else if (paymentMethod === "CashOnDelivery") {
      paymentWithDate.paymentStatus = paymentUpdate;

      const result = await paymentCollection.insertOne(paymentWithDate);

      res.status(200).json({
        message: "Payment submitted successfully",
        paymentId: result.insertedId,
      });
    } else {
      return res.status(400).json({ message: "Invalid payment method" });
    }

    const variantCollection = db1.collection("variant");
    const productCollection = db1.collection("product");

    const updateStockPromises = products.map(async (product) => {
      const productId = product.id; // Product ID
      const quantityPurchased = product.quantity; // Quantity purchased
      const selectedColor = product.color; // Selected color
      const selectedSize = product.size; // Selected size

      const updated_at = new Date().toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
      });

      // Find the correct product variant and update the quantity for the selected size
      await variantCollection.updateOne(
        {
          productId: new ObjectId(productId),
          color: selectedColor,
          "sizes.size": selectedSize, // Match the size within the sizes array
        },
        {
          $inc: {
            "sizes.$.quantity": -quantityPurchased,
            "sizes.$.quantityPurchased": quantityPurchased,
          }, // Subtract the purchased quantity
          $set: { updatedAt: updated_at }, // Update the updatedAt field
        }
      );

      await productCollection.updateOne(
        { _id: new ObjectId(productId) },
        {
          $inc: {
            QuantityPurchased: quantityPurchased,
          },
          $set: { UpdateQuantity: updated_at },
        }
      );
    });

    await Promise.all(updateStockPromises);
  } catch (error) {
    console.error("Error submitting payment:", error);
    res.status(500).json({
      message: "Failed to submit payment. Please try again later.",
    });
  }
});

router.get("/getAll", async (req, res) => {
  try {
    const { id } = req.query; // Use "id" query parameter for flexibility
    let query = {}; // Default query to fetch all payment details

    // If "id" is provided, construct a query to filter by the specific OrderID
    if (id) {
      query = { _id: new ObjectId(id) };
    }

    // Access the MongoDB database instance
    const dbInstance = await db.connectDatabase();
    const db1 = await dbInstance.getDb();

    const paymentCollection = db1.collection("order");

    // Fetch payment details based on the constructed query
    const payments = await paymentCollection.find(query).toArray();

    // If no records found and "id" is provided, return 404
    if (id && payments.length === 0) {
      return res.status(404).json({ message: "Payment not found" });
    }

    // Populate product details for each payment (without fetching variants)
    for (let i = 0; i < payments.length; i++) {
      const productIds = payments[i].products.map((product) => product.id);
      const objectIdArray = productIds.map((id) => new ObjectId(id));

      // Fetch products from the database based on the provided IDs
      const productCollection = db1.collection("product");
      const products = await productCollection
        .find({ _id: { $in: objectIdArray } })
        .toArray();

      // Map the product information with the respective order data
      payments[i].products = payments[i].products.map((purchasedProduct) => {
        const productInfo = products.find(
          (prod) => prod._id.toString() === purchasedProduct.id
        );

        // Use the data directly from the order's products array
        return {
          ...productInfo,
          quantityVariant: purchasedProduct.quantity,
          colorVariant: purchasedProduct.color,
          sizeVariant: purchasedProduct.size, // Already provided in the order
          priceVariant: purchasedProduct.price,
          mrpPriceVariant: purchasedProduct.mrpPrice,
        };
      });
    }

    res.status(200).json(id ? payments[0] : payments);
  } catch (error) {
    console.error("Error fetching payment details:", error);
    res.status(500).json({
      message: "Failed to fetch payment details. Please try again later.",
    });
  }
});

router.get("/getInvoice", async (req, res) => {
  try {
    const { userEmail } = req.query;
    let query = {};
    if (userEmail) {
      query = { userEmail: userEmail };
    }

    // Access the MongoDB database instance
    const dbInstance = await db.connectDatabase();
    const db1 = await dbInstance.getDb();

    const paymentCollection = db1.collection("order");

    // Fetch payment details based on the constructed query
    const payments = await paymentCollection.find(query).toArray();

    // If userEmail is provided, populate product details for each payment
    for (let i = 0; i < payments.length; i++) {
      const productIds = payments[i].products.map((product) => product.id);

      // Filter out invalid product IDs that can't be converted to ObjectId
      const validObjectIds = productIds
        .filter((id) => ObjectId.isValid(id)) // Check if the ID is a valid 24-character hex string
        .map((id) => new ObjectId(id));

      // Fetch products from the database based on valid Object IDs
      const productCollection = db1.collection("product");
      const products = await productCollection
        .find({ _id: { $in: validObjectIds } })
        .toArray();

      // Map the product information with the respective order data
      payments[i].products = payments[i].products.map((orderedProduct) => {
        const productInfo = products.find(
          (product) => product._id.toString() === orderedProduct.id
        );

        return {
          ...productInfo,
          quantityVariant: orderedProduct.quantity,
          colorVariant: orderedProduct.color, // Use color from the order data
          sizeVariant: orderedProduct.size, // Use size from the order data
          priceVariant: orderedProduct.price, // Use price from the order data
          mrpPriceVariant: orderedProduct.mrpPrice, // Use MRP price from the order data
        };
      });
    }

    res.status(200).json(payments);
  } catch (error) {
    console.error("Error fetching payment details:", error);
    res.status(500).json({
      message: "Failed to fetch payment details. Please try again later.",
    });
  }
});

module.exports = router;
