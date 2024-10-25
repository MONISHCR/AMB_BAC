const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const QRCode = require('qrcode');
const cookieParser = require('cookie-parser');  // Import cookie-parser
const Admin = require('./models/Admin');  // Assuming the Admin model exists

const app = express();

// CORS Configuration
app.use(cors({
  origin: 'https://amb-events.vercel.app', // Replace with your frontend URL
  credentials: true, // Allow cookies to be sent
  methods: ['GET', 'POST'], // Explicitly allow methods
  allowedHeaders: ['Content-Type', 'Authorization'], // Allow required headers
}));

app.use(bodyParser.json());
app.use(cookieParser());  // Initialize cookie-parser middleware

const uri = 'mongodb+srv://Monish:Monish21@cluster0.mtbgshr.mongodb.net/amb?retryWrites=true&w=majority&appName=Cluster0';

// Connect to MongoDB
mongoose.connect(uri)
  .then(() => console.log('Connected to MongoDB'))
  .catch((error) => console.error('Error connecting to MongoDB:', error));

// Route to create a new event and generate QR codes
app.post('/admin/create-event', async (req, res) => {
  const { eventName, downloadLimit } = req.body;
  const qrCodes = Array.from({ length: downloadLimit }, (_, index) => ({
    qrCodeUrl: `${eventName}-QR-${index + 1}`,
    isAvailable: true,
  }));

  const newEvent = { 
    eventName, 
    ticketQRs: qrCodes, 
    downloadLimit, 
    downloadedCount: 0, 
    downloads: [] 
  };

  try {
    await Admin.updateOne({}, { $push: { events: newEvent } }, { upsert: true });
    res.send({ success: true, message: 'Event created successfully', event: newEvent });
  } catch (error) {
    console.error('Error creating event:', error);
    res.status(500).send({ success: false, message: 'Error creating event' });
  }
});

// Route to retrieve all events
app.get('/admin/events', async (req, res) => {
  try {
    const admin = await Admin.findOne();
    if (!admin || admin.events.length === 0) {
      return res.status(404).send({ success: false, message: 'No events found.' });
    }
    res.send({ success: true, events: admin.events });
  } catch (error) {
    console.error('Error retrieving events:', error);
    res.status(500).send({ success: false, message: 'Error retrieving events.' });
  }
});

// Route for user to download QR code for a specific event
app.post('/user/download', async (req, res) => {
  const { eventName, userId } = req.body;  // Removed deviceId

  try {
    const admin = await Admin.findOne({ 'events.eventName': eventName });
    if (!admin) return res.status(404).send({ success: false, message: 'Event not found.' });

    const event = admin.events.find(e => e.eventName === eventName);
    if (!event) return res.status(404).send({ success: false, message: 'Event not found.' });

    // Check if the user already has a cookie for this event
    const downloadedEvents = req.cookies.downloadedEvents || {};
    if (downloadedEvents[eventName]) {
      return res.status(200).send({
        success: false,
        message: 'QR code already downloaded for this event.',
        qrCode: downloadedEvents[eventName],
      });
    }

    if (event.downloadedCount >= event.downloadLimit) {
      return res.status(400).send({ success: false, message: 'All tickets for this event have been downloaded.' });
    }

    const qrIndex = event.downloadedCount;
    const qrCodeText = `${eventName}-QR-${qrIndex + 1}`;
    const qrCodeUrl = await QRCode.toDataURL(qrCodeText);

    // Record the download in the event
    event.downloads.push({ userId });
    event.downloadedCount += 1;

    await Admin.updateOne(
      { 'events._id': event._id },
      {
        $set: {
          'events.$.downloads': event.downloads,
          'events.$.downloadedCount': event.downloadedCount,
        },
      }
    );

    // Store the QR code in a cookie for 30 days
    const updatedDownloads = { ...downloadedEvents, [eventName]: qrCodeUrl };
    res.cookie('downloadedEvents', updatedDownloads, {
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      httpOnly: true, // Not accessible to JavaScript
      secure: true, // Set to true if using HTTPS
      sameSite: 'none', // Allow cross-origin requests
    });

    res.send({ success: true, qrCode: qrCodeUrl });
  } catch (error) {
    console.error('Error downloading QR code:', error);
    res.status(500).send({ success: false, message: 'Error downloading QR code.' });
  }
});

// Route to clear cookies (for testing purposes)
app.get('/clear-cookies', (req, res) => {
  res.clearCookie('downloadedEvents');
  res.send({ success: true, message: 'Cookies cleared!' });
});

// Start the server
app.listen(5000, () => console.log('Server running on port 5000'));
