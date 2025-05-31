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
  const { email, password, base_bet, target_profit } = req.body;

  try {
    const browser = await puppeteer.launch({
      headless: true,
      executablePath: process.env.CHROME_PATH,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.goto("https://windice.io", { waitUntil: "networkidle2" });

    // Login Windice (anonim tidak perlu password jika memang tidak dibutuhkan)
    await page.click('button[data-target="#loginModal"]');
    await page.waitForSelector('#loginModal input[name="email"]');
    await page.type('#loginModal input[name="email"]', email, { delay: 30 });
    await page.type('#loginModal input[name="password"]', password, { delay: 30 });
    await page.click('#loginModal button[type="submit"]');

    await page.waitForTimeout(5000);

    // Cek login sukses
    const username = await page.$eval('#user-dropdown', el => el.textContent.trim());
    if (!username) throw new Error("Login gagal.");

    // Taruhan sederhana
    await page.type('input[placeholder*="Bet"]', base_bet.toString());
    await page.click('button:has-text("Bet High")');
    await page.waitForTimeout(6000);

    const resultText = await page.$eval('#last-result', el => el.textContent);

    await browser.close();

    res.send(`Login berhasil sebagai ${username}, hasil taruhan: ${resultText}`);
  } catch (e) {
    res.status(500).send("Gagal menjalankan bot: " + e.message);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server berjalan di port " + PORT));
