/**
 * sampleExcelGenerator.js - Sample Excel Template & Google Form Links
 */

export const SAMPLE_FORM_URL = "https://docs.google.com/forms/d/e/1FAIpQLSdcwJ2up2IF4-fiMqK4SE-Av3prcrEVU2X7uosPp8dgXBGRNA/viewform?usp=publish-editor";

export const downloadSampleExcel = () => {
  const link = document.createElement('a');
  link.href = '/sample_recipient_template.xlsx';
  link.download = 'Sample_Certificate_Recipient_List.xlsx';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
