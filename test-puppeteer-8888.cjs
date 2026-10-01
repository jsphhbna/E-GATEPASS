const puppeteer = require('puppeteer-core');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    headless: true,
  });
  
  const page = await browser.newPage();
  
  page.on('console', msg => {
    console.log(`BROWSER CONSOLE ${msg.type().toUpperCase()}: ${msg.text()}`);
  });
  
  page.on('pageerror', error => {
    console.error(`BROWSER UNCAUGHT ERROR:`, error.message);
  });

  page.on('requestfailed', request => {
    console.log(`REQUEST FAILED: ${request.url()} - ${request.failure().errorText}`);
  });

  try {
    await page.goto('http://localhost:8888/', { waitUntil: 'networkidle2' });
    console.log('Page loaded successfully from 8888.');
    
    // Check if the root element is empty
    const rootHTML = await page.evaluate(() => document.getElementById('root').innerHTML);
    console.log('Root HTML length:', rootHTML.length);
    if (rootHTML.length === 0) {
      console.log('PAGE IS BLANK WHITE!');
    } else {
      console.log('PAGE HAS CONTENT!');
    }
  } catch (err) {
    console.error('PUPPETEER ERROR:', err);
  } finally {
    await browser.close();
  }
})();
