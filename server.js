const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const QRCode = require('qrcode'); // Import QRCode package

// Define the event schema
const eventSchema = new mongoose.Schema({
  eventName: { type: String, required: true },
  qrCodes: [{ type: String }],
  downloadLimit: { type: Number, required: true },
  downloadedCount: { type: Number, default: 0 },
  downloads: [{ userId: String, deviceId: String }]
});

const Admin = mongoose.model('Admin', {
  events: [eventSchema]
});

const app = express();

app.use(cors());
app.use(bodyParser.json());

const uri = 'mongodb+srv://Monish:Monish21@cluster0.mtbgshr.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

// Connect to MongoDB
mongoose.connect(uri)
  .then(() => {
    console.log('Connected to MongoDB');
    initializeDatabase(); // Initialize database and collection
  })
  .catch((error) => console.error('Error connecting to MongoDB:', error));

// Route to create a new event and generate QR codes
app.post('/admin/create-event', async (req, res) => {
  const { eventName, downloadLimit } = req.body;
  const qrCodes = Array.from({ length: downloadLimit }, (_, index) => `${eventName}-QR-${index + 1}`);
  const newEvent = { eventName, qrCodes, downloadLimit, downloadedCount: 0, downloads: [] };

  try {
    await Admin.updateOne({}, { $push: { events: newEvent } }, { upsert: true });
    res.send({ success: true, message: 'Event created successfully', event: newEvent });
  } catch (error) {
    console.error('Error creating event:', error);
    res.send({ success: false, message: 'Error creating event' });
  }
});

// Route to retrieve all events
app.get('/admin/events', async (req, res) => {
  try {
    const admin = await Admin.findOne();
    if (!admin) return res.send({ success: false, message: 'No events found.' });

    res.send({ success: true, events: admin.events });
  } catch (error) {
    console.error('Error retrieving events:', error);
    res.send({ success: false, message: 'Error retrieving events.' });
  }
});

// Route for user to download QR code for a specific event
app.post('/user/download', async (req, res) => {
  const { eventName, userId, deviceId } = req.body;

  try {
    const admin = await Admin.findOne({ 'events.eventName': eventName });
    if (!admin) return res.send({ success: false, message: 'Event not found.' });

    const event = admin.events.find(e => e.eventName === eventName);
    if (!event) return res.send({ success: false, message: 'Event not found.' });

    const existingDownload = event.downloads.find(download => download.deviceId === deviceId);
    if (existingDownload) {
      return res.send({ success: false, message: 'You have already downloaded a ticket for this event from this device.' });
    }

    if (event.downloadedCount >= event.downloadLimit) {
      return res.send({ success: false, message: 'All tickets for this event have been downloaded.' });
    }

    const qrIndex = event.downloadedCount; 
    const qrCodeText = `${eventName}-QR-${qrIndex + 1}`;
    const qrCodeUrl = await QRCode.toDataURL(qrCodeText);

    event.downloads.push({ userId, deviceId });
    event.downloadedCount += 1;

    await Admin.updateOne(
      { 'events._id': event._id },
      {
        'events.$.downloads': event.downloads,
        'events.$.downloadedCount': event.downloadedCount,
      }
    );

    res.send({ success: true, qrCode: qrCodeUrl });
  } catch (error) {
    console.error('Error downloading QR code:', error);
    res.send({ success: false, message: 'Error downloading QR code.' });
  }
});

async function initializeDatabase() {
  const db = mongoose.connection.useDb('amb'); // Use 'amb' database
  await db.createCollection('events'); // Create 'events' collection if it doesn't exist
  console.log('Database and collection initialized');
}


// Start server
app.listen(5000, () => console.log('Server running on port 5000'));
