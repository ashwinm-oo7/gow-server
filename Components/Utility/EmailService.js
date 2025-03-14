const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.Email_UserName, // Your Gmail address
    pass: process.env.Email_Password, // Your Gmail password
  },
});

module.exports = async function emailService(subject, template, to) {
  await transporter.sendMail({
    from: '"Maurya" <ashwinmaurya1997@gmail.com>', // Replace with your organization name
    replyTo: `"Maurya"<do-not-reply@Maurya>`,
    to: to,
    subject: subject,

    html: template,
  });
};
