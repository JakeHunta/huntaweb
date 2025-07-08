import express from 'express';
import cors from 'cors';
import puppeteer from 'puppeteer';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());

app.post('/search', async (req, res) => {
  const { search_term } = req.body;

  if (!search_term) {
    return res.status(400).json({ error: 'Missing search_term' });
  }

  try {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    const url = `https://www.gumtree.com/search?search_category=all&q=${encodeURIComponent(search_term)}`;
    await page.goto(url, { waitUntil: 'domcontentloaded' });

    const content = await page.evaluate(() => document.body.innerText);
    await browser.close();

    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are Hunta, an AI that extracts second-hand listings from raw scraped data. Extract:
- title
- image (if available)
- price
- link (if available)
- source ('Gumtree')

Respond in this JSON format:
[
  {"title": "...", "image": "...", "price": "...", "link": "...", "source": "Gumtree"},
  ...
]`
          },
          {
            role: "user",
            content: content.slice(0, 12000)
          }
        ]
      })
    });

    const result = await openaiResponse.json();
    const structured = JSON.parse(result.choices[0].message.content);
    res.json(structured);

  } catch (err) {
    console.error('[ERROR]', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/', (req, res) => {
  res.send('🟢 Hunta backend is running.');
});

app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
