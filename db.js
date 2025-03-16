const { MongoClient } = require("mongodb");
require("dotenv").config();

class Database {
  constructor(uri, dbName) {
    this.uri = uri;
    this.dbName = dbName;
    this.client = new MongoClient(this.uri);
    this.db = null;
  }

  async connect() {
    console.log("MONGO_USERNAME:", process.env.MONGO_USERNAME);
    console.log("MONGO_PASSWORD:", process.env.MONGO_PASSWORD);
    console.log("MONGO_URI:", process.env.MONGO_URI);
    console.log("DB Name:", process.env.dbName);

    try {
      // console.log(this.uri);
      // console.log(this.dbName);
      await this.client.connect();
      console.log("✅ Connected successfully to MongoDB!");
      this.db = this.client.db(this.dbName);
    } catch (error) {
      console.error("Error:", error);
      throw error;
    }
  }

  async getDb() {
    if (!this.db) {
      throw new Error("Database connection has not been established.");
    }
    return this.db;
  }
}

// const username = process.env.MONGO_USERNAME;
// const password = process.env.MONGO_PASSWORD;
// const uris = process.env.MONGO_URI;
const username = "seema_26";
const password = "Mongo@2611";
const uris = "cluster0.vlvupsx.mongodb.net";
const uri = `mongodb+srv://${username}:${encodeURIComponent(
  password
)}@${uris}/?retryWrites=true&w=majority`;

// console.log(uri);
const dbName = process.env.dbName;

const database = new Database(uri, "clothing");

// Export a function to connect to the database and return the database instance
async function connectDatabase() {
  await database.connect();
  return database;
}

module.exports = { connectDatabase };
