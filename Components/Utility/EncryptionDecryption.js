const crypto = require("crypto");
const dotenv = require("dotenv");
const { MongoClient } = require("mongodb");

// Load environment variables from .env file
dotenv.config();
// dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const initVector = Buffer.from("uPfVxw5nykjNf9hU", "utf-8");
const key = "uPfVxw5nykjNf9hT".padEnd(32, " ");

// Function to encrypt a value
async function encrypt(valueStr) {
  try {
    const cipher = crypto.createCipheriv(
      "aes-256-cbc",
      Buffer.from(key),
      Buffer.from(initVector, "hex")
    );
    let encrypted = cipher.update(valueStr, "utf-8", "base64");
    encrypted += cipher.final("base64");
    return encrypted;
  } catch (error) {
    console.error("Error during encryption:", error);
    return null;
  }
}

// Function to decrypt a value
async function decrypt(valueStr) {
  try {
    const decipher = crypto.createDecipheriv(
      "aes-256-cbc",
      Buffer.from(key),
      Buffer.from(initVector, "hex")
    );
    let decrypted = decipher.update(valueStr, "base64", "utf-8");
    decrypted += decipher.final("utf-8");
    return decrypted;
  } catch (error) {
    console.error("Error during decryption:", error);
    return null;
  }
}

module.exports = { encrypt, decrypt };
