const express = require("express");
const app = express();
const cors = require("cors");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
require("dotenv").config();

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cors());
app.use(express.static("public"));

//Mongoose connection
let listener = app.listen(process.env.PORT || 3000, () => {
  console.log("Your app is listening on port " + listener.address().port);
});

let uri = process.env.ATLAS_URI;

mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });

//Exercise Schema
let exSchema = new mongoose.Schema({
  description: { type: String, required: true },
  duration: { type: Number, required: true },
  date: String,
});

//User Schema
let userSchema = new mongoose.Schema({
  username: { type: String, required: true },
  log: [exSchema],
  count: { type: Number },
});

//Schema model creation: User and Exercise
let User = mongoose.model("User", userSchema);
let Exercise = mongoose.model("Exercise", exSchema);

//Main page
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/views/index.html");
});

//Create new user endpoint
app.post("/api/users", async (req, res) => {
  const { username } = req.body;

  //Search user with the same username
  let user = await User.findOne({ username: req.body.username });
  if (!user) {
    user = new User({ username: username });
    await user.save();

    res.status(200).json(user);
  } else {
    res.status(400).send("This user already exists.");
  }
});

//Get all users endpoint
app.get("/api/users", (req, res) => {
  //Find all users
  User.find()
    .then((result) => res.status(200).json(result))
    .catch((error) => res.status(400).send(error));
});

//Function to get correct date for the next endpoint
const getDate = (date) => {
  //If date is undefined it's going to take the current date
  if (!date) {
    return new Date().toDateString();
  }

  //Split the date do create a correct date in the following format: ex 'yyyy-mm-dd'
  const correctDate = new Date();
  const dateString = date.split("-");
  correctDate.setFullYear(dateString[0]);
  correctDate.setDate(dateString[2]);
  correctDate.setMonth(dateString[1] - 1);

  return correctDate.toDateString();
};

//Create user exercise endpoint
app.post("/api/users/:_id/exercises", async (req, res) => {
  const { description, duration, date } = req.body;

  //create and save new exercise based on the model
  let exercise = new Exercise({
    description: description,
    duration: duration,
    date: getDate(date),
  });

  await exercise.save();

  //find and update user by id, add new exercise in its profile
  User.findByIdAndUpdate(
    req.params._id,
    { $push: { log: exercise } },
    { new: true }
  )

    //then respond with the new exercise added and the user of reference
    .then((result) => {
      res.json({
        _id: result._id,
        username: result.username,
        date: exercise.date,
        duration: exercise.duration,
        description: exercise.description,
      });
    })
    .catch((error) => res.status(400).send(error));
});

//Get user exercises by id endpoint
app.get("/api/users/:_id/logs", (req, res) => {
  //Find user by id
  User.findById(req.params._id).then((result) => {
    let resObj = result;

    //check if te request is filtered by 'from and/or to' date
    if (req.query.from || req.query.to) {
      let fromDate = new Date(0);
      let toDate = new Date();

      if (req.query.from) {
        fromDate = new Date(req.query.from);
      }

      if (req.query.to) {
        toDate = new Date(req.query.to);
      }

      fromDate = fromDate.getTime();
      toDate = toDate.getTime();

      //filter the log list bases on dates
      resObj.log = resObj.log.filter((session) => {
        let sessionDate = new Date(session.date).getTime();
        return sessionDate >= fromDate && sessionDate <= toDate;
      });
    }

    //slice the log array to show the exact number of exercises selected(if it is selected)
    if (req.query.limit) {
      resObj.log = resObj.log.slice(0, req.query.limit);
    }
    resObj["count"] = result.log.length;
    res.json(resObj);
  });
});
