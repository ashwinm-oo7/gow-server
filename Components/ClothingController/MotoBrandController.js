const express = require("express");
const router = express.Router();
const db = require("../../db");
router.get("/getMotoBrandModels", async (req, res) => {
  try {
    const dbInstance = await db.connectDatabase();
    const db1 = await dbInstance.getDb();
    const motoBrandsData = await db1.collection("moto_brands");
    const motoModelsData = await db1.collection("moto_models");
    const motoBrands = await motoBrandsData.find().toArray();
    const motoModels = await motoModelsData.find().toArray();
    // console.log("MOdels :: ", motoModels);

    const dtos = [];

    // Iterate over each moto model
    motoModels.forEach((model) => {
      // Iterate over each data item in the model
      // console.log(model.data.length, "", model);

      model.data.forEach((modelData) => {
        // Find the corresponding brand in the moto brands collection
        const brand = motoBrands.find((brand) =>
          brand.data.some((data) => data.id === modelData.brand_id)
        );

        // If brand is found, construct DTO
        if (brand) {
          const dto = {
            id: modelData.id,
            name: `${
              brand.data.find((data) => data.id === modelData.brand_id).name
            } : ${modelData.name}`,
            categoryName: brand.categoryName, // Replace with actual category name
          };
          dtos.push(dto);
        }
      });
    });

    // Send the resulting DTOs as JSON response
    res.status(200).json(dtos);
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({ message: "Failed to fetch products" });
  }
});

module.exports = router;
