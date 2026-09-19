const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

const sampleData = [
  {
    "Name (Eg: Kirran S T)": "Kirran S T",
    "Email (Eg: kirranvijay@gmail.com)": "kirranvijay@gmail.com",
    "Department (Eg: B.Tech IT)": "B.Tech IT",
    "Year (Eg: IV Year)": "IV Year",
    "College (Eg: Ramco Institute Of Technology)": "Ramco Institute Of Technology",
    "How was the event? (Feedback / Remarks)": "Excellent workshop and very well organized!",
    "Overall Rating (1-5)": "5"
  },
  {
    "Name (Eg: Kirran S T)": "Kirran S T",
    "Email (Eg: kirranvijay@gmail.com)": "kirranvijay@gmail.com",
    "Department (Eg: B.Tech IT)": "Information Technology",
    "Year (Eg: IV Year)": "4th Year",
    "College (Eg: Ramco Institute Of Technology)": "Ramco Institute Of Technology",
    "How was the event? (Feedback / Remarks)": "Great hands-on learning experience.",
    "Overall Rating (1-5)": "5"
  }
];

const worksheet = xlsx.utils.json_to_sheet(sampleData);
const workbook = xlsx.utils.book_new();
xlsx.utils.book_append_sheet(workbook, worksheet, "Recipient Template");

const targetDir = path.join(__dirname, '../frontend/public');
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

const targetPath = path.join(targetDir, 'sample_recipient_template.xlsx');
xlsx.writeFile(workbook, targetPath);
console.log('Sample Excel file regenerated at:', targetPath);
