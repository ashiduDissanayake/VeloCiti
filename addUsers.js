const mongoose = require('mongoose');

// MongoDB connection
mongoose.connect('mongodb+srv://ashidudissanayake1:dNCOcFsGwdXzmbti@cluster0.eqbk9.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0');

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', async () => {
  console.log('Connected to the database');

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

  // Create two users
  const users = [
    {
      uuid: "1234567890AB",
      name: "John Doe",
      email: "john.doe@example.com",
      phone: "1234567890",
      password: "password123",
      accountBalance: 100.0,
      lastLogin: null,
      lastLogout: null
    },
    {
      uuid: "0987654321CD",
      name: "Jane Smith",
      email: "jane.smith@example.com",
      phone: "0987654321",
      password: "password456",
      accountBalance: 200.0,
      lastLogin: null,
      lastLogout: null
    }
  ];

  try {
    const docs = await User.insertMany(users);
    console.log('Users inserted successfully:', docs);
  } catch (err) {
    console.error('Error inserting users:', err);
  } finally {
    mongoose.connection.close();
  }
});