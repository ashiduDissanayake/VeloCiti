/**
 * User Creation Script for VeloCiti
 * 
 * This script adds test users to your MongoDB database.
 * Run it with: node addUsers.js
 */

const mongoose = require('mongoose');

// MongoDB Connection String - Replace with your own connection string if needed
const MONGODB_URI = 'mongodb+srv://ashidudissanayake1:7MdVdy6DIHXZg7fo@cluster0.eqbk9.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

// User Schema - Must match your main application schema
const userSchema = new mongoose.Schema({
  uuid: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  email: { type: String, required: true },
  phone: String,
  accountBalance: { type: Number, default: 100 },
  lastLogin: Date,
  lastLogout: Date,
  createdAt: { type: Date, default: Date.now }
});

// Create User model
const User = mongoose.model('User', userSchema);

// Test users data
const testUsers = [
  {
    uuid: 'user001',
    name: 'John Smith',
    email: 'john.smith@example.com',
    phone: '123-456-7890',
    accountBalance: 100
  },
  {
    uuid: 'user002',
    name: 'Jane Doe',
    email: 'jane.doe@example.com',
    phone: '234-567-8901',
    accountBalance: 150
  },
  {
    uuid: 'user003',
    name: 'Robert Johnson',
    email: 'robert.j@example.com',
    phone: '345-678-9012',
    accountBalance: 75
  },
  {
    uuid: 'user004',
    name: 'Sarah Wilson',
    email: 'sarah.w@example.com',
    phone: '456-789-0123',
    accountBalance: 200
  },
  {
    uuid: 'user005',
    name: 'Michael Brown',
    email: 'michael.b@example.com',
    phone: '567-890-1234',
    accountBalance: 125
  }
];

// Connect to MongoDB
console.log('Connecting to MongoDB...');
mongoose.connect(MONGODB_URI, { tls: true })
  .then(() => {
    console.log('Connected to MongoDB successfully');
    addUsers();
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

// Function to add users to the database
async function addUsers() {
  console.log('Adding test users to the database...');
  
  try {
    let addedCount = 0;
    let existingCount = 0;
    
    for (const userData of testUsers) {
      // Check if user already exists
      const existingUser = await User.findOne({ uuid: userData.uuid });
      
      if (existingUser) {
        console.log(`User with UUID ${userData.uuid} already exists. Skipping...`);
        existingCount++;
      } else {
        // Create new user
        const user = new User(userData);
        await user.save();
        console.log(`Added user: ${userData.name} (${userData.uuid})`);
        addedCount++;
      }
    }
    
    console.log('\nSummary:');
    console.log(`- ${addedCount} users added`);
    console.log(`- ${existingCount} users already existed`);
    console.log(`- ${testUsers.length} total users processed`);
    
  } catch (error) {
    console.error('Error adding users:', error);
  } finally {
    // Close MongoDB connection
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
  }
}

// Handle termination signals
process.on('SIGINT', async () => {
  console.log('\nClosing MongoDB connection...');
  await mongoose.connection.close();
  console.log('MongoDB connection closed');
  process.exit(0);
});