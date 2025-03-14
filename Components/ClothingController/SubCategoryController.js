// routes/subcategory.js
const express = require("express");
const router = express.Router();
const db = require("../../db");
const { ObjectId } = require("mongodb");

// Add a new subcategory
router.post("/add", async (req, res) => {
  //   console.log("CATEGORYs : ");

  try {
    const { categoryName, subCategoryName, subCategoryDescription } = req.body;
    const createdAt = new Date().toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
    });

    const newSubcategory = {
      categoryName: categoryName,
      subCategoryName: subCategoryName,
      subCategoryDescription: subCategoryDescription,
      createdAt: createdAt,
    };
    const dbInstance = await db.connectDatabase();

    const db1 = await dbInstance.getDb();
    const customerCollection = db1.collection("subcategory");
    const savedSubcategory = await customerCollection.insertOne(newSubcategory);
    res.status(201).json(savedSubcategory);
  } catch (error) {
    console.error("Error adding subcategory:", error);
    res.status(500).json({ message: "Failed to add subcategory" });
  }
});

router.get(
  "/getSubcategoriesByCategoryName/:categoryName",
  async (req, res) => {
    // console.log("SUBCATEGORY", req);
    try {
      const { categoryName } = req.params;
      //   console.log("SUBCATEGORY", categoryName);

      const dbInstance = await db.connectDatabase();
      const db1 = await dbInstance.getDb();
      const subcategoryCollection = db1.collection("subcategory");

      // Query all categories from the database
      const subcategories = await subcategoryCollection
        .find({ categoryName })
        .toArray();
      //   console.log("SUBCATEGORY", subcategories);

      const subCategoryNames = await subcategories.map(
        (subcategory) => subcategory.subCategoryName
      );
      //   console.log("SUBCATEGORYss", subCategoryNames);

      // Send the retrieved categories as JSON response
      res.status(200).json(subcategories);
    } catch (error) {
      console.error("Error fetching categories:", error);
      res.status(500).json({ message: "Failed to fetch categories" });
    }
  }
);

router.get("/allSubCategory", async (req, res) => {
  try {
    const dbInstance = await db.connectDatabase();
    const db1 = await dbInstance.getDb();

    const subcategoryCollection = db1.collection("subcategory");
    const allSubcategories = await subcategoryCollection.find({}).toArray();

    res.status(200).json(allSubcategories);
  } catch (error) {
    console.error("Error fetching subcategories:", error);
    res.status(500).json({ message: "Failed to fetch subcategories" });
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
    const categoryCollection = db1.collection("subcategory");

    // Update the category document
    const result = await categoryCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updatedData }
    );
    // console.log("resukt", result);
    if (result.modifiedCount === 1) {
      res.status(200).json({ message: "subCategory updated successfully" });
    } else {
      res.status(404).json({ message: "SubCategory not found" });
    }
  } catch (error) {
    console.error("Error updating category:", error);
    res.status(500).json({ message: "Failed to update category" });
  }
});

router.delete("/delete/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updatedData = req.body; // Get the updated data from the request body
    delete updatedData._id;

    // console.log(id, "DELETEDs", updatedData);

    const dbInstance = await db.connectDatabase();
    const db1 = await dbInstance.getDb();

    const subcategoryCollection = db1.collection("subcategory");

    const result = await subcategoryCollection.deleteOne({
      _id: new ObjectId(id),
    });

    if (result.deletedCount === 1) {
      res.status(200).json({ message: "Subcategory deleted successfully" });
    } else {
      res.status(404).json({ message: "Subcategory not found" });
    }
  } catch (error) {
    console.error("Error deleting subcategory:", error);
    res.status(500).json({ message: "Failed to delete subcategory" });
  }
});

module.exports = router;
