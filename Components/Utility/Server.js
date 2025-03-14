const express = require("express");
const bodyParser = require("body-parser");
const chatbotRoutes = require("./chatbot"); // Adjust path as necessary

const app = express();
app.use(bodyParser.json());

app.use("/api/chatbot", chatbotRoutes); // Add this line to integrate the chatbot route

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
