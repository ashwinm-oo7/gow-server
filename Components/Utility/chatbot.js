const WebSocket = require("ws");

// Sample predefined questions and answers
const predefinedQuestions = [
  // Greetings and General Information
  { question: "hello", answer: "Hello, welcome to the Maurya Shopping World!" },
  { question: "hi", answer: "Hi there! How can I assist you today?" },
  {
    question: "who are you?",
    answer: "I'm your shopping assistant. How can I help you today?",
  },
  {
    question: "offer",
    answer:
      "Yes, we have seasonal sales and promotional discounts. Subscribe to our newsletter to stay updated.",
  },

  {
    question: "what is your name?",
    answer:
      "I'm the Maurya Shopping World chatbot, here to assist you with your queries.",
  },
  {
    question: "how can you help me?",
    answer:
      "I can assist you with questions about our products, orders, returns, and more.",
  },

  // Product Information
  {
    question: "what types of clothing do you offer?",
    answer:
      "We offer a wide range of women's clothing including dresses, tops, bottoms, outerwear, and more.",
  },
  {
    question: "do you have new arrivals?",
    answer:
      "Yes, we frequently update our collection with new arrivals. Check the 'New Arrivals' section on our website.",
  },
  {
    question: "what sizes do you have?",
    answer:
      "We offer a variety of sizes from XS to XXL. Size availability may vary by item.",
  },
  {
    question: "do you have plus size clothing?",
    answer:
      "Yes, we offer a range of plus size clothing. You can find them in our Plus Size section.",
  },
  {
    question: "are the colors of the clothing items accurate?",
    answer:
      "We strive to display colors as accurately as possible, but there might be slight variations due to monitor settings.",
  },
  {
    question: "do you offer maternity clothing?",
    answer:
      "Yes, we offer a range of stylish and comfortable maternity clothing.",
  },
  {
    question: "do you have formal wear?",
    answer:
      "Yes, we offer a variety of formal wear including blazers, trousers, and dresses suitable for work and special occasions.",
  },
  {
    question: "what materials are your clothes made of?",
    answer:
      "Our clothing is made from a variety of materials including cotton, polyester, silk, and more. You can find specific material information on each product page.",
  },
  {
    question: "do you sell accessories?",
    answer:
      "Yes, we offer a range of accessories including scarves, belts, hats, and jewelry.",
  },
  {
    question: "do you have eco-friendly products?",
    answer:
      "Yes, we offer a selection of eco-friendly products made from sustainable materials. Look for the 'Eco-Friendly' tag on our product pages.",
  },

  // Payment and Discounts
  {
    question: "what are the available payment methods?",
    answer: "We accept credit cards, debit cards, and EMI options.",
  },
  {
    question: "do you offer discounts?",
    answer:
      "Yes, we have seasonal sales and promotional discounts. Subscribe to our newsletter to stay updated.",
  },
  {
    question: "how can I apply a discount code?",
    answer:
      "You can enter the discount code at checkout in the 'Promo Code' field.",
  },
  {
    question: "can I pay using EMI?",
    answer:
      "Yes, we offer EMI options on select credit cards. You can choose this option at checkout.",
  },
  {
    question: "do you offer student discounts?",
    answer:
      "Yes, we offer a special discount for students. Please provide your student ID at checkout to avail the discount.",
  },
  {
    question: "can I use multiple discount codes?",
    answer: "No, you can only use one discount code per order.",
  },
  {
    question: "do you offer first-time buyer discounts?",
    answer:
      "Yes, first-time buyers can avail a special discount. Use the code 'FIRSTBUY' at checkout.",
  },
  {
    question: "how do I know if my payment was successful?",
    answer:
      "You will receive a confirmation email once your payment is successful.",
  },
  {
    question: "can I get a refund if I cancel my order?",
    answer:
      "Yes, you will receive a full refund to your original payment method if you cancel your order before it is shipped.",
  },
  {
    question: "is it safe to use my credit card on your website?",
    answer:
      "Yes, we use secure encryption technology to protect your credit card information.",
  },

  // Shipping and Delivery
  {
    question: "what is your shipping policy?",
    answer:
      "We offer free shipping on orders above a certain amount. Delivery times vary by location.",
  },
  {
    question: "how long does delivery take?",
    answer:
      "Standard delivery usually takes 3-7 business days, depending on your location.",
  },
  {
    question: "can I track my order?",
    answer:
      "Yes, you can track your order using the tracking number provided in your shipping confirmation email.",
  },
  {
    question: "do you offer international shipping?",
    answer: "Currently, we ship only within India.",
  },
  {
    question: "what are your shipping rates?",
    answer:
      "Shipping rates vary based on the destination and the total weight of your order. You can view the shipping cost at checkout.",
  },
  {
    question: "do you offer express shipping?",
    answer:
      "Yes, we offer express shipping for an additional fee. You can choose this option at checkout.",
  },
  {
    question: "what should I do if my order is delayed?",
    answer:
      "If your order is delayed, please contact our customer service for assistance.",
  },
  {
    question: "can I change my shipping address after placing an order?",
    answer:
      "You can change your shipping address before your order is shipped. Please contact our customer service for assistance.",
  },
  {
    question: "do you offer cash on delivery?",
    answer: "Currently, we do not offer cash on delivery.",
  },
  {
    question: "what should I do if I receive a damaged item?",
    answer:
      "If you receive a damaged item, please contact our customer service for assistance and we will arrange a replacement or refund.",
  },

  // Returns and Exchanges
  {
    question: "what is the return policy?",
    answer: "You can return any item within 30 days of purchase.",
  },
  {
    question: "how do I return an item?",
    answer:
      "To return an item, please visit our Returns page and follow the instructions provided.",
  },
  {
    question: "can I exchange an item?",
    answer:
      "Yes, you can exchange an item within 30 days of purchase. Please contact our customer service for assistance.",
  },
  {
    question: "will I get a full refund for my return?",
    answer:
      "Yes, you will receive a full refund to your original payment method once we receive the returned item.",
  },
  {
    question: "how long does it take to process a return?",
    answer:
      "It usually takes 5-7 business days to process a return once we receive the item.",
  },
  {
    question: "do I need to pay for return shipping?",
    answer:
      "Return shipping is free for defective or damaged items. For other returns, a return shipping fee may apply.",
  },
  {
    question: "can I return sale items?",
    answer: "Yes, sale items can be returned within 30 days of purchase.",
  },
  {
    question: "how do I know if you received my return?",
    answer:
      "You will receive an email notification once we receive and process your return.",
  },
  {
    question: "can I return an item without the original packaging?",
    answer:
      "Items must be returned in their original packaging to be eligible for a refund.",
  },
  {
    question: "can I return an item I bought online to a physical store?",
    answer:
      "Currently, we operate exclusively online. Please return items using our online returns process.",
  },

  // Account and Orders
  {
    question: "how do I create an account?",
    answer:
      "You can create an account by clicking on the 'Sign Up' button at the top of our website.",
  },
  {
    question: "how do I reset my password?",
    answer:
      "You can reset your password by clicking on the 'Forgot Password' link on the login page.",
  },
  {
    question: "how can I view my order history?",
    answer:
      "You can view your order history by logging into your account and navigating to the 'My Orders' section.",
  },
  {
    question: "how do I update my shipping address?",
    answer:
      "You can update your shipping address in the 'Account Settings' section of your account.",
  },
  {
    question: "can I cancel my order?",
    answer:
      "You can cancel your order before it is shipped by contacting our customer service.",
  },
  {
    question: "how do I track my order?",
    answer:
      "You can track your order using the tracking number provided in your shipping confirmation email.",
  },
  {
    question: "can I change my order after placing it?",
    answer:
      "You can make changes to your order before it is shipped. Please contact our customer service for assistance.",
  },
  {
    question: "how do I update my account details?",
    answer:
      "You can update your account details in the 'Account Settings' section of your account.",
  },
  {
    question: "can I save items for later?",
    answer: "Yes, you can add items to your wishlist to save them for later.",
  },
  {
    question: "how do I delete my account?",
    answer:
      "To delete your account, please contact our customer service for assistance.",
  },

  // Customer Service
  {
    question: "how can I contact customer service?",
    answer:
      "You can contact our customer service via email at support@mauryashoppingworld.com or call us at +91-1234567890.",
  },
  {
    question: "what are your customer service hours?",
    answer:
      "Our customer service is available Monday to Friday from 9 AM to 6 PM IST.",
  },
  {
    question: "do you have a physical store?",
    answer: "Currently, we operate exclusively online.",
  },
  {
    question: "can I get assistance with sizing?",
    answer:
      "Yes, our customer service team can assist you with sizing. Please reach out to us via email or phone.",
  },
  {
    question: "how can I provide feedback?",
    answer:
      "You can provide feedback by contacting our customer service or leaving a review on our website.",
  },
  {
    question: "how do I know if an item is in stock?",
    answer: "You can check the stock availability on the product page.",
  },
  {
    question: "what should I do if I receive the wrong item?",
    answer:
      "If you receive the wrong item, please contact our customer service for assistance and we will arrange a replacement.",
  },
  {
    question: "can I speak to a manager?",
    answer:
      "Yes, you can request to speak to a manager by contacting our customer service.",
  },
  {
    question: "how do I make a complaint?",
    answer:
      "You can make a complaint by contacting our customer service via email or phone.",
  },
  {
    question: "how can I get help with an order?",
    answer:
      "For assistance with an order, please contact our customer service.",
  },

  // Others
  {
    question: "do you offer gift cards?",
    answer:
      "Yes, we offer gift cards in various denominations. You can purchase them on our website.",
  },
  {
    question: "how can I unsubscribe from the newsletter?",
    answer:
      "You can unsubscribe from the newsletter by clicking the 'Unsubscribe' link at the bottom of any newsletter email.",
  },
  {
    question: "how can I leave a review?",
    answer:
      "You can leave a review on the product page under the 'Reviews' section.",
  },
  {
    question: "do you have a loyalty program?",
    answer:
      "Yes, we offer a loyalty program with various benefits. Please visit our 'Loyalty Program' page for more details.",
  },
  {
    question: "what are the benefits of the loyalty program?",
    answer:
      "Our loyalty program offers exclusive discounts, early access to sales, and other special perks.",
  },
  {
    question: "how do I join the loyalty program?",
    answer:
      "You can join our loyalty program by signing up on our 'Loyalty Program' page.",
  },
  {
    question: "do you have a referral program?",
    answer:
      "Yes, we offer a referral program where you can earn rewards for referring friends. Please visit our 'Referral Program' page for more details.",
  },
  {
    question: "how do I refer a friend?",
    answer:
      "You can refer a friend by sharing your unique referral link available in your account.",
  },
  {
    question: "what is the referral reward?",
    answer:
      "Both you and your friend will receive a discount on your next purchase when they make their first order using your referral link.",
  },
  {
    question: "do you offer personal styling services?",
    answer:
      "Yes, we offer personal styling services. Please contact our customer service for more details.",
  },
  {
    question: "how can I find my size?",
    answer:
      "You can refer to our size guide available on each product page to find your size.",
  },
  {
    question: "do you have a mobile app?",
    answer:
      "Yes, we have a mobile app available for download on both iOS and Android platforms.",
  },
  {
    question: "how do I download the mobile app?",
    answer:
      "You can download our mobile app from the App Store or Google Play Store.",
  },
  {
    question: "do you offer free returns?",
    answer:
      "Yes, we offer free returns for defective or damaged items. For other returns, a return shipping fee may apply.",
  },
  {
    question: "how can I get a copy of my invoice?",
    answer:
      "You can download a copy of your invoice from the 'My Orders' section in your account.",
  },
  {
    question: "do you offer alterations?",
    answer: "Currently, we do not offer alteration services.",
  },
  {
    question: "can I place an order over the phone?",
    answer:
      "Currently, we only accept orders placed through our website or mobile app.",
  },
  {
    question: "do you offer customization?",
    answer: "Currently, we do not offer customization services.",
  },
  {
    question: "can I cancel my return request?",
    answer:
      "You can cancel your return request before it is processed. Please contact our customer service for assistance.",
  },
  {
    question: "do you offer wholesale?",
    answer:
      "Yes, we offer wholesale options. Please contact our customer service for more details.",
  },
  {
    question: "how can I become a supplier?",
    answer:
      "If you're interested in becoming a supplier, please contact our business development team via email at supplier@mauryashoppingworld.com.",
  },
];

const stringSimilarity = require("string-similarity");

function normalizeText(text) {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, "");
}

function getResponse(userInput) {
  const normalizedInput = normalizeText(userInput);
  const responses = [];

  // Check for exact match first
  let exactMatches = predefinedQuestions.filter(
    ({ question }) => normalizeText(question) === normalizedInput
  );

  // If no exact match, find all related questions and collect their answers
  if (exactMatches.length === 0) {
    predefinedQuestions.forEach(({ question, answer }) => {
      // Check for partial word matches
      const questionWords = normalizeText(question).split(" ");
      const inputWords = normalizedInput.split(" ");

      const isMatched = inputWords.some((inputWord) => {
        return questionWords.some((questionWord) => {
          return questionWord.includes(inputWord);
        });
      });

      if (isMatched) {
        responses.push({ question, answer });
      }
    });

    // Use string similarity to find additional related questions
    if (responses.length === 0) {
      const matches = stringSimilarity.findBestMatch(
        normalizedInput,
        predefinedQuestions.map((q) => normalizeText(q.question))
      );
      const threshold = 0.6; // Adjust as needed

      matches.ratings.forEach(({ target, rating }) => {
        if (rating >= threshold) {
          const matchedQuestion = predefinedQuestions.find(
            (q) => normalizeText(q.question) === target
          );
          if (matchedQuestion) {
            responses.push({
              question: matchedQuestion.question,
              answer: matchedQuestion.answer,
            });
          }
        }
      });
    }
  } else {
    exactMatches.forEach(({ question, answer }) => {
      responses.push({ question, answer });
    });
  }

  // Format responses with newline between each question and answer
  if (responses.length > 0) {
    return responses
      .map(({ question, answer }) => `${question}\n\n${answer}`)
      .join("\n\n");
  } else {
    return "Sorry, I don't understand the question.";
  }
}

const wss = new WebSocket.Server({ noServer: true });

wss.on("connection", (ws) => {
  ws.on("message", (message) => {
    console.log(`Received message => ${message}`);

    const userQuestion =
      typeof message === "string" ? message : String(message);
    const response = getResponse(userQuestion);

    ws.send(response);
  });

  ws.send("Welcome to the Maurya Shopping World chatbot! How can I help you?");
});

module.exports = wss;
