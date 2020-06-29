const { db, admin } = require("../utilities/admin");
const firebaseConfig = require("../utilities/config");
const validator = require("validator");
const uniqid = require("uniqid");

exports.uploadResults = (req, res) => {
  if (req.body.answers.length === 0) {
    return res.status(400).json({ error: "Missing Answers." });
  }
  if (
    req.body.hasOwnProperty("correctAnswers") &&
    req.body.hasOwnProperty("wrongAnswers")
  ) {
    const uploadAnswers = req.body;
    uploadAnswers.answeredBy = req.user.username;
    uploadAnswers.answeredAt = new Date().toISOString();
    db.collection("quiz")
      .add(uploadAnswers)
      .then(() => {
        return db
          .collection("users")
          .doc(req.user.username)
          .update({
            quizAnswered: admin.firestore.FieldValue.increment(1),
          })
          .then(() => {
            return res.status(201).json({ message: "Quiz Results Inserted." });
          });
      })
      .catch((err) => {
        console.error(err);
        res.status(500).json({ error: err.code });
      });
  } else {
    return res.status(400).json({ error: "Bad Request. Missing Answers." });
  }
};

exports.getUserResults = (req, res) => {
  db.collection("quiz")
    .where("answeredBy", "==", req.user.username)
    .orderBy("answeredAt", "desc")
    .limit(5)
    .get()
    .then((snapshot) => {
      let quizResults = [];
      snapshot.forEach((doc) => {
        quizResults.push(doc.data());
      });
      return res.status(200).json(quizResults);
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json({ error: err.code });
    });
};

exports.getAllResults = (req, res) => {
  db.collection("users")
    .orderBy("quizAnswered", "desc")
    .limit(5)
    .get()
    .then((snapshot) => {
      let users = [];
      snapshot.forEach((doc) => {
        users.push(doc.data());
      });
      return res.status(200).json(users);
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json({ error: err.code });
    });
};
