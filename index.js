const { MongoClient } = require("mongodb");

// Replace the uri string with your connection string.
const uri = "";

const client = new MongoClient(uri);

async function run() {
  try {
    await client.connect();

    const database = client.db("clothing");
    const movies = database.collection("customer");

    const query = {};

    // Use find() instead of findOne() to get all documents
    const cursor = movies.find(query);

    // Iterate over the cursor to access each document
    await cursor.forEach((document) => {
      // console.log("-----------------------------------", document);
    });
  } finally {
    // Ensures that the client will close when you finish/error
    await client.close();
  }
}
run().catch(console.dir);
