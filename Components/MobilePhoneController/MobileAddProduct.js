const express = require("express");
const router = express.Router();
const { saveBase64Image } = require("../Utility/FileUtility");
const db = require("../../db");
const { ObjectId } = require("mongodb");

router.post("/addProduct", async (req, res) => {
  try {
    // Ensure the body is parsed as form data
    const {
      name,
      color,
      price,
      mrpPrice,
      quantity,
      ram,
      rom,
      battery,
      description,
      image,
    } = req.body;
    console.log("hello", req.body);

    if (!name || !price || !quantity || !image) {
      return res.status(400).json({ message: "Missing required fields" });
    }
    // Process and save the image
    let imageFilePath = null;
    if (image) {
      const { fileName, dataURL } = image;
      const lastDotIndex = fileName.lastIndexOf(".");
      const fileNameWithoutExtension = fileName.slice(0, lastDotIndex);
      const fileExtension = fileName.slice(lastDotIndex + 1);
      imageFilePath = saveBase64Image(
        dataURL,
        name,
        fileNameWithoutExtension + "." + fileExtension
      );
    }

    // Prepare product details
    const newProduct = {
      name,
      color,
      price,
      mrpPrice,
      quantity,
      ram,
      rom,
      battery,
      description,
      image: imageFilePath,
    };

    // Connect to the database and insert the product
    const dbInstance = await db.connectDatabase();
    const db1 = await dbInstance.getDb();
    const productCollection = db1.collection("mobileProductData");
    const savedProduct = await productCollection.insertOne(newProduct);

    res
      .status(201)
      .json({ message: "Product added successfully", product: newProduct });
  } catch (error) {
    console.error("Error details:", error.response?.data);
    toast.error(
      `Error adding product: ${
        error.response?.data?.message || "Please try again."
      }`
    );
    res.status(500).json({ message: "Failed to add product" });
  }
});

module.exports = router;
