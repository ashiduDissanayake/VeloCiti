const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});
const port = process.env.PORT || 3000;

// Enable CORS and JSON parsing
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// MongoDB connection
mongoose.connect('mongodb+srv://<username>:<password>@cluster0.eqbk9.mongodb.net/VeloCitiDB?retryWrites=true&w=majority', {
  tls: true
}).catch(err => console.error('MongoDB connection error:', err));

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', () => console.log('Connected to MongoDB'));

// Define schemas
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

const transactionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  uuid: String,
  name: String,
  action: { type: String, enum: ['login', 'logout'] },
  time: { type: Date, default: Date.now },
  duration: Number,
  balanceChange: Number,
  newBalance: Number
});

const User = mongoose.model('User', userSchema);
const Transaction = mongoose.model('Transaction', transactionSchema);

// Check database connection
app.get('/check-db-connection', (req, res) => {
  if (db.readyState === 1) {
    res.status(200).json({ status: 'Connected' });
  } else {
    res.status(500).json({ status: 'Disconnected' });
  }
});

// Process RFID scan
app.post('/api/users/scan', async (req, res) => {
  try {
    const { uuid } = req.body;
    let user = await User.findOne({ uuid });
    
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Determine if this is a login or logout event
    const isLogin = !user.lastLogin || (user.lastLogout && new Date(user.lastLogout) > new Date(user.lastLogin));

    if (isLogin) {
      // User is logging in
      user.lastLogin = new Date();
      
      // Create transaction record for login
      const transaction = new Transaction({
        userId: user._id,
        uuid: user.uuid,
        name: user.name,
        action: 'login',
        time: user.lastLogin,
        balanceChange: 0,
        newBalance: user.accountBalance
      });
      
      await transaction.save();
    } else {
      // User is logging out
      user.lastLogout = new Date();
      
      // Calculate duration in minutes
      const durationMs = user.lastLogout.getTime() - user.lastLogin.getTime();
      const durationMinutes = durationMs / (1000 * 60);
      
      // Calculate charge (10 cents per minute)
      const charge = Math.round(durationMinutes * 10) / 100;
      
      // Update account balance
      user.accountBalance -= charge;
      
      // Create transaction record for logout
      const transaction = new Transaction({
        userId: user._id,
        uuid: user.uuid,
        name: user.name,
        action: 'logout',
        time: user.lastLogout,
        duration: durationMinutes,
        balanceChange: -charge,
        newBalance: user.accountBalance
      });
      
      await transaction.save();
    }
    
    // Save user updates
    await user.save();
    
    // Emit socket event with updated user data
    io.emit('userUpdate', user);
    
    res.status(200).json({ 
      success: true, 
      data: {
        user,
        action: isLogin ? 'login' : 'logout'
      }
    });
  } catch (error) {
    console.error('Error processing scan:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Get users count
app.get('/api/users/count', async (req, res) => {
  try {
    const count = await User.countDocuments();
    res.status(200).json({ count });
  } catch (error) {
    console.error('Error counting users:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get active users count
app.get('/api/users/active', async (req, res) => {
  try {
    const count = await User.countDocuments({
      lastLogin: { $exists: true },
      $or: [
        { lastLogout: { $exists: false } },
        { lastLogin: { $gt: "$lastLogout" } }
      ]
    });
    
    res.status(200).json({ count });
  } catch (error) {
    console.error('Error counting active users:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get total revenue
app.get('/api/transactions/revenue', async (req, res) => {
  try {
    const result = await Transaction.aggregate([
      { $match: { action: 'logout' } },
      { $group: { _id: null, revenue: { $sum: { $abs: '$balanceChange' } } } }
    ]);
    
    const revenue = result.length > 0 ? result[0].revenue : 0;
    res.status(200).json({ revenue });
  } catch (error) {
    console.error('Error calculating revenue:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get recent transactions
app.get('/api/transactions/recent', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const transactions = await Transaction.find().sort({ time: -1 }).limit(limit);
    res.status(200).json({ transactions });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create new user (for testing)
app.post('/api/users', async (req, res) => {
  try {
    const { uuid, name, email, phone } = req.body;
    
    // Check if user exists
    const existingUser = await User.findOne({ uuid });
    if (existingUser) {
      return res.status(400).json({ error: 'User with this UUID already exists' });
    }
    
    // Create new user
    const user = new User({
      uuid,
      name,
      email,
      phone,
      accountBalance: 100
    });
    
    await user.save();
    res.status(201).json(user);
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Serve the main HTML file
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Socket.io connection
io.on('connection', (socket) => {
  console.log('Client connected');
  socket.on('disconnect', () => console.log('Client disconnected'));
});

// Start server
server.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});