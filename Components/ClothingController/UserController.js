const express = require("express");
const router = express.Router();
const db = require("../../db");
const EncryptionDecryption = require("../Utility/EncryptionDecryption.js");
const { ObjectId } = require("mongodb");
const emailService = require("../Utility/EmailService.js");
const { forgotTemplate, signUP } = require("../Template/Template.js");
const useragent = require("express-useragent");
router.use(useragent.express());
const crypto = require("crypto");
const { OAuth2Client } = require("google-auth-library");
const client = new OAuth2Client(
  "336125404447-90vb4ndqndqtf1va7444lcl9us1quqle.apps.googleusercontent.com"
);
console.log("client", client);
// Middleware for rate limiting
const rateLimit = require("express-rate-limit");

const signUpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 5 requests per windowMs
  message: "Too many sign-up attempts from this IP, please try again later.",
});

// Function to generate a random OTP
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000);
}

router.post("/google-signin", async (req, res) => {
  const { token } = req.body;

  try {
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const { email, given_name, family_name, picture } = payload;
    console.log("payload", payload);
    const dbInstance = await db.connectDatabase();
    const db1 = await dbInstance.getDb();
    const customerCollection = db1.collection("customer");
    const loginTimePeriodCollection = db1.collection("loginTimePeriod");

    // Check if the email exists in the database
    let user = await customerCollection.findOne({ email });

    // Check if user exists or create a new user in the database
    if (!user) {
      user = await customerCollection.insertOne({
        email,
        firstName: given_name,
        lastName: family_name,
        picture,
        signupMethod: "google",
        createdAt: new Date().toISOString(),
        verify: true, // assuming user is verified
      });
    }
    const update_at = new Date();
    try {
      const activeSession = await loginTimePeriodCollection.findOne(
        { userId: user._id, logoutTime: null },
        { sort: { loginTime: -1 } }
      );

      if (activeSession) {
        await loginTimePeriodCollection.updateOne(
          { _id: activeSession._id },
          { $set: { logoutTime: update_at } }
        );
        console.log(`Previous session logged out for userID: ${user._id}`);
      }
    } catch (sessionError) {
      console.warn(
        "Issue with logging out previous session. Proceeding with new login."
      );
    }

    await customerCollection.updateOne(
      { email },
      { $set: { lastLogin: update_at } }
    );

    const latestLoginRecord = await loginTimePeriodCollection.findOne(
      { userId: user._id },
      { sort: { loginTime: -1 } }
    );

    // Determine the new login count
    const newLoginCount = latestLoginRecord
      ? latestLoginRecord.loginCount + 1
      : 1;

    // Record login time in loginTimePeriod collection
    const loginRecord = {
      email,
      userId: user._id,
      loginTime: update_at,
      logoutTime: null,
      device: {
        family: req.useragent.platform || "Unknown",
        model: req.useragent.os || "Unknown",
      },
      loginCount: newLoginCount, // Add login count to the record
    };

    await loginTimePeriodCollection.insertOne(loginRecord);
    console.log(
      `Login recorded for userId ${user._id} with loginCount: ${newLoginCount}`
    );
    // Respond with user details
    res.status(200).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      picture: user.picture,
    });
  } catch (error) {
    console.error("Error verifying Google token:", error);
    res.status(400).json({ message: "Invalid Google token." });
  }
});
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    // Access the MongoDB database instance
    const dbInstance = await db.connectDatabase();
    const db1 = await dbInstance.getDb();
    const customerCollection = db1.collection("customer");

    // Check if the email exists in the database
    const existingUser = await customerCollection.findOne({ email });

    if (!existingUser) {
      return res.status(404).json({ message: "User not found" });
    }

    // Generate OTP
    const otp = generateOTP();

    console.log("OTP ", otp);

    const timestamp = new Date().getTime();
    await customerCollection.updateOne(
      { email: email },
      { $set: { otp: otp, otpTimestamp: timestamp } }
    );

    let template = forgotTemplate(otp);
    emailService("Maurya : Password Reset OTP", template, email);

    res.status(200).json({ message: "OTP sent successfully" });

    setTimeout(async () => {
      await customerCollection.updateOne(
        { email: email },
        { $unset: { otp: "", otpTimestamp: "" } }
      );
    }, 60000); // 60000 milliseconds = 1 minute
  } catch (error) {
    console.error("Error sending OTP:", error);
    res.status(500).json({ message: "Failed to send OTP" });
  }
});

router.post("/reset-password", async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    // Access the MongoDB database instance
    const dbInstance = await db.connectDatabase();
    const db1 = await dbInstance.getDb();
    const customerCollection = db1.collection("customer");

    // Verify OTP (in a real-world scenario, you'd store OTPs in a database)
    // For simplicity, we'll assume the OTP is correct
    const user = await customerCollection.findOne({ email });

    // Check if OTP is expired
    const currentTimestamp = new Date().getTime();
    const otpTimestamp = user.otpTimestamp;
    if (currentTimestamp - otpTimestamp > 60000) {
      // 60000 milliseconds = 1 minute
      return res
        .status(400)
        .json({ message: "OTP expired. Please resend OTP." });
    }

    const storedOTP = user.otp.toString(); // Convert stored OTP to string
    const providedOTP = otp.toString(); // Convert provided OTP to string
    console.log("Stored OTP:", storedOTP);
    console.log("Provided OTP:", providedOTP);

    if (storedOTP !== providedOTP) {
      console.log("OTP comparison failed");
      return res.status(400).json({ message: "Invalid OTP" });
    }
    // Encrypt the new password before updating it in the database
    const encryptedNewPassword =
      await EncryptionDecryption.encrypt(newPassword);
    const update_at = new Date().toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
    });

    // Update the user's password in the database
    const updatedUser = await customerCollection.updateOne(
      { email: email },
      {
        $set: {
          password: encryptedNewPassword,
          otp: null,
          otpTimestamp: null,
          update_at: update_at,
        },
      }
    );

    console.log("OTPPASSWORD", updatedUser);
    res.status(200).json({ message: "Password reset successful" });
  } catch (error) {
    console.error("Error resetting password:", error);
    res.status(500).json({ message: "Failed to reset password" });
  }
});

router.post("/emailExists", async (req, res) => {
  try {
    const { email } = req.body;

    // Access the MongoDB database instance
    const dbInstance = await db.connectDatabase();
    const db1 = await dbInstance.getDb();
    const customerCollection = db1.collection("customer");

    // Check if the email exists in the database
    const existingUser = await customerCollection.findOne({ email });

    if (existingUser) {
      // Email exists
      return res.status(200).json({ exists: true });
    } else {
      // Email does not exist
      return res.status(200).json({ exists: false });
    }
  } catch (error) {
    console.error("Error checking if email exists:", error);
    res.status(500).json({ message: "Failed to check email existence" });
  }
});

router.put("/changePassword/:id", async (req, res) => {
  try {
    const userId = req.params.id;
    const { oldPassword, newPassword } = req.body;

    // Access the MongoDB database instance
    const dbInstance = await db.connectDatabase();
    const db1 = await dbInstance.getDb();
    const customerCollection = db1.collection("customer");

    // Retrieve the user by ID from the database
    const user = await customerCollection.findOne({
      _id: new ObjectId(userId),
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Decrypt the stored password and compare it with the old password provided by the user
    let dbUserPass = "";
    await EncryptionDecryption.decrypt(user.password).then(
      (encryptedPassword) => {
        dbUserPass = encryptedPassword;
      }
    );

    if (dbUserPass !== oldPassword) {
      return res.status(401).json({ message: "Incorrect old password" });
    }

    // Encrypt the new password before updating it in the database
    const encryptedNewPassword =
      await EncryptionDecryption.encrypt(newPassword);

    // Update the user's password in the database
    const updatedUser = await customerCollection.updateOne(
      { _id: new ObjectId(userId) },
      { $set: { password: encryptedNewPassword } }
    );

    res.status(200).json({ message: "Password updated successfully" });
  } catch (error) {
    console.error("Error updating password:", error);
    res.status(500).json({ message: "Failed to update password" });
  }
});

router.post("/signup", signUpLimiter, async (req, res) => {
  // console.log("API Called from REACT JS");
  const { firstName, lastName, email, password } = req.body;

  try {
    const dbInstance = await db.connectDatabase();
    const db1 = await dbInstance.getDb();
    const customerCollection = db1.collection("customer");

    // const createdAt = new Date(Date.now() + 330 * 60 * 1000);
    const existingUser = await customerCollection.findOne({ email });

    if (existingUser) {
      return res.status(400).json({ message: "Email already exists" });
    }

    const createdAt = new Date().toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
    });
    const entity = req.body;
    entity.createdAt = createdAt;
    entity.signupMethod = "custom";
    // console.log(entity.password);

    let encPwd = "";
    await EncryptionDecryption.encrypt(entity.password).then(
      (encryptedPassword) => {
        console.log("Plain encrypted string password:", encryptedPassword);
        encPwd = encryptedPassword;
      }
    );
    // console.log("ENCPWD", await encPwd);
    entity.password = await encPwd;

    const savedCustomer = await customerCollection.insertOne(entity);
    // console.log("DETAILS NOW : ", savedCustomer, "ENTITY", entity);
    const otp = generateOTP();
    const timestamp = new Date().getTime();
    await customerCollection.updateOne(
      { email: entity.email },
      { $set: { otp: otp, otpTimestamp: timestamp } }
    );

    // await transporter.sendMail({
    //   from: '"Maurya" <ashwinmaurya1997@gmail.com>', // Replace with your organization name
    //   replyTo: `"Maurya"<do-not-reply@Maurya>`,
    //   to: entity.email,
    //   subject: "Maurya : OTP for Email Verification",
    //   html: `
    //   <div style="display: flex; align-items: center;">
    //   <div style="flex: 0 0 auto; margin-right: 20px;">
    //   <img src="https://i.ibb.co/M23HzTF/9-Qgzvh-Logo-Makr.png"
    //   title="Maurya" alt="Maurya Logo" style="display: block; margin: 0 auto; width: 40px; height: auto;">
    //   </div>
    //   <div style="flex: 1;">
    //   <p><strong><a href="www.Maurya" class="red-bold"  title="www.Maurya">Maurya</a></strong></p>
    //   <p>Your OTP for email verification is:<h1> ${otp} </h1></p>
    //   <p>Do not share this OTP with anyone else.</p>

    //   <p><a href="https://www.instagram.com/ashwin_oo7?utm_source=ig_web_button_share_sheet&igsh=ZDNlZDc0MzIxNw=="><img src="https://cdn-icons-png.flaticon.com/512/3621/3621435.png" title="follow us on instagram" alt="Instagram" width="25px" height="25px"></a></p>
    //   <p><a href="https://www.facebook.com/ASHMI6oo7/"><img src="https://img.freepik.com/free-psd/3d-square-with-facebook-logo_125540-1565.jpg" title="follow us on facebook" alt="facebook" width="25px" height="25px"></a></p>

    // </div>
    // </div>
    //   `,
    //   headers: {
    //     "signed-by": "Maurya",
    //   },
    // });

    let template = signUP(otp);
    emailService("Maurya : OTP for Email Verification", template, entity.email);

    setTimeout(async () => {
      const user = await customerCollection.findOne({ email: entity.email });
      if (user && user.verify !== true) {
        // User didn't verify OTP within one minute, delete the signup details
        await customerCollection.deleteOne({ email: entity.email });
        console.log(
          "Signup details deleted for unverified user:",
          entity.email
        );
      }
    }, 60000); // 60000 milliseconds = 1 minute

    res.status(201).json(savedCustomer);
  } catch (error) {
    console.error("Error during signup:", error.message);
    res.status(500).json("Failed to signup. Please try again later.");
  }
});

router.post("/verify-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;

    const dbInstance = await db.connectDatabase();
    const db1 = await dbInstance.getDb();
    const customerCollection = db1.collection("customer");

    const user = await customerCollection.findOne({ email });
    // const storedOTP = user.otp.toString();
    console.log("USEREMAIL", user, "OTP GENERAE,otp", otp);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    const currentTimestamp = new Date().getTime();
    const otpTimestamp = user.otpTimestamp;
    if (currentTimestamp - otpTimestamp > 60000) {
      // 60000 milliseconds = 1 minute
      return res
        .status(400)
        .json({ message: "OTP expired. Please resend OTP." });
    }

    if (!user.otp) {
      console.error("No OTP found for user:", user);
      return res.status(400).json({ message: "No OTP found for user" });
    }

    // Check if the provided OTP matches the stored OTP
    if (user.otp.toString() !== otp.toString()) {
      console.error("Invalid OTP for user:", user);
      return res.status(400).json({ message: "Invalid OTP" });
    }

    await customerCollection.updateOne(
      { email: email },
      { $set: { otp: null, otpTimestamp: null, verify: true } }
    );

    res.status(200).json({ message: "OTP verified successfully" });
  } catch (error) {
    console.error("Error verifying OTP:", error);
    res.status(500).json({ message: "Failed to verify OTP" });
  }
});

function getCurrentISTDateTime() {
  return new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
}

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required" });
    }

    const dbInstance = await db.connectDatabase();
    console.log("Successfully connected to the database");

    const db1 = await dbInstance.getDb();
    const customerCollection = db1.collection("customer");
    const loginTimePeriodCollection = db1.collection("loginTimePeriod");

    const user = await customerCollection.findOne({ email });

    if (!user) {
      // If user not found in the database, return 404 status
      return res.status(404).json("Customer not found");
    }
    if (user.signupMethod === "google") {
      return res
        .status(403)
        .json({
          success: false,
          message:
            "This account was created using Google Sign-In. Please log in using Google.",
        });
    }
    // Decrypt the password
    let dbUserPass = await EncryptionDecryption.decrypt(user.password);
    console.log(dbUserPass, password);
    if (dbUserPass !== password) {
      return res.status(401).json("Credentials issue!");
    }

    // Handle active session
    try {
      const activeSession = await loginTimePeriodCollection.findOne(
        { userId: user._id, logoutTime: null },
        { sort: { loginTime: -1 } }
      );

      if (activeSession) {
        const update_at = new Date();
        await loginTimePeriodCollection.updateOne(
          { _id: activeSession._id },
          { $set: { logoutTime: update_at } }
        );
        console.log(`Previous session logged out for userID: ${user._id}`);
      }
    } catch (sessionError) {
      console.warn(
        "Issue with logging out previous session. Proceeding with new login."
      );
    }

    const update_at = new Date(); // Store as Date object

    await customerCollection.updateOne(
      { email },
      { $set: { lastLogin: update_at } }
    );

    const latestLoginRecord = await loginTimePeriodCollection.findOne(
      { userId: user._id },
      { sort: { loginTime: -1 } }
    );

    // Determine the new login count
    const newLoginCount = latestLoginRecord
      ? latestLoginRecord.loginCount + 1
      : 1;

    // Record login time in loginTimePeriod collection
    const loginRecord = {
      email,
      userId: user._id,
      loginTime: update_at,
      logoutTime: null,
      device: {
        family: req.useragent.platform || "Unknown",
        model: req.useragent.os || "Unknown",
      },
      loginCount: newLoginCount, // Add login count to the record
    };

    await loginTimePeriodCollection.insertOne(loginRecord);
    console.log(
      `Login recorded for userId ${user._id} with loginCount: ${newLoginCount}`
    );

    // Send the response only once, after all operations are complete
    return res.status(200).json(user);
  } catch (error) {
    console.error("Error while fetching profile:", error.message);
    // Ensure only one response is sent in case of an error
    if (!res.headersSent) {
      return res
        .status(500)
        .json("Failed to fetch profile. Please try again later.");
    }
  }
});

router.post("/logout/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;
    console.log("userID:" + userId);

    if (!ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid User ID format" });
    }

    // Access the MongoDB database instance
    const dbInstance = await db.connectDatabase();
    const db1 = await dbInstance.getDb();
    const loginTimePeriodCollection = db1.collection("loginTimePeriod");

    // Find the most recent login record for the user
    const lastLoginRecord = await loginTimePeriodCollection.findOne(
      { userId: new ObjectId(userId), logoutTime: null },
      { sort: { loginTime: -1 } }
    );

    if (!lastLoginRecord) {
      console.log("No login record found");
      // return res.status(404).json({ message: "No active session found" });
      return res.status(200).json({ message: "You have been logged out." });
    }

    // Update the logout time in the loginTimePeriod collection
    // const update_at = getCurrentISTDateTime();
    const update_at = new Date(); // Store as Date object

    await loginTimePeriodCollection.updateOne(
      { _id: lastLoginRecord._id },
      { $set: { logoutTime: update_at } }
    );
    console.log("LOGOUT");
    res.status(200).json({ message: "Logout successful" });
  } catch (error) {
    console.error("Error during logout:", error);
    res
      .status(500)
      .json({ message: "Failed to logout. Please try again later." });
  }
});

// Function to get all login records with user details
router.get("/loginRecords", async (req, res) => {
  try {
    // Access the MongoDB database instance
    const dbInstance = await db.connectDatabase();
    const db1 = await dbInstance.getDb();
    const customerCollection = db1.collection("customer");
    const loginTimePeriodCollection = db1.collection("loginTimePeriod");

    // Aggregate login records with user details
    const records = await loginTimePeriodCollection
      .aggregate([
        {
          $lookup: {
            from: "customer",
            localField: "userId",
            foreignField: "_id",
            as: "userDetails",
          },
        },
        { $unwind: "$userDetails" },
        {
          $project: {
            userId: 1,
            email: "$userDetails.email",
            loginCount: 1,
            loginTime: { $toDate: "$loginTime" },
            logoutTime: { $toDate: "$logoutTime" },
            device: 1,
            totalDuration: {
              $cond: {
                if: { $and: ["$loginTime", "$logoutTime"] },
                then: { $subtract: ["$logoutTime", "$loginTime"] },
                else: null,
              },
            },
          },
        },
      ])
      .toArray();

    res.status(200).json(records);
  } catch (error) {
    console.error("Error fetching login records:", error);
    res.status(500).json({
      message: "Failed to fetch login records. Please try again later.",
    });
  }
});

router.get("/profile/:id", async (req, res) => {
  try {
    const id = req.params.id;
    if (!id) {
      return res.status(400).json({ message: "ID parameter is missing" });
    }
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid ID format" });
    }
    console.log("USER", new ObjectId(id));

    // const customer = await Customer.findById(id);
    const dbInstance = await db.connectDatabase();
    const db1 = await dbInstance.getDb();
    const customerCollection = db1.collection("customer");

    // Find the user profile by ID
    const customer = await customerCollection.findOne({
      _id: new ObjectId(id),
    });
    if (customer) {
      res.status(200).json(customer);
    } else {
      res.status(404).json({ message: "Customer not found" });
    }
  } catch (error) {
    console.error("Error fetching user profile:", error);
    res
      .status(500)
      .json({ message: "Failed to fetch profile. Please try again later." });
  }
});

// PUT update user profile by ID
router.put("/profile/update/:id", async (req, res) => {
  try {
    const userId = req.params.id;
    const updatedProfile = req.body;
    updatedProfile.update_at = new Date().toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
    });

    // console.log("Userid or Update", userId, updatedProfile);

    // const updatedUser = await Customer.findByIdAndUpdate(
    //   userId,
    //   updatedProfile,
    //   { new: true }
    // );

    const dbInstance = await db.connectDatabase();
    const db1 = await dbInstance.getDb();
    const customerCollection = db1.collection("customer");

    const updatedUser = await customerCollection.updateOne(
      { _id: new ObjectId(userId) },
      { $set: updatedProfile }
    );

    if (Object.keys(updatedProfile).length === 0) {
      return res.status(400).json({ error: "Request body is empty" });
    }

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }
    res.status(200).json(updatedUser);
  } catch (error) {
    console.error("Error updating user profile:", error);
    res.status(500).json({ message: "Failed to update user profile" });
  }
});

router.get("/getAllProfile", async (req, res) => {
  try {
    // Access the MongoDB database instance
    const dbInstance = await db.connectDatabase();
    const db1 = await dbInstance.getDb();
    const categoryCollection = db1.collection("customer");

    const profiles = await categoryCollection.find().toArray();
    // console.log("ALLPROFILE", profiles);
    res.status(200).json(profiles);
  } catch (error) {
    console.error("Error fetching profiles:", error);
    res.status(500).json({ message: "Failed to fetch profiles" });
  }
});

router.post("/store-redirect-url", async (req, res) => {
  try {
    const { userEmail, redirectUrl } = req.body;
    const dbInstance = await db.connectDatabase();
    const db1 = await dbInstance.getDb();
    const collection = db1.collection("redirectUrls");

    // Store the redirectUrl in the session
    await collection.updateOne(
      { userEmail },
      { $set: { redirectUrl } },
      { upsert: true }
    );

    res.sendStatus(200);
  } catch (error) {
    console.error("Error storing redirect URL:", error.message);
    res.status(500).send("Failed to store redirect URL.");
  }
});

module.exports = router;
