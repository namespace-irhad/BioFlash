const { db, admin } = require("../utilities/admin");
const firebaseConfig = require("../utilities/config");

const { toTitleCase } = require("../utilities/helpers");

const { validateVirusData } = require("../utilities/validators");

const validator = require("validator");
const uniqid = require("uniqid");

exports.addNewVirus = (req, res, next) => {
  let newVirus = {};
  let allSymptoms = [];
  //console.log(req.body.symptoms)
  if (req.body.symptoms.length > 0) {
    db.doc(`/viruses/${toTitleCase(req.body.name)}`)
      .get()
      .then((doc) => {
        if (doc.exists) {
          return res.status(400).json({
            error: "Virus already exists.",
          });
        } else {
          return db
            .collection("symptoms")
            .get()
            .then((data) => {
              data.forEach((doc) => {
                allSymptoms.push(doc.id);
              });
              let existingSymptoms = allSymptoms.filter((symptom) =>
                req.body.symptoms.includes(symptom)
              );
              if (existingSymptoms.length === req.body.symptoms.length) {
                newVirus = validateVirusData(req.body);
                if (req.user.role > 0) newVirus.approved = true;
                newVirus.symptoms = existingSymptoms;
                newVirus.createdBy = req.user.username;
                if (req.body.description)
                  newVirus.description = req.body.description;
                db.doc(`/viruses/${toTitleCase(req.body.name)}`)
                  .create(newVirus)
                  .then(() => {
                    db.collection("users")
                      .doc(req.user.username)
                      .update({
                        virusesMade: admin.firestore.FieldValue.increment(1),
                      })
                      .then(() => {
                        res.status(201).json({
                          message: "Virus created successfully.",
                        });
                      });
                  })
                  .catch((err) => {
                    console.error(err);
                    return res.status(500).json({
                      error: err.code,
                    });
                  });
              } else {
                return res.status(400).json({
                  error: "Symptoms do not match the existing ones.",
                });
              }
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
      message: "Please add symptoms of the virus.",
    });
  }
};

exports.uploadVirusImage = (req, res) => {
  const BusBoy = require("busboy");
  const path = require("path");
  const os = require("os");
  const fs = require("fs");

  const busboy = new BusBoy({
    headers: req.headers,
  });

  let imageFilename;
  let virusName;
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
    if (key === "virusName") virusName = value;
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
          .doc(`/viruses/${toTitleCase(virusName)}`)
          .update({
            imageUrl,
          })
          .then(() => {
            return res.status(201).json({
              message: "Virus created successfully",
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

exports.getVirusInfo = (req, res) => {
  let virusData = {};
  db.doc(`/viruses/${req.params.virusId}`)
    .get()
    .then((doc) => {
      if (!doc.exists) {
        return res.status(404).json({
          error: "Virus not found.",
        });
      }
      virusData = doc.data();
      virusData.virusId = doc.id;
      return res.json(virusData);
    })
    .catch((err) => {
      console.error(err);
      return res.status(500).json({
        error: err.code,
      });
    });
};

exports.updateVirus = (req, res) => {
  let updateInformation = {};
  const document = db.doc(`/viruses/${toTitleCase(req.params.virusId)}`);

  if (!validator.isEmpty(req.body.specialty))
    updateInformation.specialty = toTitleCase(req.body.specialty.trim());
  if (!validator.isEmpty(req.body.duration))
    updateInformation.duration = toTitleCase(req.body.duration.trim());
  if (!validator.isEmpty(req.body.type))
    updateInformation.type = toTitleCase(req.body.type.trim());
  if (!validator.isEmpty(req.body.other))
    updateInformation.other = toTitleCase(req.body.other.trim());

  updateInformation.lastUpdated = new Date().toISOString();

  document
    .get()
    .then((doc) => {
      if (!doc.exists) {
        return res.status(400).json({
          error: "Virus does not exist.",
        });
      } else {
        if (req.user.username === doc.data().createdBy) {
          let allSymptoms = [];
          db.collection("symptoms")
            .get()
            .then((data) => {
              if (req.body.symptoms.length !== 0) {
                data.forEach((doc) => {
                  allSymptoms.push(doc.id);
                });
                let existingSymptoms = allSymptoms.filter((symptom) =>
                  req.body.symptoms.includes(symptom)
                );
                if (existingSymptoms.length !== req.body.symptoms.length) {
                  updateInformation.symptoms = req.body.symptoms;
                }
              }
              return document.update(updateInformation);
            })
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

exports.deleteVirus = (req, res) => {
  const document = db.doc(`/viruses/${req.params.virusId}`);
  document
    .get()
    .then((doc) => {
      if (!doc.exists) {
        return res.status(404).json({
          error: "Virus not found.",
        });
      }
      if (doc.data().username !== req.user.username) {
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
          virusesMade: admin.firestore.FieldValue.increment(-1),
        });
    })
    .then(() => {
      return res.json({
        message: "Virus deleted succesfully.",
      });
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json({
        error: err.code,
      });
    });
};

exports.getViruses = (req, res) => {
  let virusMain = [];
  db.collection("viruses")
    .get()
    .then((data) => {
      data.forEach((doc) => {
        virusMain.push({
          name: doc.id,
          symptoms: doc.data().symptoms,
          critical: doc.data().critical,
        });
      });
      return res.status(200).json(virusMain);
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json({ error: err.code });
    });
};

exports.approveVirus = (req, res) => {
  if (req.user.role >= 3) {
    db.doc(`/viruses/${req.params.virusName}`)
      .update({
        approved: true,
      })
      .then(() => res.status(200).json({ message: "Virus approved." }))
      .catch((err) => {
        console.error(err);
        return res.status(500).json({ error: err.code });
      });
  } else {
    return res.status(403).json({ message: "Unauthorized Access." });
  }
};

exports.requestVirusDeletion = (req, res) => {
  if (req.user.username == req.body.username) {
    db.doc(`/viruses/${req.params.virusName}`)
      .update({
        pendingDeletion: true,
      })
      .then(() =>
        res.status(200).json({ message: "Virus deletion requested." })
      )
      .catch((err) => {
        console.error(err);
        return res.status(500).json({ error: err.code });
      });
  } else {
    return res.status(403).json({ message: "Unauthorized Access." });
  }
};
