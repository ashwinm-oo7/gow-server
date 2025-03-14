const Product = require("../ClothingController/ProductController");
const ProductImages = require("../UserEntity/ProductImage");
const FileUtility = require("../Utility/FileUtility");

const fs = require("fs");
const path = require("path");

function getValueByName(propertyFileName, propertyName, defaultValue) {
  try {
    const properties = loadProperties(propertyFileName);
    return properties[propertyName] || defaultValue;
  } catch (error) {
    console.error("Error getting property value:", error);
    return defaultValue;
  }
}

function loadProperties(propertyFileName) {
  const properties = {};
  const filePath = path.join(__dirname, propertyFileName);

  if (!fs.existsSync(filePath)) {
    throw new Error(`Property file '${propertyFileName}' not found.`);
  }

  const fileContent = fs.readFileSync(filePath, "utf8");
  const lines = fileContent.split("\n");

  lines.forEach((line) => {
    if (line.trim() !== "" && !line.startsWith("#")) {
      const [key, value] = line.split("=").map((part) => part.trim());
      properties[key] = value;
    }
  });

  return properties;
}

module.exports = {
  getValueByName,
};
