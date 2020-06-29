const { db, admin } = require("../utilities/admin");

const validator = require("validator");
const uniqid = require("uniqid");
const { validateSymptomData } = require("../utilities/validators");
const firebaseConfig = require("../utilities/config");

const { toTitleCase } = require("../utilities/helpers");

exports.addNewSymptom = (req, res) => {
  let newSymptom = {};
  if (!validator.isEmpty(req.body.name.trim())) {
    newSymptom = validateSymptomData(req.body);
    newSymptom.createdBy = req.user.username;
    if (req.user.role > 0) newSymptom.approved = true;
    if (req.body.description) newSymptom.description = req.body.description;

    db.doc(`/symptoms/${toTitleCase(req.body.name)}`)
      .get()
      .then((doc) => {
        if (doc.exists) {
          return res.status(400).json({
            name: "This symptom already exists.",
          });
        } else {
          return db
            .doc(`/symptoms/${toTitleCase(req.body.name)}`)
            .set(newSymptom)
            .then(() => {
              return db
                .collection("users")
                .doc(req.user.username)
                .update({
                  symptomsMade: admin.firestore.FieldValue.increment(1),
                });
            })
            .then(() => {
              return res.status(201).json({
                message: "Symptom added successfully.",
              });
            })
            .catch((err) => {
              console.error(err);
              return res.status(500).json({
                error: err.code,
              });
            });
        }
      })
      .catch((err) => {
        console.error(err);
        return res.status(500).json({
          error: err.code,
        });
      });
  } else {
    return res.status(400).json({
      error: "Please write symptom name.",
    });
  }
};

exports.uploadSymptomImage = (req, res) => {
  const BusBoy = require("busboy");
  const path = require("path");
  const os = require("os");
  const fs = require("fs");

  const busboy = new BusBoy({
    headers: req.headers,
  });

  let imageFilename;
  let symptomName;
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

  busboy.on("field", (key, value) => {
    if (key === "symptomName") symptomName = value;
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
          .doc(`/symptoms/${toTitleCase(symptomName)}`)
          .update({
            imageUrl,
          })
          .then(() => {
            return res.status(201).json({
              message: "Symptom created successfully",
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

exports.getSymptomInfo = (req, res) => {
  let symptomData = {};
  db.doc(`/symptoms/${toTitleCase(req.params.symptomName)}`)
    .get()
    .then((doc) => {
      if (!doc.exists) {
        return res.status(404).json({
          error: "Symptom not found.",
        });
      }
      symptomData = doc.data();
      symptomData.name = doc.id;
      return res.json(symptomData);
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json({
        error: err.code,
      });
    });
};

exports.updateSymptom = (req, res) => {
  let updateInformation = {};
  const symptomNameGeneral = toTitleCase(req.params.symptomName);

  if (!validator.isEmpty(req.body.specialty))
    updateInformation.specialty = toTitleCase(req.body.specialty.trim());
  if (!validator.isEmpty(req.body.other))
    updateInformation.other = toTitleCase(req.body.other.trim());
  updateInformation.lastUpdated = new Date().toISOString();

  const document = db.doc(`/symptoms/${symptomNameGeneral}`);
  document
    .get()
    .then((doc) => {
      if (!doc.exists) {
        return res.status(400).json({
          error: "Symptom does not exist.",
        });
      } else {
        if (req.user.username === doc.data().createdBy) {
          document
            .update(updateInformation)
            .then(() => {
              return res.status(202).json({
                message: "Information updated successfully.",
              });
            })
            .catch((err) => {
              console.error(err);
              return res.status(500).json({
                error: err.code,
              });
            });
        } else {
          return res.status(401).json({
            error: "Unauthorized",
          });
        }
      }
    })
    .catch((err) => {
      console.error(err);
      return res.status(500).json({
        error: err.code,
      });
    });
};

exports.deleteSymptom = (req, res) => {
  if (req.params.symptomName.trim() !== "") {
    const document = db.doc(`/symptoms/${toTitleCase(req.params.symptomName)}`);
    document
      .get()
      .then((doc) => {
        if (!doc.exists) {
          return res.status(404).json({
            error: "Symptom not found.",
          });
        }
        if (doc.data().createdBy !== req.user.username) {
          return res.status(403).json({
            error: "Unauthorized.",
          });
        } else {
          return document.delete();
        }
      })
      .then(() => {
        db.collection("users")
          .doc(req.user.username)
          .update({
            symptomsMade: admin.firestore.FieldValue.increment(-1),
          });
      })
      .then(() => {
        return res.json({
          message: "Symptom deleted succesfully.",
        });
      })
      .catch((err) => {
        console.error(err);
        res.status(500).json({
          error: err.code,
        });
      });
  } else {
    return res.status(400).json({
      error: "Please enter a valid name.",
    });
  }
};

exports.getSymptoms = (req, res) => {
  let symptomList = [];
  let key = 0;
  db.collection("symptoms")
    .select()
    .get()
    .then((snapshot) => {
      snapshot.forEach((data) => {
        symptomList.push({
          key: key++,
          text: data.id,
          value: data.id,
        });
      });
      return res.json(symptomList);
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json({ error: err.code });
    });
};

exports.getSymptomImages = (req, res) => {
  let symptomMain = [];
  db.collection("symptoms")
    .get()
    .then((data) => {
      data.forEach((doc) => {
        symptomMain.push({
          name: doc.id,
          image: doc.data().imageUrl,
        });
      });
      return res.status(200).json(symptomMain);
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json({ error: err.code });
    });
};

exports.approveSymptom = (req, res) => {
  if (req.user.role >= 3) {
    db.doc(`/symptoms/${req.params.symptomName}`)
      .update({
        approved: true,
      })
      .then(() => res.status(200).json({ message: "Symptom approved." }))
      .catch((err) => {
        console.error(err);
        return res.status(500).json({ error: err.code });
      });
  } else {
    return res.status(403).json({ message: "Unauthorized Access." });
  }
};

exports.requestSymptomDeletion = (req, res) => {
  if (req.user.username == req.body.username) {
    db.doc(`/symptoms/${req.params.symptomName}`)
      .update({
        pendingDeletion: true,
      })
      .then(() =>
        res.status(200).json({ message: "Symptom deletion requested." })
      )
      .catch((err) => {
        console.error(err);
        return res.status(500).json({ error: err.code });
      });
  } else {
    return res.status(403).json({ message: "Unauthorized Access." });
  }
};
