const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const expertSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
  },
  subject: {
    type: String,
    required: [true, 'Subject is required'],
    // Normalized key used in API calls
    enum: [
      'computer_networks',
      'operating_systems',
      'database_management_system',
      'software_engineering',
      'data_structures_and_algorithms',
      'greedy',
      'math',
      'binary_search',
      'two_pointers',
      'graph',
    ],
  },
  subjectLabel: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: 6,
  },
  isOnline: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: true,
});

// Hash password before saving
expertSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare passwords
expertSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Don't return password in JSON
expertSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

module.exports = mongoose.model('Expert', expertSchema);
