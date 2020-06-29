const functions = require("firebase-functions");

const express = require("express");
const app = express();
const { db, admin } = require("./utilities/admin");

//CORS policy for getting and sending information through the HTTP
const cors = require("cors")({ origin: true });
app.use(cors);

const { removeSpecificItem } = require("./utilities/helpers");

const firebaseAuth = require("./utilities/fbAuth");

//Retrieving information from other routes
const {
  signup,
  login,
  uploadImage,
  addUserDetails,
  getAuthenticatedUser,
  getUserDetails,
  getTopUsers,
  upgradeRoleUser,
} = require("./handlers/users");

const {
  addNewVirus,
  getVirusInfo,
  deleteVirus,
  updateVirus,
  uploadVirusImage,
  getViruses,
  approveVirus,
  requestVirusDeletion,
} = require("./handlers/viruses");

const {
  addNewSymptom,
  getSymptomInfo,
  deleteSymptom,
  updateSymptom,
  getSymptoms,
  uploadSymptomImage,
  getSymptomImages,
  approveSymptom,
  requestSymptomDeletion,
} = require("./handlers/symptoms");

const {
  uploadResults,
  getUserResults,
  getAllResults,
} = require("./handlers/quiz");

const { getLatestAdminData, getDataToDelete } = require("./handlers/admin");

exports.corsEnabledFunction = (req, res) => {
  // Set CORS headers for preflight requests
  // Allows GETs from any origin with the Content-Type header
  // and caches preflight response for 3600s

  res.set("Access-Control-Allow-Origin", "*");

  if (req.method === "OPTIONS") {
    // Send response to OPTIONS requests
    res.set("Access-Control-Allow-Methods", "GET");
    res.set("Access-Control-Allow-Headers", "Content-Type");
    res.set("Access-Control-Max-Age", "3600");
    res.status(204).send("");
  } else {
    res.send("Hello World!");
  }
};

//Virus/Infections (About added in the documentation)
app.post("/virus", firebaseAuth, addNewVirus);
app.post("/virus/image", firebaseAuth, uploadVirusImage);
app.get("/virus/:virusId", getVirusInfo);
app.delete("/virus/:virusId", firebaseAuth, deleteVirus);
app.post("/virus/:virusId", firebaseAuth, updateVirus);
app.get("/viruses", getViruses); //get all viruses for quiz
app.put("/delete/virus/:virusName", firebaseAuth, requestVirusDeletion);

//Symptoms (About added in the documentation)
app.post("/symptom", firebaseAuth, addNewSymptom);
app.post("/symptom/image", firebaseAuth, uploadSymptomImage);
app.get("/symptom/:symptomName", getSymptomInfo);
app.get("/symptoms", getSymptoms);
app.delete("/symptom/:symptomName", firebaseAuth, deleteSymptom);
app.post("/symptom/:symptomName", firebaseAuth, updateSymptom);
app.get("/symptoms/images", getSymptomImages); //get images of the symptoms
app.put("/delete/symptom/:symptomName", firebaseAuth, requestSymptomDeletion);

//Signup/Login Routes
app.post("/signup", signup); //send user information to the firebase where authentication is done and user information is added to the database
app.post("/login", login); //login that checks if the user exists through firebase authentication
app.post("/user/image", firebaseAuth, uploadImage); //uploading images
app.post("/user", firebaseAuth, addUserDetails); //uploading user infotmation
app.get("/user", firebaseAuth, getAuthenticatedUser); //getting the user's infotmation used for sending results back to the database
app.get("/user/:username", getUserDetails); //get User Data (such as symptoms and viruses)
app.get("/users/top", getTopUsers); //get Top Users

//Quiz Routes
app.post("/results", firebaseAuth, uploadResults); //Sending the results of the quiz to the database
app.get("/results/user", firebaseAuth, getUserResults); //Get Users Last 5 Quiz Results
app.get("/results", getAllResults); //Get 5 Most Recent Results

//Admin routes
app.get("/admin", firebaseAuth, getLatestAdminData); //Get information about latest users, unverified viruses and symptoms
app.put("/admin/user/:username", firebaseAuth, upgradeRoleUser); //Upgrade user to trusted
app.put("/admin/symptom/:symptomName", firebaseAuth, approveSymptom); //Approve symptom for the quiz
app.put("/admin/virus/:virusName", firebaseAuth, approveVirus); //Approve virus for the quiz
app.get("/admin/data/delete", firebaseAuth, getDataToDelete); //Check for new data that needs to be deleted

exports.api = functions.region("europe-west1").https.onRequest(app);

//Triggers for deletion
/*
 * In case user deletes his username all information and data made by that user is deleted
 */
exports.deleteEverythingOnUserDelete = functions
  .region("europe-west1")
  .firestore.document("/users/{id}")
  .onDelete((snapshot, context) => {
    const userId = context.params.id;
    const batch = db.batch();
    return db
      .collection("viruses")
      .where("createdBy", "==", userId)
      .get()
      .then((data) => {
        data.forEach((document) => {
          batch.delete(db.doc(`/viruses/${document.id}`));
        });
        return db.collection("symptoms").where("createdBy", "==", userId).get();
      })
      .then((data) => {
        data.forEach((document) => {
          batch.delete(db.doc(`/symptoms/${document.id}`));
        });
        return batch.commit();
      })
      .catch((err) => {
        console.error(err);
      });
  });

/*
 * In case user deletes his symptom that symptom is removed from all viruses in the array list
 */
exports.deleteVirusDetailOnSymptomDelete = functions
  .region("europe-west1")
  .firestore.document("/symptoms/{id}")
  .onDelete((snapshot, context) => {
    const symptom = context.params.id;
    const batch = db.batch();
    return db
      .collection("viruses")
      .where("symptoms", "array-contains", symptom)
      .get()
      .then((data) => {
        data.forEach((document) => {
          batch.update(db.doc(`/viruses/${document.id}`), {
            symptoms: removeSpecificItem(document.data().symptoms, symptom),
          });
        });
        return batch.commit();
      })
      .catch((err) => console.error(err));
  });
