const cloudinary = require("cloudinary").v2;
const sharp = require("sharp");
const path = require("path"); // Import the path module
const fs = require("fs"); // Import the fs module for file handling
const fetch = require("node-fetch"); // Import fetch for external requests

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const IMAGE_DELIMITER = "data:image/webp;base64,";
// const PRODUCT_IMAGE_PATH = "/home/ClothingImages/";
function isSupportedImageFormat(extension) {
  const supportedFormats = ["jpeg", "jpg", "png", "gif", "webp", "tiff", "tif"];
  return supportedFormats.includes(extension);
}

// Save Image to Cloudinary
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

    const base64Data = encodedString.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");

    // Convert to WebP format using Sharp
    const webpBuffer = await sharp(buffer).webp().toBuffer();

    // Upload to Cloudinary
    const uploadResult = await uploadImageToCloudinary(
      webpBuffer,
      id,
      fileNameWithExtension
    );

    console.log("Image uploaded to Cloudinary sucess:", uploadResult);
    return uploadResult.secure_url;
  } catch (error) {
    console.error("Error saving image ", error);
    throw error;
  }
}

function uploadImageToCloudinary(buffer, id, fileNameWithExtension) {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        public_id: `${id}/${fileNameWithExtension}`, // Use ID for folder structure
        format: "webp", // Ensure the format is webp
        resource_type: "image", // Image resource type
      },
      (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result); // Return the result after upload is complete
        }
      }
    );

    // Pipe the image buffer to the Cloudinary upload stream
    uploadStream.end(buffer);
  });
}
function uploadVideoToCloudinary(buffer, id, fileNameWithExtension) {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        public_id: `${id}/${fileNameWithExtension}`, // Use ID for folder structure
        format: "mp4", // Ensure the format is webp
        resource_type: "video", // Image resource type
      },
      (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result); // Return the result after upload is complete
        }
      }
    );

    // Pipe the image buffer to the Cloudinary upload stream
    uploadStream.end(buffer);
  });
}
// Save File to Cloudinary
async function saveBase64File(encodedString, fileName, fileExtension) {
  try {
    if (!encodedString) {
      throw new Error("Encoded string is undefined.");
    }

    const base64Data = encodedString.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");

    // Upload to Cloudinary
    const uploadResult = await cloudinary.uploader.upload_stream(
      {
        public_id: fileName, // Custom naming convention
        format: fileExtension, // File format (e.g., jpeg, png)
        resource_type: "raw", // For non-image files
      },
      (error, result) => {
        if (error) {
          throw error;
        }
        console.log("File uploaded to Cloudinary:", result);
        return result.secure_url; // Return Cloudinary URL
      }
    );

    // Pipe the buffer to Cloudinary upload stream
    uploadResult.end(buffer);
    return uploadResult.secure_url;
  } catch (error) {
    console.error("Error saving file:", error);
    throw error;
  }
}

// Get Base64 Image from Cloudinary
async function getBase64Image(cloudinaryUrl) {
  try {
    if (cloudinaryUrl) {
      if (!cloudinaryUrl) {
        throw new Error("Cloudinary URL is null or undefined.");
      }

      // Fetch the image from Cloudinary
      const response = await fetch(cloudinaryUrl);
      if (!response.ok) {
        throw new Error(
          `Failed to fetch image from Cloudinary: ${response.statusText}`
        );
      }

      const imageBuffer = await response.buffer();
      const base64Image = imageBuffer.toString("base64");
      console.log("Base64 image length: ", base64Image.length); // Log length of base64 string

      return `data:image/webp;base64,${base64Image}`; // Prepend MIME type
    } else {
      // Local file path

      const absolutePath = path.resolve(cloudinaryUrl);
      if (fs.existsSync(absolutePath)) {
        const data = fs.readFileSync(absolutePath);
        const base64Image = Buffer.from(data).toString("base64");
        return IMAGE_DELIMITER + base64Image;
      }
    }
  } catch (error) {
    console.error(`Error processing image "${cloudinaryUrl}":`, error.message);
    // Return a placeholder or default image as a fallback
    const defaultImagePath = path.resolve("./assets/default-image.jpg"); // Update with your placeholder path
    if (fs.existsSync(defaultImagePath)) {
      const buffer = fs.readFileSync(defaultImagePath);
      return `data:image/jpeg;base64,${buffer.toString("base64")}`;
    }
    return null; // Or a placeholder base64 string
  }
}
// Delete File from Cloudinary
function deleteFile(filePath) {
  cloudinary.uploader.destroy(filePath, (error, result) => {
    if (error) {
      console.error("Error deleting file from Cloudinary:", error);
    } else {
      console.log("File deleted successfully from Cloudinary:", result);
    }
  });
}

// Save Base64 Video to Cloudinary
async function saveBase64Video(encodedString, id, fileNameWithExtension) {
  try {
    if (!encodedString) {
      throw new Error("Encoded string is undefined.");
    }
    const fileExtension = fileNameWithExtension.toLowerCase();

    if (typeof id !== "string" || typeof fileNameWithExtension !== "string") {
      throw new Error("ID and fileNameWithExtension must be strings.");
    }
    const base64Data = encodedString.replace(/^data:video\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");

    // Upload video to Cloudinary
    const uploadResult = await uploadVideoToCloudinary(
      buffer,
      id,
      fileExtension
    );

    return uploadResult.secure_url;
  } catch (error) {
    console.error("Error saving video file:", error);
    throw error;
  }
}

// Get Base64 Video from Cloudinary
async function getBase64Video(filePath) {
  try {
    if (!filePath) {
      throw new Error("File path is null or undefined.");
    }

    // const absolutePath = path.resolve(filePath);
    // if (!fs.existsSync(absolutePath)) {
    //   throw new Error(`File not found at path: ${absolutePath}`);
    // }

    // Fetch the image from Cloudinary

    // Fetch video from Cloudinary
    const videoUrl = cloudinary.url(filePath, { secure: true });
    const response = await fetch(videoUrl);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch image from Cloudinary: ${response.statusText}`
      );
    }
    const videoBuffer = await response.buffer();
    const base64Video = videoBuffer.toString("base64");

    return `data:video/mp4;base64,${base64Video}`; // Adjust mime type as necessary
  } catch (error) {
    console.error("Error getting base64 video:", error);
    return null;
  }
}

function show(review, reviewId, userEmail) {
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
