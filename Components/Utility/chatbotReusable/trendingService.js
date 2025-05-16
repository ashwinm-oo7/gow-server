// trendingService.js

const { ObjectId } = require("mongodb");

async function getTrendingProducts(db, limit = 5) {
  const orderCollection = await db.collection("order");
  //   const productCollection = await db.collection("product");

  const pipeline = [
    { $unwind: "$products" },
    {
      $group: {
        _id: "$products.id", // product id from order
        totalSold: { $sum: "$products.quantity" },
      },
    },
    { $sort: { totalSold: -1 } },
    { $limit: limit },
    {
      $addFields: {
        productObjectId: {
          $cond: {
            if: { $eq: [{ $type: "$_id" }, "string"] },
            then: { $toObjectId: "$_id" },
            else: "$_id",
          },
        },
      },
    },
    {
      $lookup: {
        from: "product",
        localField: "productObjectId",
        foreignField: "_id",
        as: "productDetails",
      },
    },
    { $unwind: "$productDetails" },
    {
      $project: {
        name: "$productDetails.productName",
        brand: "$productDetails.brandName",
        category: "$productDetails.categoryName",
        totalSold: 1,
      },
    },
  ];

  const trending = await orderCollection.aggregate(pipeline).toArray();
  return trending;
}

async function getProductPriceInfo(db, userInput) {
  const productCollection = db.collection("product");
  const variantCollection = db.collection("variant");
  if (!userInput) return null;

  // Step 1: Extract possible brand or product keywords
  const cleanedInput = userInput
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .replace(
      /\b(price|cost|how much|rate|of|is|what|the|tell|me|about|stock|i|want|all|show|can|you|give|details|list|info)\b/gi,
      ""
    )
    .trim();

  console.log("cleanedInput", cleanedInput);
  if (!cleanedInput) return null;

  // Sanitize input to prevent regex abuse
  const escapedInput = cleanedInput.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  console.log("escapedInput", escapedInput);
  const regex = new RegExp(escapedInput, "i");
  console.log("regex", regex);
  // Step 2: Try fuzzy match on brand or product name
  let product = await productCollection
    .find({
      $or: [
        // { productName: { $regex: new RegExp(cleanedInput, "i") } },
        // { brandName: { $regex: new RegExp(cleanedInput, "i") } },

        { productName: { $regex: regex } },
        { brandName: { $regex: regex } },
      ],
    })
    .limit(5)
    .toArray();
  console.log("products availble or not", product);
  if (!product || product.length === 0) {
    const tokens = cleanedInput.split(" ").filter(Boolean);
    for (const word of tokens) {
      const safeWord = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const wordRegex = new RegExp(safeWord, "i");
      product = await productCollection
        .find({
          $or: [
            { productName: { $regex: wordRegex } },
            { brandName: { $regex: wordRegex } },
          ],
        })
        .limit(5)
        .toArray();
      if (product.length > 0) break;
    }
  }

  if (!product || product.length === 0) return null;
  const result = await Promise.all(
    product.map(async (products) => {
      const variants = await variantCollection
        .find({ productId: new ObjectId(products._id) })
        .toArray();
      return { products, variants };
    })
  );

  return result;
}

async function getProductCategories(db) {
  const categoryCollection = db.collection("category");

  const categories = await categoryCollection
    .find({}, { projection: { categoryName: 1 } })
    .sort({ categoryName: 1 })
    .toArray();

  return categories.map((cat) => cat.categoryName);
}

// subcategoryService.js
async function getSubcategorySummary(db) {
  const allSubcats = await getAllSubcategories(db);

  const grouped = allSubcats.reduce((acc, cur) => {
    acc[cur.categoryName] = acc[cur.categoryName] || [];
    acc[cur.categoryName].push(cur.subCategoryName);
    return acc;
  }, {});

  let response = "📁 **Available Subcategories**:\n";
  for (const [cat, subs] of Object.entries(grouped)) {
    response += `- ${cat}: ${subs.join(", ")}\n`;
  }

  return response;
}
async function getAllSubcategories(db) {
  const subCatCollection = db.collection("subcategory");

  const subcats = await subCatCollection
    .find({}, { projection: { categoryName: 1, subCategoryName: 1 } })
    .sort({ categoryName: 1, subCategoryName: 1 })
    .toArray();

  return subcats;
}

module.exports = {
  getTrendingProducts,
  getProductCategories,
  getAllSubcategories,
  getProductPriceInfo,
  getSubcategorySummary,
};
