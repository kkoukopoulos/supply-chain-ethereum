const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  userAddress: {  // Matches your Solidity: address userAddress
    type: String,
    required: true,
    unique: true
  },
  name: String,   // Matches your Solidity: string name
  role: {         // Matches your Solidity: UserRole role
    type: String,
    enum: ['Manufacturer', 'Supplier', 'Vendor', 'Customer'],
    required: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('User', userSchema);