// permissions.js
const permissions = {
  admin: ["ProductController.js", "UserController.js", "OrderController.js"],
  developer: ["ProductController.js", "OrderController.js"],
  user: [], // regular users have no access to these files
};

module.exports = permissions;
