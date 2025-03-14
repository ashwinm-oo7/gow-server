//ProductController.js
const express = require("express");
const router = express.Router();
const {
  getBase64Image,
  saveBase64Image,
  saveBase64Video,
  getBase64Video,
} = require("../Utility/FileUtilityCloudStorage");
// const { getCache, setCache, deleteCache } = require("../Utility/cache");

const db = require("../../db");
const { ObjectId } = require("mongodb");

const allowedImageFormats = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
];
const allowedVideoFormats = ["video/mp4", "video/webm", "video/ogg"];
const redisClient = require("../Utility/RedisClient");

async function connectRedis() {
  if (!redisClient.isOpen) {
    await redisClient.connect();
  }
}

router.post("/add", async (req, res) => {
  try {
    const {
      userEmail,
      categoryName,
      subCategoryName,
      brandName,
      productName,
      skuCode,
      manufacturer,
      productDescription,
      productImages,
      variants,
    } = req.body;

    // Create a new Product instance
    const newProduct = {
      userEmail,
      categoryName,
      subCategoryName,
      brandName,
      productName,
      skuCode,
      manufacturer,
      productDescription,
      isApproved: false,
      created_at: new Date().toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
      }),
    };

    for (const image of productImages) {
      if (image.type === "application/pdf") {
        console.log("Encountered PDF. Exiting product addition.", image.type);
        return res.status(400).json({ message: "PDF images are not allowed" });
      }
    }

    // Process images and videos
    for (let media of productImages) {
      const { fileName, dataURL, type } = media;
      const fileExtension = fileName.split(".").pop().toLowerCase();
      const fileNameWithoutExtension = fileName.replace(/\.[^/.]+$/, "");

      if (allowedImageFormats.includes(type)) {
        media.filePath = await saveBase64Image(
          dataURL,
          fileNameWithoutExtension,
          fileExtension
        );
      } else if (allowedVideoFormats.includes(type)) {
        media.filePath = await saveBase64Video(
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

    newProduct.productImages = productImages;

    // Insert the new product into the database
    const dbInstance = await db.connectDatabase();
    const db1 = await dbInstance.getDb();
    const productCollection = db1.collection("product");
    const savedProduct = await productCollection.insertOne(newProduct);

    const productId = savedProduct.insertedId;

    // Handle variants
    const variantCollection = db1.collection("variant");
    for (const variant of variants) {
      const newVariant = {
        productId,
        color: variant.color,
        sizes: variant.subvariant.map((sizeData) => ({
          size: sizeData.size,
          price: parseFloat(sizeData.price),
          mrpPrice: parseFloat(sizeData.mrpPrice),
          quantity: parseInt(sizeData.quantity),
        })),
        createdAt: new Date(),
      };

      await variantCollection.insertOne(newVariant);
    }

    await redisClient.del("all_products_admin");
    await redisClient.del("all_products_user");

    res
      .status(201)
      .json({ message: "Product added successfully", product: newProduct });
  } catch (error) {
    if (error.message === "Unsupported image format") {
      return res.status(400).json({
        message:
          "Unsupported image format. Only JPEG, PNG, GIF, WebP, TIFF formats are supported.",
      });
    }
    res
      .status(500)
      .json({ message: "Failed to add product", error: error.message });
  }
});

router.get("/getAllProducts", async (req, res) => {
  try {
    await connectRedis();

    const { id } = req.query;
    const isAdmin = req.query.isAdmin === "true";
    const dbInstance = await db.connectDatabase();
    const db1 = await dbInstance.getDb();
    const productCollection = db1.collection("product");
    const variantCollection = db1.collection("variant");
    // cache.flushAll();
    if (!redisClient.isOpen) {
      await client.connect();
    }
    if (id) {
      const cachedProduct = await redisClient.get(id);

      if (cachedProduct) {
        return res.status(200).json(JSON.parse(cachedProduct));
      }

      // Fetch a single product by ID
      const productQuery = { _id: new ObjectId(id) };
      if (!isAdmin) {
        productQuery.isApproved = true; // Non-admins can only fetch approved products
      }

      const product = await productCollection.findOne(productQuery);

      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      const productVariants = await variantCollection
        .find({ productId: new ObjectId(id) })
        .toArray();

      // Ensure productImages exists before mapping
      product.productImages = product.productImages
        ? product.productImages.map((media) => ({
            ...media,
            dataURL: allowedImageFormats.includes(media.type)
              ? "data:image/webp;base64"
              : allowedVideoFormats.includes(media.type)
              ? "data:video/mp4;base64"
              : null, // Assign null if it's neither image nor video
          }))
        : [];

      // Update product media files (images/videos)
      // product.productImages = await Promise.all(
      //   product.productImages.map(async (media) => {
      //     try {
      //       if (allowedImageFormats.includes(media.type)) {
      //         // const dataURL = await getBase64Image(media.filePath);
      //         const dataURL = `data:image/webp;base64,${media.filePath}`;
      //         console.log(dataURL);
      //         return {
      //           ...media,
      //           dataURL: dataURL || null, // Use image handler
      //         };
      //       } else if (allowedVideoFormats.includes(media.type)) {
      //         // const dataURL = await getBase64Video(media.filePath);
      //         const dataURL = `data:video/mp4;base64,${media.filePath}`;

      //         return {
      //           ...media,
      //           dataURL: dataURL || null, // Use video handler
      //         };
      //       }
      //       return media;
      //     } catch (error) {
      //       console.error(`Error processing media: ${error.message}`);
      //       return {
      //         ...media,
      //         dataURL: null, // Set null in case of error
      //       };
      //     }
      //   })
      // );

      product.variants = productVariants;
      await redisClient.set(id, JSON.stringify(product), { EX: 36000 }); // Cache for 1 hour

      return res.status(200).json(product);
    } else {
      // Fetch all products and variants in one query
      const query = isAdmin ? {} : { isApproved: true };
      const queryCacheKey = isAdmin
        ? "all_products_admin"
        : "all_products_user";

      const cachedProducts = await redisClient.get(queryCacheKey);
      if (cachedProducts) {
        return res.status(200).json(JSON.parse(cachedProducts));
      }

      const allProducts = await productCollection.find(query).toArray();

      // console.log("Stock GET cached: " + cacheProduct);
      const allProductIds = allProducts.map(
        (product) => new ObjectId(product._id)
      );

      // Fetch all variants at once
      const allVariants = await variantCollection
        .find({ productId: { $in: allProductIds } })
        .toArray();

      // Map variants to products
      const variantsByProductId = allVariants.reduce((acc, variant) => {
        if (!acc[variant.productId]) {
          acc[variant.productId] = [];
        }
        acc[variant.productId].push(variant);
        return acc;
      }, {});

      // Add variants and base64 media (images/videos) to products
      const productsWithVariants = await Promise.all(
        allProducts.map(async (product) => {
          const variants = variantsByProductId[product._id] || [];
          const productWithMedia = {
            ...product,
            // productImages: await Promise.all(
            //   product.productImages &&
            //     product.productImages.map(async (media) => {
            //       if (!media.type || !media) {
            //         return null;
            //       }
            //       try {
            //         if (allowedImageFormats.includes(media.type)) {
            //           // const dataURL = await getBase64Image(media.filePath);
            //           const dataURL = `data:image/webp;base64,${media.filePath}`;

            //           // console.log("getAll ADmin", dataURL);
            //           return {
            //             ...media,
            //             dataURL: (dataURL && dataURL) || null, // Use image handler
            //           };
            //         } else if (allowedVideoFormats.includes(media.type)) {
            //           // const dataURL = await getBase64Video(media.filePath);
            //           const dataURL = `data:video/mp4;base64,${media.filePath}`;

            //           return {
            //             ...media,
            //             dataURL: dataURL || null, // Use video handler
            //           };
            //         } else {
            //           null;
            //         }
            //         return media; // Return unmodified media if it's not an image or video
            //       } catch (error) {
            //         console.error(`Error processing media: ${error.message}`);
            //         return {
            //           ...media,
            //           dataURL: null, // Set null in case of error
            //         };
            //       }
            //     })
            // ),
            productImages: product.productImages
              ? product.productImages.map((media) => ({
                  ...media,
                  dataURL: allowedImageFormats.includes(media.type)
                    ? "data:image/webp;base64"
                    : allowedVideoFormats.includes(media.type)
                    ? "data:video/mp4;base64"
                    : null,
                }))
              : [],

            variants,
          };

          return productWithMedia;
        })
      );
      await redisClient.set(
        queryCacheKey,
        JSON.stringify(productsWithVariants),
        { EX: 36000 }
      );

      res.status(200).json(productsWithVariants);
    }
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({ message: "Failed to fetch products" });
  }
});

router.put("/update/:productId", async (req, res) => {
  try {
    const productIdToUpdate = req.params.productId;
    const updatedProductData = req.body;

    // Process images and videos
    const processedMedia = await Promise.all(
      updatedProductData.productImages.map(async (media) => {
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
    );

    updatedProductData.productImages = processedMedia;
    updatedProductData.updated_at = new Date().toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
    });

    const dbInstance = await db.connectDatabase();
    const db1 = await dbInstance.getDb();
    const productCollection = db1.collection("product");
    const variantCollection = db1.collection("variant");

    const updatedProduct = await productCollection.findOneAndUpdate(
      { _id: new ObjectId(productIdToUpdate) },
      { $set: updatedProductData },
      { returnOriginal: false }
    );
    console.log("UpdateProduct", updatedProduct);
    if (!updatedProduct) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Handle variants (same logic as before)
    const existingVariants = await variantCollection
      .find({ productId: new ObjectId(productIdToUpdate) })
      .toArray();
    const variantsToUpdate = updatedProductData.variants;

    // Determine variants to delete
    const variantsToDelete = existingVariants.filter(
      (existingVariant) =>
        !variantsToUpdate.some(
          (variant) => variant.color === existingVariant.color
        )
    );

    // Delete removed variants
    await Promise.all(
      variantsToDelete.map((variantToDelete) =>
        variantCollection.deleteOne({ _id: variantToDelete._id })
      )
    );

    // Update or insert variants
    for (const variant of variantsToUpdate) {
      const existingVariant = existingVariants.find(
        (v) => v.color === variant.color
      );

      const updatedSizes = variant.subvariant.map((sizeData) => ({
        size: sizeData.size,
        price: parseFloat(sizeData.price),
        mrpPrice: parseFloat(sizeData.mrpPrice),
        quantity: parseInt(sizeData.quantity),
      }));

      if (existingVariant) {
        await variantCollection.updateOne(
          { _id: existingVariant._id },
          { $set: { sizes: updatedSizes, updatedAt: new Date() } }
        );
      } else {
        const newVariant = {
          productId: new ObjectId(productIdToUpdate),
          color: variant.color,
          sizes: updatedSizes,
          createdAt: new Date(),
        };

        await variantCollection.insertOne(newVariant);
      }
    }
    await redisClient.del(productIdToUpdate);
    await redisClient.del("all_products_admin");
    await redisClient.del("all_products_user");

    res.status(200).json(updatedProduct.value);
  } catch (error) {
    console.error("Error updating product:", error);
    res.status(500).json({ message: "Failed to update product" });
  }
});

router.get("/getProductById/:productIdToUpdate", async (req, res) => {
  try {
    const productIdToUpdate = req.params.productIdToUpdate;

    const dbInstance = await db.connectDatabase();
    const db1 = await dbInstance.getDb();
    const productCollection = db1.collection("product");
    const variantCollection = db1.collection("variant");

    const product = await productCollection.findOne({
      _id: new ObjectId(productIdToUpdate),
    });

    if (!product) {
      console.error("Product not found");
      return res.status(404).json({ message: "Product not found" });
    }

    // Fetch the variants related to this product
    const variants = await variantCollection
      .find({ productId: new ObjectId(productIdToUpdate) })
      .toArray();

    // Define allowed formats
    // Update product media files (images/videos)
    product.productImages = await Promise.all(
      product.productImages.map(async (media) => {
        try {
          if (allowedImageFormats.includes(media.type)) {
            const dataURL = await getBase64Image(media.filePath); // Use image handler

            return {
              ...media,
              dataURL: (dataURL && dataURL) || null,
            };
          } else if (allowedVideoFormats.includes(media.type)) {
            return {
              ...media,
              dataURL: getBase64Video(media.filePath), // Use video handler
            };
          }

          return media; // Return unchanged media if not an allowed format
        } catch (error) {
          console.error(`Error processing media: ${error.message}`);
          return {
            ...media,
            dataURL: null, // Set null in case of error
          };
        }
      })
    );

    // Format the response to include variants
    const response = {
      ...product,
      variants: variants.map((variant) => ({
        color: variant.color,
        subvariant: variant.sizes.map((sizeData) => ({
          size: sizeData.size,
          price: sizeData.price,
          mrpPrice: sizeData.mrpPrice,
          quantity: sizeData.quantity,
        })),
      })),
    };

    res.status(200).json(response);
  } catch (error) {
    console.error("Error fetching product:", error);
    res.status(500).json({ message: "Failed to fetch product" });
  }
});

// Add new route to update the approval status
router.put("/updateApprovalStatus/:productId", async (req, res) => {
  const { productId } = req.params;
  // const { isApproved } = req.body;
  const isApproved = Boolean(req.body.isApproved);

  if (!ObjectId.isValid(productId)) {
    return res.status(400).json({ message: "Invalid product ID format." });
  }

  try {
    await connectRedis();

    const dbInstance = await db.connectDatabase();
    const db1 = await dbInstance.getDb();
    const productCollection = db1.collection("product");

    const productExists = await productCollection.findOne({
      _id: new ObjectId(productId),
    });

    if (!productExists) {
      return res.status(404).json({ message: "Product not found." });
    }

    // Update the approval status of the product
    const updatedProduct = await productCollection.updateOne(
      { _id: new ObjectId(productId) },
      { $set: { isApproved } }
    );

    if (updatedProduct.modifiedCount === 1) {
      // const productCache = getCache(productId);
      // if (productCache) {
      //   productCache.isApproved = req.body.isApproved;
      //   setCache(productId, productCache);
      // }
      await redisClient.del(productId);
      await redisClient.del("all_products_admin");
      await redisClient.del("all_products_user");
      // Optionally update the "all products" cache
      // const allProductsCacheKey = JSON.stringify({});
      // const allProductsCache = getCache(allProductsCacheKey);
      // if (allProductsCache) {
      //   const productIndex = allProductsCache.findIndex(
      //     (p) => p._id.toString() === productId
      //   );
      //   if (productIndex !== -1) {
      //     allProductsCache[productIndex].isApproved = req.body.isApproved;
      //     setCache(allProductsCacheKey, allProductsCache);
      //   }
      // }
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

router.delete("/deleteProduct/:productId", async (req, res) => {
  try {
    const productIdToDelete = req.params.productId;
    const dbInstance = await db.connectDatabase();
    const db1 = await dbInstance.getDb();
    const productCollection = db1.collection("product");
    const variantsCollection = db1.collection("variant");

    const deletedProduct = await productCollection.findOneAndDelete({
      _id: new ObjectId(productIdToDelete),
    });

    if (!deletedProduct) {
      throw new Error("Product not found");
    }
    // Delete related variants
    await variantsCollection.deleteMany({
      productId: new ObjectId(productIdToDelete),
    });

    res.status(200).json({ message: "Product deleted successfully" });
  } catch (error) {
    console.error("Error deleting product:", error);
    res.status(500).json({ message: "Failed to delete product" });
  }
});

module.exports = router;
