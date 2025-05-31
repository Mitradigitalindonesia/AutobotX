require('dotenv').config();
const express = require("express");
const puppeteer = require("puppeteer");
const bodyParser = require("body-parser");
const path = require("path");

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "index.html"));
});

app.post("/start-bot", async (req, res) => {
  const { username, base_bet, target_profit, strategy } = req.body;

  try {
    const browser = await puppeteer.launch({
      headless: true,
      executablePath: process.env.CHROME_PATH,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.goto("https://windice.io", { waitUntil: "networkidle2" });

    // Masukkan username anonim (tanpa login modal)
    await page.waitForSelector('#username');
    await page.type('#username', username);
    await page.click('#play-button'); // Tombol 'Play as guest'

    await page.waitForNavigation({ waitUntil: 'networkidle2' });

    // Buka halaman Dice
    await page.goto('https://windice.io/dice', { waitUntil: 'networkidle2' });

    // Masukkan jumlah taruhan
    await page.waitForSelector('input[placeholder*="Bet"]');
    await page.type('input[placeholder*="Bet"]', base_bet.toString());

    // Taruhan sederhana (contoh: 5x bet high)
    let resultLog = [];
    for (let i = 0; i < 5; i++) {
      await page.click('button[onclick*="betHigh"]'); // Ganti selector jika perlu
      await page.waitForTimeout(3000);

      const balance = await page.$eval('#balance', el => el.textContent.trim());
      resultLog.push(`🎲 Roll ${i + 1}: Saldo = ${balance}`);
    }

    await browser.close();

    res.send(`<pre>Bot berjalan sebagai ${username}.\n\n${resultLog.join('\n')}</pre>`);
  } catch (e) {
    res.status(500).send("❌ Gagal menjalankan bot: " + e.message);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("✅ Server berjalan di port " + PORT));
