const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');

const app = express();
const port = 3001;

// MongoDB connection
mongoose.connect('mongodb+srv://ashidudissanayake1:dNCOcFsGwdXzmbti@cluster0.eqbk9.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0');

// Define schema and model
const userSchema = new mongoose.Schema({
  uuid: String,
  name: String,
  email: String,
  phone: String,
  password: String,
  accountBalance: Number,
  lastLogin: Date,
  lastLogout: Date
});

const User = mongoose.model('User', userSchema);

app.use(bodyParser.json());

// Endpoint to log UUID
app.post('/log-uuid', async (req, res) => {
  const { uuid } = req.body;

  let user = await User.findOne({ uuid });
  if (user) {
    if (!user.lastLogin || (user.lastLogout && user.lastLogout > user.lastLogin)) {
      // User is logging in
      user.lastLogin = new Date();
    } else {
      // User is logging out
      user.lastLogout = new Date();
      const duration = (user.lastLogout - user.lastLogin) / 1000; // Duration in seconds
      const charge = duration * 0.01; // Example: 1 cent per second
      user.accountBalance -= charge;
    }
    await user.save();
  }

  res.sendStatus(200);
});

// Endpoint to get user details
app.get('/user-details', async (req, res) => {
  const { uuid } = req.query;

  let user = await User.findOne({ uuid });
  if (user) {
    res.json({ name: user.name });
  } else {
    res.sendStatus(404);
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});