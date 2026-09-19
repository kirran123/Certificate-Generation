const fs = require('fs');
const path = require('path');
const { getRowColumnValue, cleanHeaderName, findBestNameColumn, findBestEmailColumn } = require('../backend/utils/columnHelper');
const { createCertificatePDF, calculateUniqueHash } = require('../backend/utils/pdfGenerator');

async function testAllFlows() {
  console.log('=== STARTING ALL-FLOW CERTIFICATE MATCHING AUDIT ===\n');

  // Test Case Dataset from Sample Form
  const headers = [
    "Name (Eg: Kirran S T)",
    "Email (Eg: kirranvijay@gmail.com)",
    "Department (Eg: B.Tech IT)",
    "Year (Eg: IV Year)",
    "College (Eg: Ramco Institute Of Technology)",
    "How was the event? (Feedback / Remarks)",
    "Overall Rating (1-5)"
  ];

  const row = {
    "Name (Eg: Kirran S T)": "Kirran S T",
    "Email (Eg: kirranvijay@gmail.com)": "kirranvijay@gmail.com",
    "Department (Eg: B.Tech IT)": "B.Tech IT",
    "Year (Eg: IV Year)": "IV Year",
    "College (Eg: Ramco Institute Of Technology)": "Ramco Institute Of Technology",
    "How was the event? (Feedback / Remarks)": "Excellent session!",
    "Overall Rating (1-5)": "5"
  };

  // 1. Auto-Detection Check
  const bestName = findBestNameColumn(headers);
  const bestEmail = findBestEmailColumn(headers);
  console.log('1. Auto-Detected Name Header:', bestName);
  console.log('   Auto-Detected Email Header:', bestEmail);

  if (bestName !== "Name (Eg: Kirran S T)") throw new Error('Failed to auto-detect Name header');
  if (bestEmail !== "Email (Eg: kirranvijay@gmail.com)") throw new Error('Failed to auto-detect Email header');

  // 2. 5-Step Value Extraction Check
  const nameVal = getRowColumnValue(row, "Name (Eg: Kirran S T)", "name");
  const emailVal = getRowColumnValue(row, "Email (Eg: kirranvijay@gmail.com)", "email");
  const deptVal = getRowColumnValue(row, "Department (Eg: B.Tech IT)", "department");
  const yearVal = getRowColumnValue(row, "Year (Eg: IV Year)", "year");
  const collegeVal = getRowColumnValue(row, "College (Eg: Ramco Institute Of Technology)", "college");

  console.log('\n2. Value Extractions:');
  console.log('   Name:', nameVal);
  console.log('   Email:', emailVal);
  console.log('   Dept:', deptVal);
  console.log('   Year:', yearVal);
  console.log('   College:', collegeVal);

  if (nameVal !== 'Kirran S T') throw new Error('Extracted Name does not match');
  if (emailVal !== 'kirranvijay@gmail.com') throw new Error('Extracted Email does not match');
  if (deptVal !== 'B.Tech IT') throw new Error('Extracted Dept does not match');
  if (yearVal !== 'IV Year') throw new Error('Extracted Year does not match');
  if (collegeVal !== 'Ramco Institute Of Technology') throw new Error('Extracted College does not match');

  // 3. Canvas Key Cross-Matching Check (e.g. canvas field is 'Name' or 'Department')
  console.log('\n3. Canvas Key Resolution Check:');
  const canvasName = getRowColumnValue(row, "Name", "name");
  const canvasDept = getRowColumnValue(row, "Department", "department");
  console.log('   Canvas Field [Name] -> Value:', canvasName);
  console.log('   Canvas Field [Department] -> Value:', canvasDept);

  if (canvasName !== 'Kirran S T') throw new Error('Canvas Name resolution failed');
  if (canvasDept !== 'B.Tech IT') throw new Error('Canvas Department resolution failed');

  // 4. PDF Generation Check
  console.log('\n4. Testing PDF Generator Rendering...');
  const localTemplatePath = path.join(__dirname, '../backend/uploads/templates/template-1775758587158.png');
  const base64Data = fs.existsSync(localTemplatePath) ? fs.readFileSync(localTemplatePath).toString('base64') : '';

  const mockTemplate = {
    imageUrl: '/uploads/templates/template-1775758587158.png',
    imageBase64: base64Data ? `data:image/png;base64,${base64Data}` : undefined,
    layoutConfig: {
      fields: [
        { key: 'Name (Eg: Kirran S T)', x: 100, y: 100, fontSize: 24, color: { r: 0, g: 0, b: 0 } },
        { key: 'Department', x: 100, y: 150, fontSize: 18, color: { r: 0, g: 0, b: 0 } },
        { key: 'College', x: 100, y: 200, fontSize: 18, color: { r: 0, g: 0, b: 0 } }
      ]
    },
    showId: true
  };

  const itemData = {
    ...row,
    name: nameVal,
    email: emailVal
  };

  const pdfBytes = await createCertificatePDF(mockTemplate, itemData, 'CERT123456');
  console.log('   PDF Generation Succeeded! Generated PDF Size:', pdfBytes.length, 'bytes');

  console.log('\n=== AUDIT COMPLETE: ALL 3 GENERATION FLOWS PASSED 100% PERFECTLY ===');
}

testAllFlows().catch(err => {
  console.error('\nAUDIT FAILED:', err.message);
  process.exit(1);
});
