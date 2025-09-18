const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    minlength: [3, 'Username must be at least 3 characters long'],
    maxlength: [20, 'Username must be less than 20 characters long'],
    match: [/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [
      /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
      'Please enter a valid email address'
    ]
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters long'],
    select: false // Don't include password in queries by default
  },
  deviceId: {
    type: String,
    required: false,
    index: true
  },
  lastSeen: {
    type: Date,
    default: Date.now
  },
  isOnline: {
    type: Boolean,
    default: false,
    index: true
  },
  isSearching: {
    type: Boolean,
    default: false,
    index: true
  },
  ip: {
    type: String,
    required: false
  },
  location: {
    country: String,
    region: String,
    city: String,
    timezone: String,
    coordinates: {
      lat: Number,
      lon: Number
    }
  },
  socketId: {
    type: String,
    required: false,
    index: true
  },
  connectedUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      delete ret.password;
      delete ret.__v;
      return ret;
    }
  }
});

// Index for efficient querying
UserSchema.index({ username: 1, email: 1 });
UserSchema.index({ isOnline: 1, connectedUser: 1 });
UserSchema.index({ isSearching: 1 });

// Hash password before saving
UserSchema.pre('save', async function(next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('password')) return next();

  try {
    // Hash password with cost of 12
    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
    this.password = await bcrypt.hash(this.password, saltRounds);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
UserSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw error;
  }
};

// Update last seen
UserSchema.methods.updateLastSeen = function() {
  this.lastSeen = new Date();
  return this.save();
};

// Set online status
UserSchema.methods.setOnline = function(socketId = null) {
  this.isOnline = true;
  this.lastSeen = new Date();
  if (socketId) this.socketId = socketId;
  return this.save();
};

// Set offline status
UserSchema.methods.setOffline = function() {
  this.isOnline = false;
  this.socketId = null;
  this.connectedUser = null;
  this.isSearching = false;
  this.lastSeen = new Date();
  return this.save();
};

// Connect to another user
UserSchema.methods.connectToUser = function(userId) {
  console.log(`Connecting user ${this.username} to user ${userId}`);
  this.connectedUser = userId;
  const result = this.save();
  console.log(`User ${this.username} connected to: ${this.connectedUser}`);
  return result;
};

// Disconnect from current user
UserSchema.methods.disconnect = function() {
  this.connectedUser = null;
  return this.save();
};

// Start searching for a match
UserSchema.methods.startSearching = function() {
  this.isSearching = true;
  return this.save();
};

// Stop searching for a match
UserSchema.methods.stopSearching = function() {
  this.isSearching = false;
  return this.save();
};

// Static method to find online users available for matching
UserSchema.statics.findAvailableUsers = function(excludeUserId) {
  return this.find({
    _id: { $ne: excludeUserId },
    isOnline: true,
    isSearching: true,
    connectedUser: null
  }).select('-password');
};

// Static method to find user by socket ID
UserSchema.statics.findBySocketId = function(socketId) {
  return this.findOne({ socketId }).select('-password');
};

module.exports = mongoose.model('User', UserSchema);