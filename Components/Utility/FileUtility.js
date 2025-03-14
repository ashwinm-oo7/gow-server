const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const IMAGE_DELIMITER = "data:image/webp;base64,";
const PRODUCT_IMAGE_PATH = "/home/ClothingImages/";

async function saveBase64Image(encodedString, id, fileNameWithExtension) {
  const fileExtension = fileNameWithExtension.toLowerCase();
  try {
    if (typeof id !== "string" || typeof fileNameWithExtension !== "string") {
      throw new Error("ID and fileNameWithExtension must be strings.");
    }

    console.log("FGHJKLJHGFD :::::", fileExtension);
    if (!isSupportedImageFormat(fileExtension)) {
      console.log("Unsupported image format:", fileExtension);
      throw new Error("Unsupported image format");
    }

    if (
      !["jpeg", "jpg", "png", "gif", "webp", "tiff", "tif"].includes(
        fileExtension
      )
    ) {
      console.log("Unsupported image format:", fileExtension);
      throw new Error("Unsupported image format");
    }

    const base64Data = encodedString.replace(/^data:image\/\w+;base64,/, "");
    const folderPath = path.join(PRODUCT_IMAGE_PATH, String(id));

    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }

    const imagePath = path.join(folderPath, fileNameWithExtension + ".webp");

    const buffer = Buffer.from(base64Data, "base64");
    sharp(buffer)
      .webp()
      .toFile(imagePath)
      .then(() => console.log("Image saved as:", imagePath))
      .catch((err) => {
        // console.error("Error saving image:", err);
        throw err;
      });

    return imagePath;
  } catch (error) {
    console.error("Error saving image ", error);
    throw error;
  }
}

async function isSupportedImageFormat(extension) {
  const supportedFormats = ["jpeg", "jpg", "png", "gif", "webp", "tiff", "tif"];
  return supportedFormats.includes(extension);
}

async function saveBase64File(encodedString, fileName, fileExtension) {
  try {
    if (!encodedString) {
      throw new Error("Encoded string is undefined.");
    }

    const base64Data = encodedString.replace(/^data:image\/\w+;base64,/, "");
    const filePath = path.join(
      PRODUCT_IMAGE_PATH,
      fileName + "." + fileExtension
    );

    if (!fs.existsSync(PRODUCT_IMAGE_PATH)) {
      fs.mkdirSync(PRODUCT_IMAGE_PATH, { recursive: true });
    }

    const buffer = Buffer.from(base64Data, "base64");
    fs.writeFileSync(filePath, buffer);

    return filePath;
  } catch (error) {
    console.error("Error saving file:", error);
    throw error;
  }
}

async function getBase64Image(filePath) {
  try {
    if (!filePath) {
      throw new Error("File path is null or undefined.");
    }
    const absolutePath = path.resolve(filePath);
    if (fs.existsSync(absolutePath)) {
      const data = fs.readFileSync(absolutePath);
      const base64Image = Buffer.from(data).toString("base64");
      // console.log(IMAGE_DELIMITER + base64Image);
      return IMAGE_DELIMITER + base64Image;
    } else {
      throw new Error("File not found: " + filePath);
    }
  } catch (error) {
    console.error("Error getting base64 image:", error);
    throw error;
  }
}

async function deleteFile(filePath) {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

async function saveBase64Video(encodedString, fileName, fileExtension) {
  try {
    if (!encodedString) {
      throw new Error("Encoded string is undefined.");
    }

    const base64Data = encodedString.replace(/^data:video\/\w+;base64,/, "");
    const filePath = path.join(
      PRODUCT_IMAGE_PATH,
      fileName + "." + fileExtension
    );

    if (!fs.existsSync(PRODUCT_IMAGE_PATH)) {
      fs.mkdirSync(PRODUCT_IMAGE_PATH, { recursive: true });
    }

    const buffer = Buffer.from(base64Data, "base64");
    fs.writeFileSync(filePath, buffer);

    return filePath;
  } catch (error) {
    console.error("Error saving video file:", error);
    throw error;
  }
}

async function getBase64Video(filePath) {
  try {
    if (!filePath) {
      throw new Error("File path is null or undefined.");
    }

    const absolutePath = path.resolve(filePath);
    if (fs.existsSync(absolutePath)) {
      const data = fs.readFileSync(absolutePath);
      const base64Video = Buffer.from(data).toString("base64");
      return `data:video/mp4;base64,${base64Video}`; // Adjust mime type as necessary
    } else {
      throw new Error("File not found: " + filePath);
    }
  } catch (error) {
    console.error("Error getting base64 video:", error);
    throw error;
  }
}

async function show(review, reviewId, userEmail) {
  console.log(review, reviewId, userEmail);
}

module.exports = {
  saveBase64Image,
  saveBase64File,
  saveBase64Video,
  isSupportedImageFormat, // Add the video handler
  getBase64Image,
  getBase64Video,
  deleteFile,
  show,
};
