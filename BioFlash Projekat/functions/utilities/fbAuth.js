const { admin, db } = require("./admin");

//Check if the bearer token exists and get user name and role
module.exports = (req, res, next) => {
  let tokenId;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer ")
  ) {
    tokenId = req.headers.authorization.split("Bearer ")[1];
  } else {
    console.error("No token provided.");
    res.status(403).json({
      error: "Unauthorized access.",
    });
  }

  admin
    .auth()
    .verifyIdToken(tokenId)
    .then((decodedToken) => {
      req.user = decodedToken;
      console.log("Token:", decodedToken);
      return db
        .collection("users")
        .where("userId", "==", req.user.uid)
        .limit(1)
        .get();
    })
    .then((data) => {
      req.user.username = data.docs[0].data().username;
      req.user.role = data.docs[0].data().role;
      return next();
    })
    .catch((err) => {
      console.error("Error with token", err);
      return res.status(403).json(err);
    });
};
