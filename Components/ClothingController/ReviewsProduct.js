const express = require("express");
const router = express.Router();
const db = require("../../db");
const { ObjectId } = require("mongodb");
const {
  getBase64Image,
  saveBase64Image,
  saveBase64Video,
  getBase64Video,
  show,
} = require("../Utility/FileUtilityCloudStorage");
const { console } = require("inspector");
const { getCache, setCache } = require("../Utility/cache");

const allowedImageFormats = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
];
const allowedVideoFormats = ["video/mp4", "video/webm", "video/ogg"];

router.post("/reviews", async (req, res) => {
  try {
    const { productId, rating, userEmail, comment, images } = req.body;
    const dbInstance = await db.connectDatabase();
    const db1 = await dbInstance.getDb();
    console.log("productId", productId, "Rating", rating, "Comment", comment);
    if (!ObjectId.isValid(productId)) {
      return res.status(400).json({ message: "Invalid product ID" });
    }
    const productCollection = db1.collection("product");
    const orderCollection = db1.collection("order");
    const product = await productCollection.findOne({
      _id: new ObjectId(productId),
    });
    if (!product) {
      return res.status(201).json({ message: "product not found" });
    }

    // Add userEmail condition if provided
    const orders = await orderCollection
      .find({
        userEmail,
        products: { $elemMatch: { id: productId } }, // Check if productId exists in products array
      })
      .toArray();

    if (orders.length === 0 || !orders) {
      return res.status(203).json({ message: "orders not found from your id" });
    }
    if (images) {
      for (const image of images) {
        if (image.type === "application/pdf") {
          console.log("Encountered PDF. Exiting product addition.", image.type);
          return res
            .status(400)
            .json({ message: "PDF images are not allowed" });
        }
      }
    }
    for (let media of images) {
      const { fileName, dataURL, type } = media;
      const fileExtension = fileName.split(".").pop().toLowerCase();
      const fileNameWithoutExtension = fileName.replace(/\.[^/.]+$/, "");

      if (allowedImageFormats.includes(type)) {
        media.filePath = saveBase64Image(
          dataURL,
          fileNameWithoutExtension,
          fileExtension
        );
      } else if (allowedVideoFormats.includes(type)) {
        media.filePath = saveBase64Video(
          dataURL,
          fileNameWithoutExtension,
          fileExtension
        );
      } else {
        return res
          .status(400)
          .json({ message: `Unsupported file type: ${fileName} ${type}` });
      }

      // Reset base64 string to null to reduce payload size
      media.dataURL = null;
      media.size = String(media.size);
      media.status = 1;
    }

    const reviewCollection = db1.collection("reviews");

    const newReview = {
      productId: new ObjectId(productId),
      userEmail,
      rating: parseInt(rating),
      comment: comment || "",
      reviewImages: images,
      createdAt: new Date().toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
      }),
      isApproved: false,
    };

    const savedReview = await reviewCollection.insertOne(newReview);

    // Update the average rating of the product

    if (product) {
      const totalReviews = await reviewCollection
        .find({ productId: new ObjectId(productId) })
        .toArray();

      const averageRating =
        totalReviews.reduce((sum, review) => sum + review.rating, 0) /
        totalReviews.length;

      await productCollection.updateOne(
        { _id: new ObjectId(productId) },
        { $set: { averageRating: averageRating.toFixed(2) } }
      );
    }

    res
      .status(201)
      .json({ message: "Review added successfully", review: newReview });
  } catch (error) {
    console.error("Error adding review:", error);
    res.status(500).json({ message: "Failed to add review" });
  }
});

router.get("/getReviews", async (req, res) => {
  try {
    const { productId, userEmail } = req.query;

    // Validate productId
    if (!ObjectId.isValid(productId)) {
      return res.status(400).json({ message: "Invalid product ID" });
    }
    if (!userEmail) {
      return res.status(203).json({ message: "please login" });
    }

    const dbInstance = await db.connectDatabase();
    const db1 = await dbInstance.getDb();
    const reviewCollection = db1.collection("reviews");

    // Build the query object
    const query = {
      productId: new ObjectId(productId),
    };

    // Add userEmail condition if provided
    if (userEmail) {
      query.userEmail = userEmail;
    }
    // Fetch reviews based on the query
    const reviews = await reviewCollection.find(query).toArray();
    console.log("Getreview", reviews);

    // If no reviews found, return an empty array
    if (!reviews.length) {
      return res.status(200).json([]);
    }

    const reviewsDetails = await Promise.all(
      reviews.map(async (product) => {
        const productWithMedia = {
          ...product,
          reviewImages: await Promise.all(
            (product.reviewImages || []).map(async (media) => {
              try {
                if (allowedImageFormats.includes(media.type)) {
                  return {
                    ...media,
                    dataURL: await getBase64Image(media.filePath), // Use image handler
                  };
                } else if (allowedVideoFormats.includes(media.type)) {
                  return {
                    ...media,
                    dataURL: await getBase64Video(media.filePath), // Use video handler
                  };
                } else {
                  return media; // Return unchanged if format is not allowed
                }
              } catch (error) {
                console.error(`Error processing media: ${error.message}`);
                return {
                  ...media,
                  dataURL: null, // Set null in case of error
                };
              }
            })
          ),
        };

        return productWithMedia;
      })
    );
    res.status(200).json(reviewsDetails);
  } catch (error) {
    console.error("Error fetching product reviews:", error);
    res.status(500).json({ message: "Failed to fetch product reviews" });
  }
});

router.delete("/deleteReviews", async (req, res) => {
  try {
    const { productId, userEmail } = req.query;

    // Validate productId
    if (!ObjectId.isValid(productId)) {
      return res.status(400).json({ message: "Invalid product ID" });
    }

    if (!userEmail) {
      return res.status(400).json({ message: "User email is required" });
    }

    const dbInstance = await db.connectDatabase();
    const db1 = await dbInstance.getDb();
    const reviewCollection = db1.collection("reviews");

    // Find review by productId and userEmail
    const review = await reviewCollection.findOne({
      productId: new ObjectId(productId),
      userEmail: userEmail,
    });
    console.log(review);
    // If no review found, return a 404 error
    if (!review) {
      return res.status(404).json({ message: "Review not found" });
    }

    // Delete the review if found
    const deleteResult = await reviewCollection.deleteOne({
      _id: review._id,
    });

    if (deleteResult.deletedCount === 1) {
      // Recalculate the product's average rating after deletion
      const totalReviews = await reviewCollection
        .find({ productId: new ObjectId(productId) })
        .toArray();

      const averageRating =
        totalReviews.length > 0
          ? (
              totalReviews.reduce((sum, review) => sum + review.rating, 0) /
              totalReviews.length
            ).toFixed(2)
          : null;

      const productCollection = db1.collection("product");
      await productCollection.updateOne(
        { _id: new ObjectId(productId) },
        { $set: { averageRating: averageRating } }
      );

      return res.status(200).json({ message: "Review deleted successfully." });
    } else {
      return res.status(500).json({ message: "Failed to delete review." });
    }
  } catch (error) {
    console.error("Error deleting review:", error);
    res.status(500).json({ message: "Server error. Could not delete review." });
  }
});

router.put("/updateReviews", async (req, res) => {
  console.log("Request body:", req.body); // Check the received data

  try {
    const { productId, userEmail, rating, comment, images } = req.body;
    const productObjectId = new ObjectId(productId);
    console.log("productObjectId :", productObjectId); // Check the received data

    if (!ObjectId.isValid(productId)) {
      return res.status(400).json({ message: "Invalid product ID" });
    }

    if (!userEmail || !rating) {
      return res
        .status(400)
        .json({ message: "User email and rating are required" });
    }

    const reviewImages =
      images &&
      (await Promise.all(
        images.map(async (media) => {
          const { fileName, dataURL, type } = media;
          const fileExtension = fileName.split(".").pop();
          const fileNameWithoutExtension = fileName.replace(/\.[^/.]+$/, "");

          if (allowedImageFormats.includes(type)) {
            const filePath = await saveBase64Image(
              dataURL,
              fileNameWithoutExtension,
              fileExtension
            );
            return {
              ...media,
              filePath,
              dataURL: null,
              size: String(media.size),
              status: 1,
            };
          } else if (allowedVideoFormats.includes(type)) {
            const filePath = await saveBase64Video(
              dataURL,
              fileNameWithoutExtension,
              fileExtension
            );
            return {
              ...media,
              filePath,
              dataURL: null,
              size: String(media.size),
              status: 1,
            };
          } else {
            throw new Error(`Unsupported file type: ${fileName} ${type}`);
          }
        })
      ));

    const dbInstance = await db.connectDatabase();
    const db1 = await dbInstance.getDb();
    const reviewCollection = db1.collection("reviews");

    // Find the review by productId and userEmail
    const existingReview = await reviewCollection.findOne({
      productId: productObjectId,
      userEmail,
    });

    if (!existingReview) {
      console.log("Review not found", existingReview); // Log if no review found
      return res.status(404).json({ message: "Review not found" });
    }

    if (
      existingReview.rating === parseInt(rating) &&
      existingReview.comment === comment &&
      existingReview.reviewImages === reviewImages
    ) {
      console.log("Same rating, no update needed");
      return res.status(200).json({ message: "Same rating, no update needed" });
    }
    // Update the review's ratin
    const updatedReview = await reviewCollection.updateOne(
      { _id: existingReview._id },
      {
        $set: {
          rating: parseInt(rating),
          comment: comment || "",
          reviewImages: reviewImages || existingReview.reviewImages,
          isApproved: false,
        },
      }
    );

    if (updatedReview.modifiedCount === 0) {
      console.log("No changes made to the review", updatedReview); // Log if no changes were made
      return res.status(200).json({ message: "Failed to update review" });
    }

    // Recalculate the average rating of the product
    const totalReviews = await reviewCollection
      .find({ productId: new ObjectId(productId) })
      .toArray();

    const averageRating =
      totalReviews.reduce((sum, review) => sum + review.rating, 0) /
      totalReviews.length;

    const productCollection = db1.collection("product");
    const updatedProduct = await productCollection.updateOne(
      { _id: new ObjectId(productId) },
      { $set: { averageRating: averageRating.toFixed(2) } }
    );
    if (updatedProduct.modifiedCount === 0) {
      console.log("Failed to update product average rating");
      return res
        .status(200)
        .json({ message: "Failed to update product average rating" });
    }

    res.status(200).json({ message: "Review updated successfully" });
  } catch (error) {
    console.error("Error updating review:", error);
    res.status(500).json({ message: "Failed to update review" });
  }
});

router.get("/getAllReviews", async (req, res) => {
  const isAdmin = req.query.isAdmin === "true";
  const { productId } = req.query;
  const query = isAdmin
    ? {}
    : { isApproved: true, productId: new ObjectId(productId) };

  const getAllReviewsAdmin = isAdmin;
  const getAllReviewsProductId = productId;
  const cacheKey = `reviews:${isAdmin}:${productId}`;
  // First check if the reviews are already cached
  const queryCacheKey = JSON.stringify(cacheKey);
  // const cachedReviews = getCache(queryCacheKey);

  // Debugging: Check if cached data is found
  // if (cachedReviews) {
  //   console.log("Cache hit: Reviews retrieved from cache", cachedReviews);
  //   return res.status(200).json(cachedReviews);
  // }

  try {
    const dbInstance = await db.connectDatabase();
    const db1 = await dbInstance.getDb();
    const reviewCollection = db1.collection("reviews");

    // Fetch reviews for the specific user
    const userReviews = await reviewCollection.find(query).toArray();
    console.log("Getreview2", reviewCollection);

    // If no reviews found, return an empty array
    if (!userReviews.length) {
      return res.status(200).json([]);
    }
    userReviews.forEach(async (review) => {
      if (
        Array.isArray(review.reviewImages) &&
        review.reviewImages.length > 0
      ) {
        review.reviewImages = await Promise.all(
          review.reviewImages.map(async (media) => {
            if (allowedImageFormats.includes(media.type)) {
              return {
                ...media,
                dataURL: await getBase64Image(media.filePath),
              };
            } else if (allowedVideoFormats.includes(media.type)) {
              return {
                ...media,
                dataURL: await getBase64Video(media.filePath),
              };
            } else {
              return media; // Return media unchanged if type is not allowed
            }
          })
        );
      } else {
        review.reviewImages = [];
      }
    });

    const processedReviews = await Promise.all(
      userReviews.map(async (review) => {
        if (
          Array.isArray(review.reviewImages) &&
          review.reviewImages.length > 0
        ) {
          review.reviewImages = await Promise.all(
            review.reviewImages.map(async (media) => {
              try {
                if (allowedImageFormats.includes(media.type)) {
                  return {
                    ...media,
                    dataURL: await getBase64Image(media.filePath),
                  };
                } else if (allowedVideoFormats.includes(media.type)) {
                  return {
                    ...media,
                    dataURL: await getBase64Video(media.filePath),
                  };
                } else {
                  return media; // Return unchanged for unsupported formats
                }
              } catch (error) {
                console.error(`Error processing media: ${error.message}`);
                return {
                  ...media,
                  dataURL: null, // Set null in case of error
                };
              }
            })
          );
        } else {
          review.reviewImages = []; // Default to an empty array
        }
        return review;
      })
    );

    // setCache(queryCacheKey, processedReviews);

    res.status(200).json(userReviews);
  } catch (error) {
    console.error("Error fetching user reviews:", error);
    res.status(500).json({ message: "Failed to fetch user reviews" });
  }
});

router.get("/getProductAverageRatings", async (req, res) => {
  try {
    const dbInstance = await db.connectDatabase();
    const db1 = await dbInstance.getDb();
    const reviewCollection = db1.collection("reviews");
    const productCollection = db1.collection("product");

    const { productId } = req.query;

    // If a specific productId is provided, fetch only that product's ratings
    if (productId) {
      // Convert the productId string to an ObjectId for MongoDB queries
      const objectId = new ObjectId(productId);

      // Find the specific product
      const product = await productCollection.findOne({ _id: objectId });

      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }

      // Calculate the average rating and review count for the specific product
      const totalReviews = await reviewCollection
        .find({ productId: objectId, isApproved: true })
        .toArray();

      if (totalReviews.length > 0) {
        const averageRating =
          totalReviews.reduce((sum, review) => sum + review.rating, 0) /
          totalReviews.length;

        return res.status(200).json({
          [productId]: {
            averageRating: averageRating.toFixed(2),
            reviewCount: totalReviews.length, // Number of reviews
          },
        });
      } else {
        return res.status(200).json({
          [productId]: {
            averageRating: null,
            reviewCount: 0, // No reviews for the product
          },
        });
      }
    }

    // If no productId is provided, fetch all products and their ratings
    const products = await productCollection.find({}).toArray();

    if (!products || products.length === 0) {
      return res.status(404).json({ message: "No products found" });
    }

    const productIds = products.map((product) => product._id);

    const reviewsAggregate = await reviewCollection
      .aggregate([
        {
          $match: { productId: { $in: productIds } }, // Match only the relevant product IDs
        },
        {
          $group: {
            _id: "$productId",
            averageRating: { $avg: "$rating" }, // Calculate average rating
            reviewCount: { $sum: 1 }, // Count the number of reviews
          },
        },
      ])
      .toArray();

    const productRatings = {};

    reviewsAggregate.forEach((review) => {
      productRatings[review._id.toString()] = {
        averageRating: review.averageRating.toFixed(2),
        reviewCount: review.reviewCount,
      };
    });

    // Set products with no reviews to null for averageRating and 0 for reviewCount
    products.forEach((product) => {
      if (!productRatings[product._id.toString()]) {
        productRatings[product._id.toString()] = {
          averageRating: null,
          reviewCount: 0,
        };
      }
    });

    console.log(productRatings);

    res.status(200).json(productRatings);
  } catch (error) {
    console.error("Error fetching product average ratings:", error);
    res
      .status(500)
      .json({ message: "Failed to fetch product average ratings" });
  }
});

router.put("/reviewApprovalStatus/:reviewId", async (req, res) => {
  const { reviewId } = req.params;
  const { isApproved, version } = req.body;
  const { productId } = req.query;
  const isAdmin = true;
  if (!ObjectId.isValid(reviewId)) {
    return res.status(400).json({ message: "Invalid review ID" });
  }

  if (typeof isApproved !== "boolean") {
    return res
      .status(400)
      .json({ message: "isApproved must be a boolean value." });
  }

  try {
    const dbInstance = await db.connectDatabase();
    const db1 = await dbInstance.getDb();
    const reviewCollection = db1.collection("reviews");
    const review = await reviewCollection.findOne({
      _id: new ObjectId(reviewId),
    });

    if (!review) {
      return res.status(404).send("Review not found.");
    }
    if (review.version !== version) {
      return res.status(409).json({
        message: "Conflict: Review has already been modified by another admin.",
        isApproved: review.isApproved,
      });
    }
    // Update the approval status of the product
    const updatedReview = await reviewCollection.updateOne(
      { _id: new ObjectId(reviewId), version },
      { $set: { isApproved }, $inc: { version: 1 } }
    );

    if (updatedReview.modifiedCount === 1) {
      const cacheKey = `reviews:${isAdmin}:${productId}`;
      const queryCacheKey = JSON.stringify(cacheKey);
      const cachedReviews = getCache(queryCacheKey);

      if (cachedReviews) {
        const updatedReviews = cachedReviews.map((cachedReview) =>
          cachedReview._id.toString() === reviewId
            ? { ...cachedReview, isApproved, version: version + 1 }
            : cachedReview
        );

        setCache(queryCacheKey, updatedReviews); // Update the cache
      }

      res
        .status(200)
        .json({ message: "Product approval status updated successfully." });
    } else {
      res
        .status(404)
        .json({ message: "Product not found or no changes made." });
    }
  } catch (error) {
    console.error("Error updating product approval status:", error);
    res.status(500).json({ message: "Failed to update approval status." });
  }
});
// API route to handle likes
router.post("/likeReview", async (req, res) => {
  const { reviewId, userEmail } = req.body;
  try {
    if (!ObjectId.isValid(reviewId)) {
      return res.status(400).json({ message: "Invalid review ID" });
    }

    const dbInstance = await db.connectDatabase();
    const db1 = await dbInstance.getDb();
    const reviewCollection = db1.collection("reviews");

    // Find the review by ID
    const review = await reviewCollection.findOne({
      _id: new ObjectId(reviewId),
    });
    // show(review, reviewId, userEmail);
    if (!review) {
      return res.status(404).json({ message: "Reviews not found" });
    }
    if (!Array.isArray(review.likes)) {
      console.error("Likes field is not an array:", review.likes);
      review.likes = [];
    }

    const hasLiked = review.likes.includes(userEmail);

    // Toggle like: Add like if not already liked, otherwise remove like
    const updateOperation = hasLiked
      ? { $pull: { likes: userEmail } }
      : { $push: { likes: userEmail } };

    await reviewCollection.updateOne(
      { _id: new ObjectId(reviewId) },
      updateOperation
    );

    return res.status(200).json({
      success: true,
      message: hasLiked
        ? "You have unliked the review."
        : "You have liked the review.",
    });
  } catch (error) {
    console.error("Error liking/unliking review:", error);
    res
      .status(500)
      .json({ message: "An error occurred while liking the review." });
  }
});

module.exports = router;
