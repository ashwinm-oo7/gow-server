const redis = require("redis");
const dotenv = require("dotenv");
dotenv.config();

const client = redis.createClient({
  url: process.env.REDIS_URL, // Ensure this is correct
  socket: { tls: true }, // Use TLS for Upstash
});

client.on("error", (err) => console.error("Redis Client Error:", err));

(async () => {
  try {
    await client.connect();
    console.log("✅ Connected to Redis successfully!");
  } catch (err) {
    console.error("❌ Redis Connection Failed:", err);
  }
})();

module.exports = client;
