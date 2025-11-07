const express = require('express');
const Product = require('../models/Product');
const router = express.Router();

// Create product (matches your registerProduct function)
router.post('/', async (req, res) => {
  try {
    const { name, manufacturerName, barcode, manufacturedTime, currentOwner } = req.body;
    
    const product = await Product.create({
      name,
      manufacturerName,
      barcode,
      manufacturedTime,
      currentOwner,
      history: [{
        owner: currentOwner,
        timestamp: new Date(),
        transactionType: 'Manufactured'
      }]
    });
    
    res.json({ success: true, product });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get product by barcode (matches your getProductByBarcode function)
router.get('/:barcode', async (req, res) => {
  try {
    const product = await Product.findOne({ barcode: req.params.barcode });
    
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    res.json(product);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update product ownership (matches your sellProduct function)
router.patch('/:barcode/transfer', async (req, res) => {
  try {
    const { newOwner, previousOwner } = req.body;
    
    const product = await Product.findOneAndUpdate(
      { barcode: req.params.barcode, currentOwner: previousOwner },
      { 
        currentOwner: newOwner,
        $push: {
          history: {
            owner: newOwner,
            timestamp: new Date(),
            transactionType: 'Transfer'
          }
        }
      },
      { new: true }
    );
    
    if (!product) {
      return res.status(404).json({ error: 'Product not found or not owned by seller' });
    }
    
    res.json({ success: true, product });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get all products
router.get('/', async (req, res) => {
  try {
    const products = await Product.find();
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;