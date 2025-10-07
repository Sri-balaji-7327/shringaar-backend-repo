const express = require('express')
const { google } = require('googleapis')
const cors = require('cors')
const dotenv = require('dotenv')
const path = require('path')
dotenv.config()

const app = express()
const PORT = 5000

app.use(cors())
app.use(express.json())

const SHEET_ID = process.env.SHEET_ID
const CELL = process.env.EDIT_RANGE // e.g., "Sheet1!A2"
const GETRANGE = process.env.GET_RANGE // e.g., "Sheet1!A2:H100"

const fs = require('fs')

let keyFilePath

if (process.env.GOOGLE_SERVICE_KEY_BASE64) {
  // If running in production (no JSON file, using environment variable)
  keyFilePath = path.join(__dirname, 'temp-key.json')
  fs.writeFileSync(
    keyFilePath,
    Buffer.from(process.env.GOOGLE_SERVICE_KEY_BASE64, 'base64')
  )
} else {
  // If running locally (JSON file exists)
  keyFilePath = path.join(__dirname, 'shringaar-key-file.json')
}

//  GOOGLE SHEETS AUTHENTICATION

const Auth = new google.auth.GoogleAuth({
  keyFile: keyFilePath,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
})

// ✅ Function to fetch product data by code
async function searchCodeData(code) {
  console.log('checkong code ', code)
  try {
    const authClient = await Auth.getClient()
    const sheetsClient = google.sheets({ version: 'v4', auth: authClient })

    // 1️⃣ Update the given code into the target cell (EDIT_RANGE)
    // 1️⃣ Update the given code into the target cell (EDIT_RANGE)
    await sheetsClient.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: CELL, // e.g. "QUOTATION!B1"
      valueInputOption: 'USER_ENTERED', // ✅ Fix for extra apostrophe issue
      requestBody: {
        values: [[code]],
      },
    })

    console.log(`✅ Updated ${CELL} with code:`, code)

    // 2️⃣ Get the full data range
    const rangeRes = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: GETRANGE,
    })
    const product = rangeRes.data.values || []
    console.log('checkong code7 ', code)

    // 3️⃣ Find the row matching the code

    if (!product) return null

    // 4️⃣ Map columns to keys (adjust depending on your sheet structure)

    return product
  } catch (e) {
    console.error('❌ Error fetching sheet data:', e)
    return null
  }
}

// ✅ Root route
app.get('/', (req, res) => {
  res.send('Backend is running 🚀')
})

// ✅ API route to get product by code
app.get('/api/sheet', async (req, res) => {
  const { code } = req.query
  console.log('checkong code ', code)
  if (!code) return res.status(400).json({ error: 'Product code is required' })

  const product = await searchCodeData(code)

  if (!product) return res.status(404).json({ error: 'Product not found' })

  res.json({ code, ...product })
})

// ✅ Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
