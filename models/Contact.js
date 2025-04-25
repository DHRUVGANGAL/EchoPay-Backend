// models/Contact.js
const mongoose = require('mongoose');

// Contact Schema for single user system
const contactSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true,
    lowercase: true, // Store names in lowercase for easy lookup
    trim: true,      // Remove whitespace
    unique: true,    // Names must be unique in a single-user system
    index: true      // Create index for faster lookups
  },
  address: { 
    type: String, 
    required: true,
    validate: {
      validator: (value) => /^0x[a-fA-F0-9]{40}$/.test(value),
      message: 'Invalid Ethereum address format'
    }
  }
});

// Create the model
const Contact = mongoose.model('Contact', contactSchema);

// Repository pattern for Contact operations
class ContactRepository {
  /**
   * Create a new contact
   * @param {Object} contactData - Contact data (name and address)
   * @returns {Promise<Object>} - Created contact
   */
  static async create(contactData) {
    try {
      const contact = new Contact({
        name: contactData.name,
        address: contactData.address
      });
      return await contact.save();
    } catch (error) {
      // Handle duplicate key error
      if (error.code === 11000) {
        throw new Error(`Contact with name "${contactData.name}" already exists`);
      }
      throw error;
    }
  }
  
/**
 * Find contact by name
 * @param {string} name - Contact name
 * @returns {Promise<Object|null>} - Contact or null if not found
 */
static async findByName(name) {
   const normalizedName = name.toLowerCase().trim().replace(/[^\w\s]/g, '');
    console.log('Searching for normalized name:', normalizedName);
    
    // Try exact match first
    const contact = await Contact.findOne({ name: normalizedName });
    if (contact) return contact;
    
    // If exact match fails, try a case-insensitive search
    return Contact.findOne({ 
      name: { $regex: new RegExp('^' + normalizedName + '$', 'i') } 
    });
  }
  
  /**
   * Get all contacts
   * @returns {Promise<Array>} - List of all contacts
   */
  static async findAll() {
    return Contact.find().sort({ name: 1 });
  }
  
  /**
   * Update a contact
   * @param {string} id - Contact ID
   * @param {Object} updateData - Fields to update
   * @returns {Promise<Object|null>} - Updated contact or null if not found
   */
  static async update(id, updateData) {
    return Contact.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );
  }
  
  /**
   * Delete a contact
   * @param {string} id - Contact ID
   * @returns {Promise<boolean>} - True if deleted, false otherwise
   */
  static async delete(id) {
    const result = await Contact.deleteOne({ _id: id });
    return result.deletedCount > 0;
  }
}

module.exports = {
  Contact,
  ContactRepository
};