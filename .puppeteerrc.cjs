/**
 * Skip puppeteer's bundled Chrome download entirely.
 * The generate-user-guide --screenshots script uses REPLIT_PLAYWRIGHT_CHROMIUM_EXECUTABLE
 * (pre-installed in the Replit environment) as its executablePath at runtime.
 */
const config = {
  skipDownload: true,
};

module.exports = config;
