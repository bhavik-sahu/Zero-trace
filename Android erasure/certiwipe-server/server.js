// At the very top, load environment variables
require('dotenv').config();

// --- IMPORTS ---
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const { ethers } = require('ethers');
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const nodemailer = require('nodemailer');
const { uploadJsonToIpfs, uploadFileToIpfs } = require('./pinataUploader');

// --- ENVIRONMENT VARIABLE CHECKS ---
const {
  PORT = 3000,
  MONGO_URI,
  AMOY_API_URL,
  WALLET_PRIVATE_KEY,
  CONTRACT_ADDRESS,
  EMAIL_HOST,
  EMAIL_PORT,
  EMAIL_USER,
  EMAIL_PASS,
  EMAIL_FROM,
} = process.env;

if (!MONGO_URI || !AMOY_API_URL || !WALLET_PRIVATE_KEY || !CONTRACT_ADDRESS) {
  console.error('🔥 Missing critical environment variables. Check your .env file.');
  process.exit(1);
}

// --- EMAIL TRANSPORTER SETUP ---
let emailTransporter = null;
if (EMAIL_HOST && EMAIL_USER && EMAIL_PASS) {
  emailTransporter = nodemailer.createTransport({
    host: EMAIL_HOST,
    port: parseInt(EMAIL_PORT) || 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASS,
    },
  });
  console.log('✅ Email transporter configured');
} else {
  console.log('⚠️ Email not configured - PDF attachments disabled');
}

// --- DATABASE CONNECTION ---
mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ Could not connect to MongoDB', err));

// --- SCHEMAS ---
const certificateSchema = new mongoose.Schema({
  certificateId: { type: String, required: true, unique: true },
  jsonCid: { type: String, required: true },
  pdfCid: { type: String, required: true },
  transactionId: { type: String, required: true },
  deviceModel: String,
  deviceImei: { type: String, required: true, index: true }, // IMEI for tracking
  deviceSerial: String,
  timestamp: { type: Date, default: Date.now },
});

// Device tracking schema for complete audit trail
const deviceTrackingSchema = new mongoose.Schema({
  imei: { type: String, required: true, index: true },
  deviceModel: String,
  serialNumber: String,
  erasureCount: { type: Number, default: 0 },
  erasureHistory: [{
    certificateId: String,
    timestamp: Date,
    method: String,
    compliance: String,
    passes: Number,
    duration: Number,
    transactionId: String,
    verified: { type: Boolean, default: true }
  }],
  firstSeen: { type: Date, default: Date.now },
  lastErasure: Date,
  status: { type: String, enum: ['active', 'retired', 'flagged'], default: 'active' }
});

const Certificate = mongoose.model('Certificate', certificateSchema);
const DeviceTracking = mongoose.model('DeviceTracking', deviceTrackingSchema);

// --- NFT MINTING HELPER WITH DEVICE TRACKING ---
async function mintNftWithDeviceData(ipfsCid, imei, deviceModel) {
  const provider = new ethers.JsonRpcProvider(AMOY_API_URL);
  const signer = new ethers.Wallet(WALLET_PRIVATE_KEY, provider);
  // Enhanced contract ABI to include device tracking
  const contractABI = [
    "function mintCertificate(address recipient, string memory ipfsCID) public returns (uint256)",
    "function logDeviceErasure(string memory imei, string memory deviceModel, string memory ipfsCID) public"
  ];
  const contract = new ethers.Contract(CONTRACT_ADDRESS, contractABI, signer);
  
  // First log device erasure for tracking
  try {
    const deviceTx = await contract.logDeviceErasure(imei, deviceModel, ipfsCid);
    await deviceTx.wait();
    console.log(`✅ Device erasure logged on blockchain: ${deviceTx.hash}`);
  } catch (error) {
    console.warn(`⚠️ Device logging failed (contract might not support it): ${error.message}`);
  }
  
  // Then mint the certificate NFT
  const tx = await contract.mintCertificate(signer.address, ipfsCid);
  await tx.wait();
  return tx.hash;
}

// --- DEVICE TRACKING HELPER ---
async function updateDeviceTracking(imei, certificateData, certificateId, transactionId) {
  try {
    const deviceInfo = certificateData.device_info;
    const wipeDetails = certificateData.wipe_details;
    
    const erasureEntry = {
      certificateId: certificateId,
      timestamp: new Date(),
      method: wipeDetails.method,
      compliance: wipeDetails.compliance,
      passes: wipeDetails.passes,
      duration: wipeDetails.duration_seconds,
      transactionId: transactionId,
      verified: true
    };
    
    // Check if device exists first
    let device = await DeviceTracking.findOne({ imei: imei });
    
    if (device) {
      // Device exists - just update erasure count, history, and lastErasure
      device.erasureCount += 1;
      device.erasureHistory.push(erasureEntry);
      device.lastErasure = new Date();
      await device.save();
      console.log(`✅ Device tracking updated for IMEI: ${imei} (Total erasures: ${device.erasureCount})`);
    } else {
      // Device doesn't exist - create new one
      device = new DeviceTracking({
        imei: imei,
        deviceModel: deviceInfo.model,
        serialNumber: deviceInfo.serial,
        erasureCount: 1,
        erasureHistory: [erasureEntry],
        firstSeen: new Date(),
        lastErasure: new Date(),
        status: 'active'
      });
      await device.save();
      console.log(`✅ New device created for IMEI: ${imei} (First erasure recorded)`);
    }
    
    return device;
  } catch (error) {
    console.error(`❌ Device tracking failed for IMEI: ${imei}`, error.message);
    throw error;
  }
}

// --- EMAIL HELPER FUNCTION ---
async function sendCertificateByEmail(userEmail, certificateId, pdfBuffer, deviceModel) {
  if (!emailTransporter) {
    console.log('⚠️ Email not configured, skipping email send');
    return { success: false, message: 'Email service not configured' };
  }

  try {
    const mailOptions = {
      from: EMAIL_FROM,
      to: userEmail,
      subject: `ZeroTrace Certificate - ${certificateId}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px; color: white; text-align: center;">
            <h1 style="margin: 0; font-size: 28px; font-weight: bold;">ZeroTrace Certificate</h1>
            <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Secure Data Erasure Verification</p>
          </div>
          
          <div style="background: white; padding: 30px; border-radius: 10px; margin-top: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <h2 style="color: #333; margin-top: 0;">Certificate Details</h2>
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p><strong>Certificate ID:</strong> <span style="color: #667eea; font-family: monospace;">${certificateId}</span></p>
              <p><strong>Device Model:</strong> ${deviceModel || 'N/A'}</p>
              <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
              <p><strong>Status:</strong> <span style="color: #28a745; font-weight: bold;">✅ Verified & Blockchain Secured</span></p>
            </div>
            
            <h3 style="color: #333;">What's included:</h3>
            <ul style="color: #666; line-height: 1.6;">
              <li>📎 <strong>PDF Certificate:</strong> Official proof of data erasure (attached)</li>
              <li>🔗 <strong>Blockchain Record:</strong> Immutable transaction on Polygon network</li>
              <li>📊 <strong>IPFS Storage:</strong> Decentralized certificate storage</li>
              <li>🔒 <strong>Device Tracking:</strong> Complete audit trail by IMEI</li>
            </ul>
            
            <div style="background: #e8f5e8; padding: 15px; border-radius: 8px; border-left: 4px solid #28a745; margin: 20px 0;">
              <p style="margin: 0; color: #155724;"><strong>Security Note:</strong> This certificate is cryptographically signed and stored on IPFS with blockchain verification. It serves as tamper-proof evidence of secure data erasure.</p>
            </div>
          </div>
          
          <div style="text-align: center; margin-top: 30px; color: #666; font-size: 14px;">
            <p>Generated by <strong>ZeroTrace</strong> • Enterprise Data Erasure Platform</p>
            <p>Need help? Contact support or visit our documentation.</p>
          </div>
        </div>
      `,
      attachments: [
        {
          filename: `${certificateId}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf'
        }
      ]
    };

    const info = await emailTransporter.sendMail(mailOptions);
    console.log(`✅ Certificate emailed to ${userEmail}: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`❌ Email sending failed for ${userEmail}:`, error.message);
    return { success: false, message: error.message };
  }
}

// --- PROFESSIONAL PDF GENERATION HELPER ---
async function generateCertificatePdf(data) {
  return new Promise(async (resolve) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const buffers = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));

    // Helper functions for layout
    const drawSectionHeader = (text, y) => {
      doc.fontSize(14).font('Helvetica-Bold').text(text, 50, y);
      doc.moveTo(50, y + 20).lineTo(550, y + 20).stroke();
    };
    const drawTableRow = (y, label, value) => {
      doc.fontSize(11).font('Helvetica-Bold').text(label, 70, y);
      doc.font('Helvetica').text(value || 'N/A', 200, y);
    };

    // --- START OF QR CODE CURATION ---
    // Create a curated JSON object with only the visible data for the QR code
    const curatedQrData = {
      certificate_id: data.certificate_id,
      device_info: {
        model: data.device_info.model,
        serial_number: data.device_info.serial,
        storage_gb: (data.device_info.size_bytes / (1024 ** 3)).toFixed(2) + ' GB'
      },
      wipe_details: {
        method: data.wipe_details.method,
        compliance: data.wipe_details.compliance,
        passes: data.wipe_details.passes,
        duration_minutes: (data.wipe_details.duration_seconds / 60).toFixed(0) + ' minutes',
        hpa_dco_erased: data.wipe_details.hpa_removed ? 'Yes' : 'No'
      },
      verification: {
        algorithm: 'SHA-256 (Example)', // Still using placeholder
        final_hash: data.verification.result
      }
    };
    const qrCodeDataUrl = await QRCode.toDataURL(JSON.stringify(curatedQrData));
    // --- END OF QR CODE CURATION ---

    // Header
    doc.fontSize(10).font('Helvetica').text(`Certificate ID: ${data.certificate_id}`, 350, 50, { align: 'right' });
    doc.fontSize(22).font('Helvetica-Bold').text('Certificate of Data Erasure', 50, 80, { align: 'center' });
    doc.fontSize(12).font('Helvetica').text('Issued by SecureWipe – Trusted Data Erasure', 50, 110, { align: 'center' });
    doc.moveTo(50, 140).lineTo(550, 140).stroke();

    // Section: Device Information
    let y = 160;
    drawSectionHeader('Device Information', y);
    y += 35;
    drawTableRow(y, 'Model', data.device_info.model);
    y += 20;
    drawTableRow(y, 'Serial Number', data.device_info.serial);
    y += 20;
    const sizeInGB = (data.device_info.size_bytes / (1024 ** 3)).toFixed(2);
    drawTableRow(y, 'Storage', `${sizeInGB} GB`);

    // Section: Wipe Details
    y += 50;
    drawSectionHeader('Wipe Details', y);
    y += 35;
    drawTableRow(y, 'Method', data.wipe_details.method);
    y += 20;
    drawTableRow(y, 'Compliance', data.wipe_details.compliance);
    y += 20;
    drawTableRow(y, 'Passes', data.wipe_details.passes.toString());
    y += 20;
    const durationInMinutes = (data.wipe_details.duration_seconds / 60).toFixed(0);
    drawTableRow(y, 'Duration', `${durationInMinutes} minutes`);
    y += 20;
    drawTableRow(y, 'HPA/DCO Erased', data.wipe_details.hpa_removed ? 'Yes' : 'No');

    // Section: Verification
    y += 50;
    drawSectionHeader('Verification', y);
    y += 35;
    drawTableRow(y, 'Algorithm', 'SHA-256 (Example)');
    y += 20;
    drawTableRow(y, 'Final Hash', data.verification.result);

    // Footer
    doc.image(qrCodeDataUrl, 420, 600, { fit: [130, 130] });
    doc.fontSize(10).text('Scan to Verify Certificate', 420, 735, { align: 'center' });
    doc.fontSize(10).text(`Issued by: SecureWipe Rust Engine v1.0`, 50, 650);
    doc.text(`Date: ${new Date(data.wipe_details.end_time).toUTCString()}`, 50, 665);
    doc.text('Authorized Signature', 50, 720);
    doc.moveTo(50, 760).lineTo(250, 760).stroke();

    doc.end();
  });
}

// --- EXPRESS APP SETUP & ENDPOINTS ---
const app = express();
app.use(cors());
app.use(express.json());

// Serve static files (for serving the frontend)
app.use(express.static('public'));

app.get('/api/certificates/:id', async (req, res) => {
    try {
        const record = await Certificate.findOne({ certificateId: req.params.id });
        if (!record) {
            return res.status(404).json({ success: false, message: 'Certificate not found.' });
        }
        res.status(200).json({ success: true, data: record });
    } catch (error) {
        res.status(500).json({ success: false, message: 'An internal server error occurred.' });
    }
});

app.post('/api/certificates/process', async (req, res) => {
  try {
    const uniqueId = `CERT-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const { userEmail, ...certificatePayload } = req.body; // Extract email from request
    const certificateData = { ...certificatePayload, certificate_id: uniqueId };
    
    // Validate IMEI presence
    const imei = certificateData.device_info?.imei;
    if (!imei) {
      return res.status(400).json({ success: false, message: 'IMEI is required for device tracking.' });
    }
    
    const pdfBuffer = await generateCertificatePdf(certificateData);
    
    const jsonCid = await uploadJsonToIpfs(certificateData, `${uniqueId}.json`);
    const pdfCid = await uploadFileToIpfs(pdfBuffer, `${uniqueId}.pdf`);
    console.log(`Successfully pinned JSON (CID: ${jsonCid}) and PDF (CID: ${pdfCid})`);

    // Enhanced minting with device data
    const transactionId = await mintNftWithDeviceData(jsonCid, imei, certificateData.device_info.model);
    console.log(`✅ NFT Minted with device tracking! Transaction ID: ${transactionId}`);

    // Update device tracking in MongoDB
    const deviceRecord = await updateDeviceTracking(imei, certificateData, uniqueId, transactionId);

    const newRecord = new Certificate({
      certificateId: uniqueId,
      jsonCid: jsonCid,
      pdfCid: pdfCid,
      transactionId: transactionId,
      deviceModel: certificateData.device_info.model,
      deviceImei: imei,
      deviceSerial: certificateData.device_info.serial,
    });
    await newRecord.save();
    console.log('✅ Certificate record saved successfully.');
    
    // Send email if provided
    let emailResult = null;
    if (userEmail && userEmail.trim()) {
      emailResult = await sendCertificateByEmail(
        userEmail.trim(),
        uniqueId,
        pdfBuffer,
        certificateData.device_info.model
      );
    }
    
    res.status(201).json({
      success: true,
      message: 'Certificate created and processed successfully!',
      certificateId: uniqueId,
      jsonCid: jsonCid,
      pdfCid: pdfCid,
      transactionId: transactionId,
      emailSent: emailResult?.success || false,
      emailMessage: emailResult?.success ? 'Certificate sent to email' : emailResult?.message,
      deviceTrackingInfo: {
        imei: imei,
        totalErasures: deviceRecord.erasureCount,
        firstSeen: deviceRecord.firstSeen,
        lastErasure: deviceRecord.lastErasure
      }
    });
  } catch (error) {
    console.error('Error processing certificate:', error.message);
    res.status(500).json({ success: false, message: 'An internal server error occurred.' });
  }
});

// --- DEVICE TRACKING ENDPOINTS ---

// Get device history by IMEI
app.get('/api/devices/:imei', async (req, res) => {
    try {
        const device = await DeviceTracking.findOne({ imei: req.params.imei });
        if (!device) {
            return res.status(404).json({ success: false, message: 'Device not found.' });
        }
        
        res.status(200).json({ 
            success: true, 
            data: {
                imei: device.imei,
                deviceModel: device.deviceModel,
                serialNumber: device.serialNumber,
                erasureCount: device.erasureCount,
                firstSeen: device.firstSeen,
                lastErasure: device.lastErasure,
                status: device.status,
                erasureHistory: device.erasureHistory.sort((a, b) => b.timestamp - a.timestamp) // Latest first
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'An internal server error occurred.' });
    }
});

// Get all devices with their erasure counts
app.get('/api/devices', async (req, res) => {
    try {
        const { page = 1, limit = 20, status } = req.query;
        const query = status ? { status } : {};
        
        const devices = await DeviceTracking.find(query)
            .select('imei deviceModel serialNumber erasureCount firstSeen lastErasure status')
            .sort({ lastErasure: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);
            
        const total = await DeviceTracking.countDocuments(query);
        
        res.status(200).json({ 
            success: true, 
            data: devices,
            pagination: {
                current: page,
                total: Math.ceil(total / limit),
                count: devices.length,
                totalDevices: total
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'An internal server error occurred.' });
    }
});

// Get device statistics
app.get('/api/devices/stats/summary', async (req, res) => {
    try {
        const totalDevices = await DeviceTracking.countDocuments();
        const totalErasures = await DeviceTracking.aggregate([
            { $group: { _id: null, total: { $sum: '$erasureCount' } } }
        ]);
        
        const recentlyErased = await DeviceTracking.countDocuments({
            lastErasure: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Last 30 days
        });
        
        const topDevices = await DeviceTracking.find()
            .select('imei deviceModel erasureCount lastErasure')
            .sort({ erasureCount: -1 })
            .limit(10);
            
        res.status(200).json({ 
            success: true, 
            data: {
                totalDevices,
                totalErasures: totalErasures[0]?.total || 0,
                recentlyErased,
                topDevices
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'An internal server error occurred.' });
    }
});

// Update device status (active/retired/flagged)
app.patch('/api/devices/:imei/status', async (req, res) => {
    try {
        const { status } = req.body;
        if (!['active', 'retired', 'flagged'].includes(status)) {
            return res.status(400).json({ success: false, message: 'Invalid status. Must be active, retired, or flagged.' });
        }
        
        const device = await DeviceTracking.findOneAndUpdate(
            { imei: req.params.imei },
            { status },
            { new: true }
        );
        
        if (!device) {
            return res.status(404).json({ success: false, message: 'Device not found.' });
        }
        
        res.status(200).json({ 
            success: true, 
            message: `Device status updated to ${status}`,
            data: device
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'An internal server error occurred.' });
    }
});

// --- START THE SERVER ---
app.listen(PORT, () => {
  console.log(`✅ Server is running and listening on http://localhost:${PORT}`);
});