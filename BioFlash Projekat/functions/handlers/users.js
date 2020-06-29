const { db, admin } = require("../utilities/admin");
const firebaseConfig = require("../utilities/config");
const validator = require("validator");
const uniqid = require("uniqid");
const { reduceUserDetails } = require("../utilities/validators");

const firebase = require("firebase");
firebase.initializeApp(firebaseConfig);

exports.signup = (req, res) => {
  const newUser = {
    email: req.body.email,
    password: req.body.password,
    confirmPassword: req.body.confirmPassword,
    username: req.body.username,
  };

  let errors = {};
  if (validator.isEmpty(newUser.email)) {
    errors.email = "Must not be empty.";
  } else if (!validator.isEmail(newUser.email)) {
    errors.email = "Must be a valid email address.";
  }

  if (validator.isEmpty(newUser.password))
    errors.password = "Must not be empty.";
  if (newUser.password !== newUser.confirmPassword)
    errors.password = "Passwords must match.";
  if (validator.isEmpty(newUser.username))
    errors.username = "Must not be empty.";
  else if (!/^[a-zA-Z0-9_]{3,16}$/.test(newUser.username))
    errors.username = "Only use characters, numbers and _.";

  if (Object.keys(errors).length > 0) return res.status(400).json(errors);

  const noImg = "generic-profile.png";

  let token, userId;
  db.doc(`/users/${newUser.username}`)
    .get()
    .then((doc) => {
      if (doc.exists) {
        return res.status(400).json({
          username: "this username is taken.",
        });
      } else {
        return firebase
          .auth()
          .createUserWithEmailAndPassword(newUser.email, newUser.password);
      }
    })
    .then((data) => {
      userId = data.user.uid;
      console.log(userId);
      return data.user.getIdToken();
    })
    .then((tokenId) => {
      token = tokenId;
      const userCredentials = {
        username: newUser.username,
        email: newUser.email,
        createdAt: new Date().toISOString(),
        imageUrl: `https://firebasestorage.googleapis.com/v0/b/${firebaseConfig.storageBucket}/o/${noImg}?alt=media`,
        symptomsMade: 0,
        virusesMade: 0,
        userId,
        role: 0,
        quizAnswered: 0,
      };
      return db.doc(`/users/${newUser.username}`).set(userCredentials);
    })
    .then(() => {
      return res.status(201).json({
        token,
      });
    })
    .catch((err) => {
      console.error(err);
      if (err.code === "auth/email-already-in-use") {
        return res.status(400).json({
          email: "Email is already in use",
        });
      } else
        return res.status(500).json({
          error: err.code,
        });
    });
};

exports.login = (req, res) => {
  const user = {
    email: req.body.email,
    password: req.body.password,
  };

  let errors = {};

  if (!validator.isEmail(user.email) || validator.isEmpty(user.email))
    errors.email = "Must match an email address.";
  if (validator.isEmpty(user.password)) errors.password = "Must not be empty.";

  if (Object.keys(errors).length > 0) return res.status(400).json(errors);

  firebase
    .auth()
    .signInWithEmailAndPassword(user.email, user.password)
    .then((data) => {
      return data.user.getIdToken();
    })
    .then((tokenId) => {
      return res.json({
        tokenId,
      });
    })
    .catch((err) => {
      console.error(err);
      return res.status(403).json({
        general: "Wrong credentials. Please try again.",
      });
    });
};

exports.addUserDetails = (req, res) => {
  let userDetails = reduceUserDetails(req.body);

  db.doc(`/users/${req.user.username}`)
    .update(userDetails)
    .then(() => {
      return res.json({
        message: "Details added successfully.",
      });
    })
    .catch((err) => {
      console.error(err);
      return res.status(500).json({
        error: err.code,
      });
    });
};

exports.getAuthenticatedUser = (req, res) => {
  let resData = {};
  db.doc(`/users/${req.user.username}`)
    .get()
    .then((doc) => {
      if (doc.exists) {
        resData.credentials = doc.data();
        return res.json(resData);
      }
    })
    .catch((err) => {
      console.error(err);
      return res.status(500).json({
        error: err.code,
      });
    });
};

exports.getUserDetails = (req, res) => {
  const userData = {};
  db.doc(`/users/${req.params.username}`)
    .get()
    .then((doc) => {
      if (doc.exists) {
        userData.user = doc.data();
        db.collection("viruses")
          .where("createdBy", "==", req.params.username)
          .orderBy("createdAt", "desc")
          .get()
          .then((data) => {
            userData.viruses = [];
            data.forEach((doc) => {
              //console.log(doc.data());
              userData.viruses.push({
                virusId: doc.id,
                ...doc.data(),
              });
            });
            return db
              .collection("symptoms")
              .where("createdBy", "==", req.params.username)
              .orderBy("createdAt", "desc")
              .get();
          })
          .then((data) => {
            userData.symptoms = [];
            data.forEach((doc) => {
              console.log(doc.data());
              userData.symptoms.push({
                symptomId: doc.id,
                ...doc.data(),
              });
            });

            return res.json(userData);
          })
          .catch((err) => {
            console.error(err);
            res.status(500).json({
              error: err.code,
            });
          });
      } else {
        return res.status(404).json({
          error: "User not found.",
        });
      }
    });
};

exports.uploadImage = (req, res) => {
  const BusBoy = require("busboy");
  const path = require("path");
  const os = require("os");
  const fs = require("fs");

  const busboy = new BusBoy({
    headers: req.headers,
  });

  let imageFilename;
  let imageUploadVersion = {};

  busboy.on("file", (fieldname, file, filename, encoding, mimetype) => {
    if (mimetype !== "image/jpeg" && mimetype !== "image/png") {
      return res.status(400).json({
        error: "Wrong file type submitted.",
      });
    }

    const imageExtension = filename.split(".")[filename.split(".").length - 1];
    imageFilename = `${uniqid()}.${imageExtension}`;
    const filepath = path.join(os.tmpdir(), imageFilename);
    imageUploadVersion = {
      filepath,
      mimetype,
    };

    file.pipe(fs.createWriteStream(filepath));
  });
  busboy.on("finish", () => {
    admin
      .storage()
      .bucket(firebaseConfig.storageBucket)
      .upload(imageUploadVersion.filepath, {
        resumable: false,
        metadata: {
          metadata: {
            contentType: imageUploadVersion.mimetype,
          },
        },
      })
      .then(() => {
        const imageUrl = `https://firebasestorage.googleapis.com/v0/b/${firebaseConfig.storageBucket}/o/${imageFilename}?alt=media`;
        return db
          .doc(`/users/${req.user.username}`)
          .update({
            imageUrl,
          })
          .then(() => {
            return res.json({
              message: "Image uploaded successfully.",
            });
          })
          .catch((err) => {
            console.error(err);
            return res.status(500).json({
              error: err,
            });
          });
      });
  });
  busboy.end(req.rawBody);
};

exports.getTopUsers = (req, res) => {
  db.collection("users")
    .orderBy("symptomsMade", "desc")
    .orderBy("virusesMade", "desc")
    .limit(5)
    .get()
    .then((snapshot) => {
      let topUsers = [];
      snapshot.forEach((doc) => {
        topUsers.push({
          ...doc.data(),
        });
      });
      return res.status(200).json(topUsers);
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json({ error: err.code });
    });
};

exports.upgradeRoleUser = (req, res) => {
  if (req.user.role >= 3) {
    db.doc(`/users/${req.params.username}`)
      .update({
        role: admin.firestore.FieldValue.increment(1),
      })
      .then(() => res.status(200).json({ message: "User role increased." }))
      .catch((err) => {
        console.error(err);
        return res.status(500).json({ error: err.code });
      });
  } else {
    return res.status(403).json({ message: "Unauthorized Access." });
  }
};
