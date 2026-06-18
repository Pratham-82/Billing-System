const express = require('express');
const Item = require('../models/Item');
const { requireSuperUser } = require('../middleware/auth');

const router = express.Router();

const defaultCatalog = [
  { name: "Royal Damask Gold", type: "quantity", defaultPrice: 0 },
  { name: "Classic Brick Textured", type: "quantity", defaultPrice: 0 },
  { name: "Modern Geometric Slate", type: "sqft", defaultPrice: 0 },
  { name: "Floral Watercolor Meadow", type: "sqft", defaultPrice: 0 }
];

// Get all items (auto-seeds if empty)
router.get('/', async (req, res) => {
  try {
    let items = await Item.find().sort({ name: 1 });
    if (items.length === 0) {
      await Item.create(defaultCatalog);
      items = await Item.find().sort({ name: 1 });
    }
    res.json(items);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create item
router.post('/', requireSuperUser, async (req, res) => {
  try {
    const { name, type, defaultPrice } = req.body;
    if (!name?.trim()) {
      return res.status(400).json({ message: 'Name is required' });
    }

    const exists = await Item.findOne({ name: new RegExp(`^${name.trim()}$`, 'i') });
    if (exists) {
      return res.status(400).json({ message: 'An item with this name already exists' });
    }

    const newItem = await Item.create({
      name: name.trim(),
      type: type || 'quantity',
      defaultPrice: Number(defaultPrice) || 0
    });

    res.status(201).json(newItem);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update item
router.put('/:id', requireSuperUser, async (req, res) => {
  try {
    const { name, type, defaultPrice } = req.body;
    if (!name?.trim()) {
      return res.status(400).json({ message: 'Name is required' });
    }

    const duplicate = await Item.findOne({
      _id: { $ne: req.params.id },
      name: new RegExp(`^${name.trim()}$`, 'i')
    });
    if (duplicate) {
      return res.status(400).json({ message: 'An item with this name already exists' });
    }

    const updatedItem = await Item.findByIdAndUpdate(
      req.params.id,
      {
        name: name.trim(),
        type: type || 'quantity',
        defaultPrice: Number(defaultPrice) || 0
      },
      { new: true, runValidators: true }
    );

    if (!updatedItem) {
      return res.status(404).json({ message: 'Item not found' });
    }

    res.json(updatedItem);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete item
router.delete('/:id', requireSuperUser, async (req, res) => {
  try {
    const deletedItem = await Item.findByIdAndDelete(req.params.id);
    if (!deletedItem) {
      return res.status(404).json({ message: 'Item not found' });
    }
    res.json({ message: 'Item deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
