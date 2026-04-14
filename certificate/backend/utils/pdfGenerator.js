const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const axios = require('axios');

/**
 * Helper: Extract relative path from a full URL
 */
const getRelativePath = (url) => {
  if (!url) return '';
  let clean = url.replace(/https?:\/\/[^/]+/, '');
  if (clean.startsWith('/')) clean = clean.substring(1);
  return clean;
};

/**
 * Generates a unique Hash for deduping certificates
 */
const calculateUniqueHash = (templateId, name, email, batchId) => {
  const hashStr = `${templateId}_${name}_${email}_${batchId}`;
  return crypto.createHash('md5').update(hashStr).digest('hex');
};

/**
 * Robust PDF Generation with full support for:
 * - PDF/PNG/JPG templates
 * - Italics, Bold, Underline
 * - Text Alignment (Left, Center, Right)
 * - QR Codes
 * - Static Value fallback
 */
async function createCertificatePDF(template, data, certId) {
  let templateBytes;
  
  try {
    if (template.imageUrl && template.imageUrl.startsWith('http')) {
      // Fetch from Cloudinary or other remote URL
      const response = await axios.get(template.imageUrl, { responseType: 'arraybuffer' });
      templateBytes = Buffer.from(response.data);
    } else {
      // Load from local filesystem
      const cleanUrl = getRelativePath(template.imageUrl);
      const templatePath = path.join(__dirname, '..', cleanUrl);
      
      if (fs.existsSync(templatePath)) {
        templateBytes = fs.readFileSync(templatePath);
      } else if (template.imageBase64) {
        console.log(`[PDF Generator] Local file missing. Using Base64 backup for ${certId}.`);
        templateBytes = Buffer.from(template.imageBase64, 'base64');
      } else {
        throw new Error(`Template file not found locally and no Base64 backup exists.`);
      }
    }
  } catch (err) {
    // If remote fetch fails, try Base64 fallback
    if (template.imageBase64) {
      console.warn(`[PDF Generator] Remote fetch failed for ${certId}. Using Base64 fallback.`, err.message);
      templateBytes = Buffer.from(template.imageBase64, 'base64');
    } else {
      throw new Error(`Failed to load template image: ${err.message}`);
    }
  }
  
  let pdfDoc;
  let page;
  let width, height;
  let errorLogs = [];

  // Attempt 1: Try loading as a PDF
  try {
    pdfDoc = await PDFDocument.load(templateBytes);
    page = pdfDoc.getPages()[0];
    const size = page.getSize();
    width = size.width;
    height = size.height;
  } catch (pdfErr) {
    errorLogs.push('PDF Load Failed: ' + pdfErr.message);
    
    // Attempt 2: Fallback to PNG
    try {
      pdfDoc = await PDFDocument.create();
      const embeddedImage = await pdfDoc.embedPng(templateBytes);
      const imgDims = embeddedImage.scale(1);
      page = pdfDoc.addPage([imgDims.width, imgDims.height]);
      page.drawImage(embeddedImage, { x: 0, y: 0, width: imgDims.width, height: imgDims.height });
      width = imgDims.width;
      height = imgDims.height;
    } catch (pngErr) {
      errorLogs.push('PNG Embed Failed: ' + pngErr.message);
      
      // Attempt 3: Fallback to JPG
      try {
        pdfDoc = await PDFDocument.create();
        const embeddedImage = await pdfDoc.embedJpg(templateBytes);
        const imgDims = embeddedImage.scale(1);
        page = pdfDoc.addPage([imgDims.width, imgDims.height]);
        page.drawImage(embeddedImage, { x: 0, y: 0, width: imgDims.width, height: imgDims.height });
        width = imgDims.width;
        height = imgDims.height;
      } catch (jpgErr) {
        errorLogs.push('JPG Embed Failed: ' + jpgErr.message);
        throw new Error('Unsupported template format. Errors: ' + errorLogs.join(' | '));
      }
    }
  }

  const layout = template.layoutConfig || {};
  const fields = Array.isArray(layout) ? layout : (layout.fields || []);
  const qrSettings = template.qrCode || layout.qrCode;

  // Draw Fields
  for (const field of fields) {
    if (field.key === 'certificateId' && template.showId === false) continue;

    // Case-insensitive lookup (e.g., 'Name' and 'name' both work)
    const dataKeys = Object.keys(data);
    const actualKey = dataKeys.find(k => k.toLowerCase() === field.key.toLowerCase());
    
    // Priority: Spreadsheet Data > Static Value > Fallbacks
    let textValue = '';
    if (actualKey && data[actualKey]) {
      textValue = String(data[actualKey]);
    } else if (field.staticValue) {
      textValue = String(field.staticValue);
    } else if (field.key.toLowerCase() === 'certificateid') {
      textValue = certId;
    }

    // Apply prefix to Certificate ID field
    if (field.key.toLowerCase() === 'certificateid' && !textValue.startsWith('Certificate id : ')) {
      textValue = `Certificate id : ${textValue}`;
    }
    
    if (field.textTransform === 'uppercase') textValue = textValue.toUpperCase();

    const rgbColor = field.color || { r: 0, g: 0, b: 0 };
    const fontSize = Number(field.fontSize) || 24;
    const boxHeight = Number(field.height) || 40;
    const textHeight = fontSize * 0.8;
    const yOffset = (boxHeight - textHeight) / 2;
    const finalY = height - Number(field.y) - boxHeight + yOffset;

    // Map fonts
    let fontToUse;
    const family = (field.fontFamily || 'sans').toLowerCase();
    const isBold = field.fontWeight === 'bold';
    const isItalic = field.fontStyle === 'italic';

    try {
      if (family === 'serif') {
        if (isBold && isItalic) fontToUse = await pdfDoc.embedFont(StandardFonts.TimesRomanBoldItalic);
        else if (isBold) fontToUse = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
        else if (isItalic) fontToUse = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);
        else fontToUse = await pdfDoc.embedFont(StandardFonts.TimesRoman);
      } else if (family === 'mono') {
        if (isBold && isItalic) fontToUse = await pdfDoc.embedFont(StandardFonts.CourierBoldOblique);
        else if (isBold) fontToUse = await pdfDoc.embedFont(StandardFonts.CourierBold);
        else if (isItalic) fontToUse = await pdfDoc.embedFont(StandardFonts.CourierOblique);
        else fontToUse = await pdfDoc.embedFont(StandardFonts.Courier);
      } else {
        if (isBold && isItalic) fontToUse = await pdfDoc.embedFont(StandardFonts.HelveticaBoldOblique);
        else if (isBold) fontToUse = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        else if (isItalic) fontToUse = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
        else fontToUse = await pdfDoc.embedFont(StandardFonts.Helvetica);
      }
    } catch (fontErr) {
      fontToUse = await pdfDoc.embedFont(StandardFonts.Helvetica);
    }

    // Alignment
    const textWidth = fontToUse.widthOfTextAtSize(textValue, fontSize);
    const boxWidth = Number(field.width) || 200;
    let finalX = Number(field.x);

    if (field.textAlign === 'center') {
      finalX = Number(field.x) + (boxWidth - textWidth) / 2;
    } else if (field.textAlign === 'right') {
      finalX = Number(field.x) + (boxWidth - textWidth);
    }

    // Draw Text
    page.drawText(textValue, {
      x: finalX,
      y: finalY,
      size: fontSize,
      font: fontToUse,
      color: rgb(Number(rgbColor.r || 0) / 255, Number(rgbColor.g || 0) / 255, Number(rgbColor.b || 0) / 255),
    });

    // Underline
    if (field.textDecoration === 'underline') {
      page.drawLine({
        start: { x: finalX, y: finalY - 2 },
        end: { x: finalX + textWidth, y: finalY - 2 },
        thickness: 1,
        color: rgb(Number(rgbColor.r || 0) / 255, Number(rgbColor.g || 0) / 255, Number(rgbColor.b || 0) / 255),
      });
    }
  }

  // QR Code
  if (qrSettings && template.showQr !== false) {
    const qrData = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify/${certId}`;
    const qrBuf = await QRCode.toBuffer(qrData);
    const qrImg = await pdfDoc.embedPng(qrBuf);
    page.drawImage(qrImg, {
      x: Number(qrSettings.x),
      y: height - Number(qrSettings.y) - Number(qrSettings.height),
      width: Number(qrSettings.width),
      height: Number(qrSettings.height)
    });
  }

  return pdfDoc.save();
}

module.exports = {
  createCertificatePDF,
  calculateUniqueHash,
  getRelativePath
};
