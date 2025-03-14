const express = require("express");
const router = express.Router();
const db = require("../../db");
// Route to add new pincode data
router.post("/add", async (req, res) => {
  try {
    const { Name, mobileNumber, vehicles, pincode } = req.body; // Assuming the request body contains the pincode data

    if (!mobileNumber) {
      return res.status(400).json({ message: "mobileNumber is required" });
    }

    const createdAt = new Date().toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
    });

    const pincodeData = {
      Name: Name,
      mobileNumber: mobileNumber,
      vehicles: vehicles,
      pincode: pincode,
      createdAt: createdAt, // Using native JavaScript Date object
    };

    // Connect to the database
    const dbInstance = await db.connectDatabase();
    const db1 = await dbInstance.getDb();
    const pincodeCollection = db1.collection("demandCoustomer");

    // Insert the new pincode data into the database
    const result = await pincodeCollection.insertOne(pincodeData);

    // Send a success response
    res.status(200).json({
      message: "Pincode data added successfully",
      insertedId: result.insertedId,
    });
  } catch (error) {
    // Handle errors
    console.error("Error adding pincode data:", error);
    res.status(500).json({ message: "Failed to add pincode data" });
  }
});

router.get("/getPincodes", async (req, res) => {
  const p = req.params;
  console.log(p);

  try {
    const dbInstance = await db.connectDatabase();
    const db1 = await dbInstance.getDb();
    const pincodeData = await db1.collection("mumbai");

    const allPincode = await pincodeData.find().toArray();
    res.status(200).json(allPincode);
  } catch (error) {
    console.error("Error fetching pincode data:", error);
    res.status(500).json({ message: "Failed to fetch pincode data" });
  }
});

module.exports = router;
