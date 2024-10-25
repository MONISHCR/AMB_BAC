// models/Admin.js
const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  eventName: { type: String, required: true },
  ticketQRs: [{ qrCodeUrl: String, isAvailable: { type: Boolean, default: true } }], // Store each QR code's URL and its availability
  downloadLimit: { type: Number, required: true },
  downloadedCount: { type: Number, default: 0 },
  downloads: [{ userId: String, deviceId: String }] // Track downloads per user per device
});

const Admin = mongoose.model('Admin', {
  events: [eventSchema]  
},'amb');

module.exports = Admin;
