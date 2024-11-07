const puppeteer = require("puppeteer");
const jwt = require("jsonwebtoken");

async function authenticate(context, req) {
  const authHeader = req.headers["authorization"];

  if (!authHeader) {
    context.res = {
      status: 401,
      body: { errors: [{ message: "Unauthenticated" }] },
    };
    return false;
  }

  const token = authHeader.split(" ")[1];

  if (!token) {
    context.res = {
      status: 401,
      body: { errors: [{ message: "Unauthenticated" }] },
    };
    return false;
  }

  try {
    const decodedToken = jwt.verify(token, process.env.JWT_KEY);
    if (!decodedToken || !decodedToken.user_id) {
      context.res = {
        status: 401,
        body: { errors: [{ message: "Unauthenticated" }] },
      };
      return false;
    }
    req.user = decodedToken;
    return true;
  } catch (err) {
    context.res = {
      status: 401,
      body: { errors: [{ message: "Unauthenticated" }] },
    };
    return false;
  }
}

module.exports = async function (context, req) {
  const isAuthenticated = await authenticate(context, req);
  if (!isAuthenticated) {
    return;
  }

  try {
    const binaryData = req.body.htmlContent;

    if (!binaryData) {
      context.res = {
        status: 400,
        body: "No HTML content provided",
      };
      return;
    }

    const browser = await puppeteer.launch({
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--window-size=1920,1080",
        "--disable-web-security",
      ],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
    await page.emulateMediaType("print");
    await page.setContent(binaryData.toString());

    const pdf = await page.pdf({
      landscape: true,
      format: "A4",
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      printBackground: true,
      scale: 1,
      displayHeaderFooter: false,
    });

    await page.close();
    await browser.close();

    context.res = {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="report.pdf"',
      },
      body: pdf,
    };
  } catch (error) {
    context.log.error("PDF generation failed:", error);
    context.res = {
      status: 500,
      body: "Failed to generate PDF",
    };
  }
};
