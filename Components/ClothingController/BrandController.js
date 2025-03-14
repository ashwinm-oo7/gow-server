const express = require("express");
const router = express.Router();
const { ObjectId } = require("mongodb");

const db = require("../../db"); // Import the MongoDB database connection module

router.post("/add", async (req, res) => {
  // console.log("BRANSSS : ");

  try {
    const {
      categoryName,
      subCategoryName,
      clothingCompanyName,
      clothingCompanyDescription,
    } = req.body;
    const createdAt = new Date().toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
    });

    const newBrand = {
      categoryName: categoryName,
      subCategoryName: subCategoryName,
      clothingCompanyName: clothingCompanyName, // Map clothingCompanyName to name field in Category schema
      clothingCompanyDescription: clothingCompanyDescription,
    };
    newBrand.createdAt = createdAt;
    // console.log("BRANDADD : ", newBrand);
    const dbInstance = await db.connectDatabase();
    const db1 = await dbInstance.getDb();
    const brandCollection = db1.collection("brand");
    const savedBrand = await brandCollection.insertOne(newBrand);
    // console.log("CATEGORYs : ", savedBrand);

    res
      .status(201)
      .json({ message: "Category added successfully", brand: newBrand });
  } catch (error) {
    console.error("Error adding category:", error);
    res.status(500).json({ message: "Failed to add category" });
  }
});
router.put("/update/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updatedAt = new Date().toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
    });

    const updatedData = req.body;
    updatedData.updatedAt = updatedAt;
    delete updatedData._id;

    // console.log(id, "UPDATE SUbcategory", updatedData);

    // Connect to the database
    const dbInstance = await db.connectDatabase();
    const db1 = await dbInstance.getDb();

    // Get the collection where categories are stored
    const brandCollection = db1.collection("brand");

    // Update the category document
    const result = await brandCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updatedData }
    );
    // console.log("resukt", result);
    if (result.modifiedCount === 1) {
      res.status(200).json({ message: "brand updated successfully" });
    } else {
      res.status(404).json({ message: "brand not found" });
    }
  } catch (error) {
    console.error("Error updating brand:", error);
    res.status(500).json({ message: "Failed to update brand" });
  }
});

router.get("/allBrand", async (req, res) => {
  try {
    const dbInstance = await db.connectDatabase();
    const db1 = await dbInstance.getDb();

    const brandCollection = db1.collection("brand");
    const allBrand = await brandCollection.find({}).toArray();

    res.status(200).json(allBrand);
  } catch (error) {
    console.error("Error fetching allBrand:", error);
    res.status(500).json({ message: "Failed to fetch allBrand" });
  }
});

router.get(
  "/getClothingCompanyBySubcategoryName/:categoryName/:subCategoryName",
  async (req, res) => {
    try {
      const { categoryName, subCategoryName } = req.params;
      console.log("SUBCATEGORY443433", subCategoryName);

      console.log("categoryName", categoryName);

      const dbInstance = await db.connectDatabase();
      const db1 = await dbInstance.getDb();
      const productCollection = db1.collection("brand");

      // Query all SUBcategories from the database
      const clothingBrand = await productCollection
        .find({ subCategoryName: subCategoryName, categoryName: categoryName })
        .toArray();
      // console.log("BRAND", clothingBrand);

      const clothingCompanyNames = clothingBrand.map(
        (clothingbrand) => clothingbrand.clothingCompanyName
      );
      // console.log("BRAND_NAME:", clothingCompanyNames);

      // Send the retrieved categories as JSON response
      res.status(200).json(clothingBrand);
    } catch (error) {
      console.error("Error fetching categories:", error);
      res.status(500).json({ message: "Failed to fetch categories" });
    }
  }
);

module.exports = router;
