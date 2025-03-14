const express = require("express");
const router = express.Router();
const db = require("../../db");
const { ObjectId } = require("mongodb");

router.delete("/deleteFeedback/:id", async (req, res) => {
  try {
    const feedbackId = req.params.id;

    // Validate feedbackId
    if (!ObjectId.isValid(feedbackId)) {
      return res.status(400).json({ message: "Invalid feedback ID" });
    }

    const dbInstance = await db.connectDatabase();
    const db1 = await dbInstance.getDb();
    const feedbackCollection = db1.collection("feedback");

    // Delete the feedback by ID
    const result = await feedbackCollection.findOneAndDelete({
      _id: new ObjectId(feedbackId),
    });

    // Check if the deletion was successful
    if (result) {
      return res.status(200).json({ message: "Feedback deleted successfully" });
    } else {
      return res.status(404).json({ message: "Feedback not found" });
    }
  } catch (error) {
    console.error("Error deleting feedback:", error);
    res.status(500).json({ message: "Failed to delete feedback" });
  }
});

// Route to get all categories
router.post("/addFeedback", async (req, res) => {
  try {
    const { feedback, userEmail } = req.body;

    // Validate the feedback (e.g., check if it's not empty)
    if (!feedback && !userEmail) {
      return res
        .status(400)
        .json({ message: "Feedback & userEmail is required" });
    }

    const createdAt = new Date().toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
    });

    // Include createdAt field in the object to be inserted
    const feedbackWithDate = {
      feedback: feedback,
      userEmail: userEmail || null,
      createdAt: createdAt, // Using native JavaScript Date object
    };

    // Access the MongoDB database instance
    const dbInstance = await db.connectDatabase();
    const db1 = await dbInstance.getDb();
    const feedbackCollection = db1.collection("feedback");

    // Insert the feedback into the database
    const result = await feedbackCollection.insertOne(feedbackWithDate);

    res.status(201).json({
      message: "Feedback submitted successfully",
      feedbackId: result.insertedId,
    });
  } catch (error) {
    console.error("Error submitting feedback:", error);
    res
      .status(500)
      .json({ message: "Failed to submit feedback. Please try again later." });
  }
});

router.get("/getAllFeedback", async (req, res) => {
  try {
    const isAdmin = req.query.admin === "true";
    // const userEmail = req.query.userEmail;

    const dbInstance = await db.connectDatabase();
    const db1 = await dbInstance.getDb();
    const feedbackCollection = db1.collection("feedback");

    let feedbackList;
    if (isAdmin) {
      feedbackList = await feedbackCollection.find().toArray();
      feedbackList = feedbackList.map((feedback) => ({
        ...feedback,
        userEmail: feedback.userEmail,
      }));
    } else {
      const userEmail = req.user.userEmail;
      feedbackList = await feedbackCollection
        .find({ email: userEmail })
        .toArray();
    }

    // console.log(feedbackList);

    res.status(200).json(feedbackList);
  } catch (error) {
    console.error("Error fetching feedback:", error);
    res.status(500).json({ message: "Failed to fetch feedback" });
  }
});

module.exports = router;
