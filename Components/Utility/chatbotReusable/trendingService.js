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

  // Try to find product by name or brand (fuzzy match)
  const product = await productCollection.findOne({
    $or: [
      { productName: { $regex: new RegExp(userInput, "i") } },
      { brandName: { $regex: new RegExp(userInput, "i") } },
    ],
  });

  if (!product) return null;

  const variants = await variantCollection
    .find({ productId: new ObjectId(product._id) })
    .toArray();

  return {
    product,
    variants,
  };
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

async function getAllSubcategories(db) {
  const subCatCollection = db.collection("subcategory");

  const subcats = await subCatCollection
    .find({}, { projection: { categoryName: 1, subCategoryName: 1 } })
    .sort({ categoryName: 1, subCategoryName: 1 })
    .toArray();

  return subcats;
}

async function getSubcategoriesByCategory(db, category) {
  const subCatCollection = db.collection("subcategory");

  const subcats = await subCatCollection
    .find(
      { categoryName: { $regex: new RegExp(category, "i") } },
      { projection: { subCategoryName: 1 } }
    )
    .toArray();
  return subcats.map((s) => s.subCategoryName);
}

module.exports = {
  getTrendingProducts,
  getProductCategories,
  getAllSubcategories,
  getSubcategoriesByCategory,
  getProductPriceInfo,
};
