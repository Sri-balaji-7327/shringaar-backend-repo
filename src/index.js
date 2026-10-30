
const express = require('express');
const { google } = require('googleapis');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// =====================================
// MIDDLEWARE
// =====================================

app.use(
  cors({
    origin: [
      'http://localhost:5173',
      'https://shringaar-frontend-repo.onrender.com',
    ],
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(express.json());

// =====================================
// ENVIRONMENT CONFIGURATION
// =====================================

const SHEET_ID = process.env.SHEET_ID;
const EDIT_RANGE = process.env.EDIT_RANGE;
const GETRANGE = process.env.GETRANGE || process.env.GET_RANGE;

if (!SHEET_ID || !EDIT_RANGE || !GETRANGE) {
  console.error('❌ Missing Google Sheets environment variables');
  process.exit(1);
}

// =====================================
// GOOGLE SERVICE ACCOUNT CREDENTIALS
// =====================================

let credentials;

try {
  const base64Path = path.resolve(process.cwd(), 'key-base64.txt');

  let base64String = '';

  if (fs.existsSync(base64Path)) {
    base64String = fs.readFileSync(base64Path, 'utf8').trim();
  } else if (process.env.GOOGLE_SERVICE_KEY_BASE64) {
    base64String = process.env.GOOGLE_SERVICE_KEY_BASE64.trim();
  }

  if (!base64String) {
    throw new Error('Google Service Account Base64 credentials not found');
  }

  const jsonString = Buffer.from(base64String, 'base64')
    .toString('utf8')
    .replace(/^\uFEFF/, '');

  credentials = JSON.parse(jsonString);

  if (
    credentials.type !== 'service_account' ||
    !credentials.client_email ||
    !credentials.private_key
  ) {
    throw new Error('Invalid Google Service Account credentials');
  }

  console.log('✅ Google credentials loaded successfully');
} catch (error) {
  console.error('❌ Credential loading failed:', error.message);
  process.exit(1);
}

// =====================================
// GOOGLE JWT AUTHENTICATION
// =====================================

const jwtClient = new google.auth.JWT({
  email: credentials.client_email,
  key: credentials.private_key,
  scopes: [
    'https://www.googleapis.com/auth/spreadsheets',
  ],
});

const sheetsClient = google.sheets({
  version: 'v4',
  auth: jwtClient,
});

// =====================================
// AUTHENTICATION INITIALIZATION
// =====================================

async function initializeGoogleAuth() {
  try {
    await jwtClient.authorize();
    console.log('✅ Google Sheets authentication successful');
  } catch (error) {
    console.error(
      '❌ Google authentication failed:',
      error.response?.data || error.message
    );

    throw error;
  }
}

// =====================================
// SEARCH PRODUCT CODE IN GOOGLE SHEETS
// =====================================

async function searchCodeData(code) {
  try {
    // 1. Write product code to configured cell

    await sheetsClient.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: EDIT_RANGE,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[code]],
      },
    });

    // 2. Fetch calculated formula range

    const rangeRes = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: GETRANGE,
    });

    return rangeRes.data.values || [];

  } catch (error) {
    console.error(
      '❌ Error fetching sheet data:',
      error.response?.data || error.message
    );

    throw error;
  }
}

// =====================================
// ROUTES
// =====================================

app.get('/', (req, res) => {
  res.send('Backend is running 🚀');
});

// =====================================
// PRODUCT SEARCH API
// =====================================

app.get('/api/sheet', async (req, res) => {
  try {
    const code = String(req.query.code || '').trim();

    console.log(code, 'Product Code');

    if (!code) {
      return res.status(400).json({
        success: false,
        error: 'Product code is required',
      });
    }

    const product = await searchCodeData(code);

    if (!product || product.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Product not found',
      });
    }

    return res.status(200).json({
      success: true,
      code,
      data: product,
    });

  } catch (error) {
    const statusCode = error.response?.status;

    if (statusCode === 401 || statusCode === 403) {
      return res.status(502).json({
        success: false,
        error: 'Google Sheets authentication or permission error',
        details: error.response?.data?.error?.message || error.message,
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Failed to fetch product data',
      details: error.message,
    });
  }
});

// =====================================
// START SERVER
// =====================================

async function startServer() {
  try {
    await initializeGoogleAuth();

    app.listen(PORT, () => {
      console.log(`✅ Server running on port ${PORT}`);
    });

  } catch (error) {
    console.error('❌ Server startup failed due to Google authentication');
    process.exit(1);
  }
}

startServer();
