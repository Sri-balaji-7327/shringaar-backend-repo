const express = require('express')
const { google } = require('googleapis')
const cors = require('cors')
const dotenv = require('dotenv')
const path = require('path')
const fs = require('fs')

dotenv.config()
const app = express()
const PORT = process.env.PORT || 5000

// ✅ Fix: Explicit CORS setup
app.use(
  cors({
    origin: [
      'http://localhost:5173',
      'https://sbgs.ap-south-1.elasticbeanstalk.com',
      // Add your production frontend if needed
    ],
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
)

app.use(express.json())

const SHEET_ID = process.env.SHEET_ID
const CELL = process.env.EDIT_RANGE
const GETRANGE = process.env.GET_RANGE

let keyFilePath

if (process.env.GOOGLE_SERVICE_KEY_BASE64) {
  keyFilePath = path.join(__dirname, 'temp-key.json')
  fs.writeFileSync(
    keyFilePath,
    Buffer.from(process.env.GOOGLE_SERVICE_KEY_BASE64, 'base64')
  )
} else {
  keyFilePath = path.join(__dirname, 'shringaar-key-file.json')
}

const Auth = new google.auth.GoogleAuth({
  keyFile: keyFilePath,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
})

async function searchCodeData(code) {
  try {
    const authClient = await Auth.getClient()
    const sheetsClient = google.sheets({ version: 'v4', auth: authClient })

    await sheetsClient.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: CELL,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[code]],
      },
    })

    const rangeRes = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: GETRANGE,
    })

    const product = rangeRes.data.values || []
    return product
  } catch (e) {
    console.error('❌ Error fetching sheet data:', e)
    return null
  }
}

app.get('/', (req, res) => {
  res.send('Backend is running 🚀')
})

app.get('/api/sheet', async (req, res) => {
  const { code } = req.query
  if (!code) return res.status(400).json({ error: 'Product code is required' })

  const product = await searchCodeData(code)

  if (!product) return res.status(404).json({ error: 'Product not found' })

  res.json({ code, ...product })
})

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`)
})
