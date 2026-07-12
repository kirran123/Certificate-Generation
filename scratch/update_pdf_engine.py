import os

file_path = r'c:\Users\kishore ST\Desktop\certificate\backend\routes\certificate.js'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update imports
content = content.replace(
    "const { PDFDocument, rgb } = require('pdf-lib');",
    "const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');"
)

# 2. Refactor createCertificatePDF logic for font drawing
# This part is complex, so we'll target the drawing loop inside the for(const field of fields) loop.
old_drawing_logic = """    page.drawText(String(value), {
      x: Number(field.x),
      y: finalY,
      size: fontSize,
      color: rgb(
        Number(rgbColor.r || 0) / 255, 
        Number(rgbColor.g || 0) / 255, 
        Number(rgbColor.b || 0) / 255
      ),
    });"""

new_drawing_logic = """    // Font and Styling refinements
    let textValue = String(value);
    if (field.textTransform === 'uppercase') textValue = textValue.toUpperCase();

    // Map fonts to pdf-lib StandardFonts
    let fontToUse = await pdfDoc.embedFont(StandardFonts.Helvetica); // Default
    const family = (field.fontFamily || 'sans').toLowerCase();
    const isBold = field.fontWeight === 'bold';

    try {
      if (family === 'serif') {
        fontToUse = await pdfDoc.embedFont(isBold ? StandardFonts.TimesRomanBold : StandardFonts.TimesRoman);
      } else if (family === 'mono') {
        fontToUse = await pdfDoc.embedFont(isBold ? StandardFonts.CourierBold : StandardFonts.Courier);
      } else {
        fontToUse = await pdfDoc.embedFont(isBold ? StandardFonts.HelveticaBold : StandardFonts.Helvetica);
      }
    } catch (fontErr) {
      console.warn('Font loading failed, falling back to Helvetica', fontErr);
    }

    page.drawText(textValue, {
      x: Number(field.x),
      y: finalY,
      size: fontSize,
      font: fontToUse,
      color: rgb(
        Number(rgbColor.r || 0) / 255, 
        Number(rgbColor.g || 0) / 255, 
        Number(rgbColor.b || 0) / 255
      ),
    });"""

content = content.replace(old_drawing_logic, new_drawing_logic)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print("certificate.js updated with advanced typography support.")
