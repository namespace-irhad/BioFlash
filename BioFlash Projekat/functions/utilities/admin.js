//Admin setup
const admin = require("firebase-admin");
const config = require("./config");
admin.initializeApp({
  credential: admin.credential.cert(require("./serviceAccount.json")),
  databaseURL: "https://bioflashproject.firebaseio.com",
});
const db = admin.firestore();

module.exports = {
  admin,
  db,
};
