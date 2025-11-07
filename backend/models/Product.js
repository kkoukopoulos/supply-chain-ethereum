const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: String,                    // Matches: string name
  manufacturerName: String,        // Matches: string manufacturerName  
  barcode: {                       // Matches: string barcode
    type: String,
    required: true,
    unique: true
  },
  manufacturedTime: String,        // Matches: string manufacturedTime
  currentOwner: String,            // Additional: track current wallet address
  history: [{                      // Additional: track ownership history
    owner: String,
    timestamp: Date,
    transactionType: String
  }]
}, {
  timestamps: true
});

module.exports = mongoose.model('Product', productSchema);