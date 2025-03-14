const express = require("express");
const router = express.Router();
const db = require("../../db");
const { ObjectId } = require("mongodb");

router.post("/add", async (req, res) => {
  // console.log("CATEGORYs : ");

  try {
    const { categoryName, categoryDescription } = req.body;
    const createdAt = new Date().toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
    });
    const newCategory = {
      categoryName: categoryName, // Map categoryName to name field in Category schema
      categoryDescription: categoryDescription,
      createdAt: createdAt,
    };

    // console.log("CATEGORYssss : ", newCategory);
    const dbInstance = await db.connectDatabase();
    const db1 = await dbInstance.getDb();
    const categoryCollection = db1.collection("category");
    const savedCategory = await categoryCollection.insertOne(newCategory);

    // console.log("CATEGORYs : ", savedCategory);

    res
      .status(201)
      .json({ message: "Category added successfully", category: newCategory });
  } catch (error) {
    console.error("Error adding category:", error);
    res.status(500).json({ message: "Failed to add category" });
  }
});

router.get("/allCategory", async (req, res) => {
  try {
    // Access the MongoDB database instance
    const categoryys = req.body;

    const dbInstance = await db.connectDatabase();
    const db1 = await dbInstance.getDb();
    const categoryCollection = db1.collection("category");

    const categories = await categoryCollection.find().toArray();

    res.status(200).json(categories);
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({ message: "Failed to fetch categories" });
  }
});

// Route to update a category by ID
router.put("/update/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid category ID" });
    }

    const updatedAt = new Date().toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
    });
    const updatedData = req.body;
    updatedData.updatedAt = updatedAt;
    delete updatedData._id;

    if (
      !updatedData.categoryName ||
      typeof updatedData.categoryName !== "string"
    ) {
      return res.status(400).json({ message: "Invalid category name" });
    }

    // console.log(id, "UPDATED", updatedData);

    const dbInstance = await db.connectDatabase();
    const db1 = await dbInstance.getDb();

    // Get the collection where subcategories or categories are stored based on the route
    const collection = db1.collection("category");

    const category = await collection.findOne({ _id: new ObjectId(id) });
    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    const result = await collection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updatedData }
    );
    // console.log("RESULT selected", result);

    if (result.modifiedCount === 1) {
      res.status(200).json({ message: "Category updated successfully" });
    } else {
      res.status(404).json({ message: "Category not found" });
    }
  } catch (error) {
    console.error("Error updating document:", error);
    res.status(500).json({ message: "Failed to update document" });
  }
});

module.exports = router;
