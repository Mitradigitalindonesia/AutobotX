require('dotenv').config();
const express = require("express");
const puppeteer = require("puppeteer");
const bodyParser = require("body-parser");
const path = require("path");

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static("public"));

let browser; // Browser global, biar gak launch terus
let pages = {}; // simpan page per user session, simple object. Bisa upgrade pakai DB / Redis

// Landing page: form login/register
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "index.html"));
});

// Register user baru di Windice via Puppeteer
app.post("/register", async (req, res) => {
  const { username, password, email } = req.body;

  try {
    if (!browser) browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox','--disable-setuid-sandbox'] });
    const page = await browser.newPage();

    await page.goto("https://windice.io/register", { waitUntil: "networkidle2" });

    // Isi form registrasi sesuai field Windice (cek selector)
    await page.type('#username', username);
    await page.type('#password', password);
    await page.type('#email', email);

    // Klik daftar
    await page.click('#register-button'); // sesuaikan selector

    await page.waitForNavigation({ waitUntil: 'networkidle2' });

    // Cek apakah berhasil daftar, misal cek url atau pesan sukses
    if (page.url().includes("dashboard") || await page.$('.welcome-message')) {
      res.json({ success: true, message: "Registrasi berhasil. Silakan login." });
    } else {
      const error = await page.$eval('.error-message', el => el.textContent.trim()).catch(() => 'Gagal registrasi');
      res.json({ success: false, message: error });
    }

    await page.close();

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Login user via Puppeteer (simpan session di pages object)
app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    if (!browser) browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox','--disable-setuid-sandbox'] });
    const page = await browser.newPage();

    await page.goto("https://windice.io/login", { waitUntil: "networkidle2" });

    await page.type('#username', username);
    await page.type('#password', password);
    await page.click('#login-button');

    await page.waitForNavigation({ waitUntil: "networkidle2" });

    if (page.url().includes("dashboard")) {
      pages[username] = page; // simpan page untuk session user
      res.json({ success: true, message: "Login berhasil" });
    } else {
      const error = await page.$eval('.error-message', el => el.textContent.trim()).catch(() => 'Gagal login');
      await page.close();
      res.json({ success: false, message: error });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Endpoint taruhan (bot menjalankan bet di Windice)
app.post("/bet", async (req, res) => {
  const { username, base_bet, target_profit, strategy } = req.body;

  try {
    const page = pages[username];
    if (!page) return res.status(401).json({ success: false, message: "User belum login" });

    // Pergi ke halaman dice
    await page.goto('https://windice.io/dice', { waitUntil: 'networkidle2' });

    // Isi base bet
    await page.waitForSelector('input[placeholder*="Bet"]');
    await page.evaluate((bet) => {
      document.querySelector('input[placeholder*="Bet"]').value = '';
      document.querySelector('input[placeholder*="Bet"]').value = bet;
    }, base_bet);

    // Lakukan taruhan sesuai strategi (contoh 5x bet high)
    let resultLog = [];
    for (let i = 0; i < 5; i++) {
      await page.click('button[onclick*="betHigh"]');
      await page.waitForTimeout(3000);

      const balance = await page.$eval('#balance', el => el.textContent.trim());
      resultLog.push(`🎲 Roll ${i + 1}: Saldo = ${balance}`);
    }

    res.json({ success: true, message: "Selesai betting", logs: resultLog });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// TODO: buat endpoint deposit, withdraw, setting, logout dll

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("✅ Server berjalan di port " + PORT));
