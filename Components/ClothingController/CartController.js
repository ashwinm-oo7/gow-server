const express = require("express");
const router = express.Router();
const { getBase64Image, saveBase64Image } = require("../Utility/FileUtilityCloudStorage");
const db = require("../../db");
const { ObjectId } = require("mongodb");

router.post("/variantAddcart", async (req, res) => {
  console.log("Request Body:", req.body);
  const {
    _id,
    quantity,
    userId,
    selectedSizes,
    selectedColor,
    variantPrice,
    variantMrpPrice,
  } = req.body; // Added `selectedColor`
  console.log(
    "Request Query:",
    _id,
    quantity,
    userId,
    selectedSizes,
    selectedColor
  );

  try {
    // Validate product ID, quantity, and selectedSize/Color
    if (
      !ObjectId.isValid(_id) ||
      !quantity ||
      ![1, -1].includes(quantity) ||
      !selectedSizes ||
      !selectedColor // Ensure size and color are provided
    ) {
      return res.status(400).json({
        message: "Invalid product ID, quantity, or missing size/color",
      });
    }

    // Connect to the database
    const dbInstance = await db.connectDatabase();
    const db1 = await dbInstance.getDb();
    const cartCollection = db1.collection("variantCarts");
    const productCollection = db1.collection("product");
    const variantCollection = db1.collection("variant");

    // Check if the product exists
    const product = await productCollection.findOne({
      _id: new ObjectId(_id),
    });

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    const variant = await variantCollection.findOne({
      productId: new ObjectId(_id),
      color: selectedColor,
    });

    if (!variant) {
      return res
        .status(404)
        .json({ message: "Variant with the selected color not found" });
    }

    // Find the size-specific details within the variant
    const sizeDetails = variant.sizes.find(
      (size) => size.size === selectedSizes
    );

    if (!sizeDetails) {
      return res
        .status(404)
        .json({ message: "Selected size not found for this variant" });
    }

    const availableQuantity = sizeDetails.quantity;

    // Find the user's cart
    let cart = await cartCollection.findOne({ userId: new ObjectId(userId) });
    if (!cart) {
      // If the cart does not exist, create a new one
      cart = {
        userId: new ObjectId(userId),
        items: [],
      };
    }

    // Find if the product with the selected size and color already exists in the cart
    const existingItemIndex = cart.items.findIndex(
      (item) =>
        item.productId.equals(product._id) &&
        item.selectedSizes === selectedSizes && // Match both size and color
        item.selectedColor === selectedColor
    );

    let totalQuantityInCart = 0;
    if (existingItemIndex > -1) {
      totalQuantityInCart = cart.items[existingItemIndex].quantity;
    }

    // Check if adding the requested quantity will exceed available stock for the selected variant size
    if (totalQuantityInCart + quantity > availableQuantity) {
      const maxQuantity = availableQuantity - totalQuantityInCart;
      return res.status(200).json({
        message: `Only ${maxQuantity} more items can be added to the cart`,
        maxQuantity,
      });
    }

    if (existingItemIndex > -1) {
      // If the product with the same size and color is already in the cart, update the quantity
      cart.items[existingItemIndex].quantity += quantity;
      // If quantity becomes zero or negative, remove the item from the cart
      if (cart.items[existingItemIndex].quantity <= 0) {
        cart.items.splice(existingItemIndex, 1);
      }
    } else if (quantity > 0) {
      // If the product with the selected variant is not in the cart, add it
      cart.items.push({
        productId: product._id,
        quantity: quantity,
        selectedSizes: selectedSizes,
        selectedColor: selectedColor,
        variantPrice,
        variantMrpPrice,
        addedAt: new Date(),
      });
    }

    // Update the cart in the database
    if (cart._id) {
      await cartCollection.updateOne({ _id: cart._id }, { $set: cart });
    } else {
      // If the cart does not exist, create it
      await cartCollection.insertOne(cart);
    }

    res
      .status(201)
      .json({ message: "Product added to cart successfully", cart });
  } catch (error) {
    console.error("Error adding product to cart:", error);
    res.status(500).json({ message: "Failed to add product to cart" });
  }
});

router.post("/cart", async (req, res) => {
  console.log("Request Body:", req.body);
  const { _id, quantity, userId, selectedSizes } = req.body; //_id is product Id
  console.log("Request Query:", _id, quantity, userId, selectedSizes);
  try {
    // const userId = req.user.id;

    // Validate product ID and quantity
    if (!ObjectId.isValid(_id) || !quantity || ![1, -1].includes(quantity)) {
      return res
        .status(400)
        .json({ message: "Invalid product ID or quantity" });
    }

    // Connect to the database
    const dbInstance = await db.connectDatabase();
    const db1 = await dbInstance.getDb();
    const cartCollection = db1.collection("carts");
    const productCollection = db1.collection("product");

    // Check if the product exists
    const product = await productCollection.findOne({
      _id: new ObjectId(_id),
    });

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Find the user's cart
    let cart = await cartCollection.findOne({ userId: new ObjectId(userId) });
    if (!cart) {
      // If the cart does not exist, create a new one
      cart = {
        userId: new ObjectId(userId),
        items: [],
      };
    }

    const existingItemIndex = cart.items.findIndex((item) =>
      item.productId.equals(product._id)
    );
    let totalQuantityInCart = 0;
    if (existingItemIndex > -1) {
      totalQuantityInCart = cart.items[existingItemIndex].quantity;
    }

    // Check if adding the requested quantity will exceed available stock
    if (totalQuantityInCart + quantity > product.productQuantity) {
      const maxQuantity = product.productQuantity - totalQuantityInCart;
      return res.status(200).json({
        message: `Only ${maxQuantity} more items can be added to the cart`,
        maxQuantity,
      });
    }

    if (existingItemIndex > -1) {
      // If the product is already in the cart, update the quantity
      cart.items[existingItemIndex].quantity += quantity;
      if (
        selectedSizes &&
        cart.items[existingItemIndex].selectedSizes !== selectedSizes
      ) {
        cart.items[existingItemIndex].selectedSizes = selectedSizes;
      }

      if (cart.items[existingItemIndex].quantity <= 0) {
        cart.items.splice(existingItemIndex, 1);
      }
    } else if (quantity > 0) {
      cart.items.push({
        productId: product._id,
        quantity: quantity,
        selectedSizes: selectedSizes,
        addedAt: new Date(),
      });
    }

    // Update the cart in the database
    if (cart._id) {
      await cartCollection.updateOne({ _id: cart._id }, { $set: cart });
    } else {
      // If the cart does not exist, create it
      await cartCollection.insertOne(cart);
    }

    res
      .status(201)
      .json({ message: "Product added to cart successfully", cart });
  } catch (error) {
    console.error("Error adding product to cart:", error);
    res.status(500).json({ message: "Failed to add product to cart" });
  }
});

router.get("/getIdCart", async (req, res) => {
  const userId = req.query.userId;

  if (!ObjectId.isValid(userId)) {
    return res.status(400).json({ message: "Invalid user ID" });
  }

  try {
    const dbInstance = await db.connectDatabase();
    const db1 = await dbInstance.getDb();
    // const cartCollection = db1.collection("carts");
    const cartCollection = db1.collection("variantCarts");
    const variantCollection = db1.collection("variant");
    const productCollection = db1.collection("product");

    const cart = await cartCollection.findOne({ userId: new ObjectId(userId) });

    if (!cart) {
      return res.status(204).json({ cart: [], message: "Cart is empty" });
    }

    const cartItemsWithDetails = await Promise.all(
      cart.items.map(async (item) => {
        const product = await productCollection.findOne({
          _id: item.productId,
        });
        if (!product) {
          return null;
        }
        const variant = await variantCollection.findOne({
          productId: item.productId,
          color: item.selectedColor,
        });

        if (!variant) {
          return null; // Skip if the variant does not exist
        }
        // Find the correct size in the sizes array
        const selectedSizeDetails = variant.sizes.find(
          (sizeObj) => sizeObj.size === item.selectedSizes
        );

        // Ensure the selected size exists within the variant
        if (!selectedSizeDetails) {
          return null; // Skip if the size does not exist for the selected color
        }


        const productImagesWithBase64 = await Promise.all(
          product.productImages.map(async (image) => ({
            ...image,
            dataURL: await getBase64Image(image.filePath),
          }))
        );

        return {
          variant: selectedSizeDetails,
          amount: item.quantity * product.productPrice,
          brandName: product.brandName,
          categoryName: product.categoryName,
          discount: product.discount || "0% off",
          manufacturer: product.manufacturer,
          productDescription: product.productDescription,
          productImages: productImagesWithBase64,
          productMrpPrice: product.productMrpPrice,
          productName: product.productName,
          productPrice: product.productPrice,
          productQuantity: product.productQuantity,
          selectedSizes: item.selectedSizes,
          selectedColor: item.selectedColor,
          variantPrice: item.variantPrice || 0,
          variantMrpPrice: item.variantMrpPrice || 0,
          variantQuantity: item.quantity,
          size: product.size,
          skuCode: product.skuCode,
          subCategoryName: product.subCategoryName,
          _id: product._id,
        };
      })
    );

    // Filter out any null values (in case a product was not found)
    const filteredCartItems = cartItemsWithDetails.filter(
      (item) => item !== null
    );

    // Structure the final cart object
    const responseCart = {
      _id: cart._id,
      userId: cart.userId,
      items: filteredCartItems,
      updatedAt: new Date(cart.updatedAt).toLocaleString("en-GB"),
    };

    res.status(200).json({ responseCart });
  } catch (error) {
    console.error("Error fetching cart data:", error);
    res.status(500).json({ message: "Failed to fetch cart data" });
  }
});

router.delete("/deleteCart", async (req, res) => {
  const { _id, userId } = req.body; // _id is product Id

  if (!ObjectId.isValid(_id) || !ObjectId.isValid(userId)) {
    return res.status(400).json({ message: "Invalid product ID or user ID" });
  }

  try {
    // Connect to the database
    const dbInstance = await db.connectDatabase();
    const db1 = await dbInstance.getDb();
    // const cartCollection = db1.collection("carts");
    const cartCollection = db1.collection("variantCarts");

    // Find the user's cart
    const cart = await cartCollection.findOne({ userId: new ObjectId(userId) });

    if (!cart) {
      return res.status(404).json({ message: "Cart not found" });
    }

    // Find the item in the cart
    const itemIndex = cart.items.findIndex((item) =>
      item.productId.equals(new ObjectId(_id))
    );

    if (itemIndex > -1) {
      cart.items.splice(itemIndex, 1); // Remove the item from the cart

      if (cart.items.length === 0) {
        // If the cart is empty, you can delete the cart document or handle it as needed
        await cartCollection.deleteOne({ _id: cart._id });
      } else {
        // Otherwise, update the cart
        await cartCollection.updateOne(
          { _id: cart._id },
          { $set: { items: cart.items } }
        );
      }

      res
        .status(200)
        .json({ message: "Product removed from cart successfully" });
    } else {
      res.status(404).json({ message: "Product not found in cart" });
    }
  } catch (error) {
    console.error("Error removing product from cart:", error);
    res.status(500).json({ message: "Failed to remove product from cart" });
  }
});

router.delete("/cart/clear", async (req, res) => {
  const { userId } = req.body;

  if (!ObjectId.isValid(userId)) {
    return res.status(400).json({ message: "Invalid user ID" });
  }

  try {
    // Connect to the database
    const dbInstance = await db.connectDatabase();
    const db1 = await dbInstance.getDb();
    // const cartCollection = db1.collection("carts");
    const cartCollection = db1.collection("variantCarts");

    // Find the user's cart and delete it
    const result = await cartCollection.deleteOne({
      userId: new ObjectId(userId),
    });

    if (result.deletedCount === 1) {
      res.status(200).json({ message: "Cart cleared successfully" });
    } else {
      res.status(404).json({ message: "Cart not found" });
    }
  } catch (error) {
    console.error("Error clearing the cart:", error);
    res.status(500).json({ message: "Failed to clear the cart" });
  }
});

router.get("/getIdCarts", async (req, res) => {
  const userId = req.query.userId; // Get userId from query parameters
  console.log("FetchCartget", userId);
  if (!ObjectId.isValid(userId)) {
    return res.status(400).json({ message: "Invalid user ID" });
  }

  try {
    // Connect to the database
    const dbInstance = await db.connectDatabase();
    const db1 = await dbInstance.getDb();
    const cartCollection = db1.collection("carts");
    const productCollection = db1.collection("product");

    // Find the user's cart
    const cart = await cartCollection.findOne({ userId: new ObjectId(userId) });

    if (!cart) {
      return res.status(404).json({ message: "Cart not found" });
    }
    const productIds = cart.items.map((item) => item.productId);
    const products = await productCollection
      .find({ _id: { $in: productIds } })
      .toArray();

    // Map product details to the cart items
    const cartItemsWithDetails = cart.items.map((item) => {
      const product = products.find((p) => p._id.equals(item.productId));
      product.amount = item.quantity * product.productPrice;
      product.quantity = item.quantity;
      return {
        product: product,
      };
    });
    console.log("GetCart", cartItemsWithDetails);
    res.status(200).json({ cartItemsWithDetails });
  } catch (error) {
    console.error("Error fetching cart data:", error);
    res.status(500).json({ message: "Failed to fetch cart data" });
  }
});

module.exports = router;
