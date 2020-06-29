const { db, admin } = require("../utilities/admin");
const firebaseConfig = require("../utilities/config");
const validator = require("validator");
const uniqid = require("uniqid");

//Admin information for receiving all recent users and data for approval
exports.getLatestAdminData = (req, res) => {
  if (req.user.role === 3) {
    let latestUsers = [];
    let upgradeUser = [];
    let unverifiedViruses = [];
    let unverifiedSymptoms = [];
    db.collection("users")
      .orderBy("createdAt", "desc")
      .limit(10)
      .get()
      .then((data) => {
        data.forEach((doc) => {
          latestUsers.push({
            ...doc.data(),
            username: doc.id,
          });
        });
        return db
          .collection("viruses")
          .where("approved", "==", false)
          .orderBy("createdAt", "desc")
          .limit(10)
          .get();
      })
      .then((data) => {
        data.forEach((doc) => {
          unverifiedViruses.push({
            ...doc.data(),
            name: doc.id,
          });
        });
        return db
          .collection("symptoms")
          .where("approved", "==", false)
          .orderBy("createdAt", "desc")
          .limit(10)
          .get();
      })
      .then((data) => {
        data.forEach((doc) => {
          unverifiedSymptoms.push({
            ...doc.data(),
            name: doc.id,
          });
        });
      })
      .then(() => {
        return db
          .collection("users")
          .orderBy("createdAt", "desc")
          .where("role", "==", 0)
          .limit(10)
          .get()
          .then((data) => {
            data.forEach((doc) => {
              upgradeUser.push({
                ...doc.data(),
                username: doc.id,
              });
            });
          });
      })
      .then(() => {
        return res.status(200).json({
          users: latestUsers,
          approveUsers: upgradeUser,
          viruses: unverifiedViruses,
          symptoms: unverifiedSymptoms,
        });
      })
      .catch((err) => {
        console.error(err);
        res.status(500).json({ error: err.code });
      });
  } else {
    return res.status(403).json({ message: "Forbidden Access" });
  }
};

exports.getDataToDelete = (req, res) => {
  if (req.user.role === 3) {
    let virusDelete = [];
    let symptomsDelete = [];
    return db
      .collection("viruses")
      .where("pendingDeletion", "==", true)
      .orderBy("createdAt", "desc")
      .limit(10)
      .get()
      .then((data) => {
        data.forEach((doc) => {
          virusDelete.push({
            ...doc.data(),
            name: doc.id,
          });
        });
        return db
          .collection("symptoms")
          .where("pendingDeletion", "==", true)
          .orderBy("createdAt", "desc")
          .limit(10)
          .get();
      })
      .then((data) => {
        data.forEach((doc) => {
          symptomsDelete.push({
            ...doc.data(),
            name: doc.id,
          });
          return res
            .status(200)
            .json({ viruses: virusDelete, symptoms: symptomsDelete });
        });
      });
  } else {
    return res.status(403).json({ message: "Forbidden Access" });
  }
};
