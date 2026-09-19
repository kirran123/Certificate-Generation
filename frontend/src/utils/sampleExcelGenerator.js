/**
 * sampleExcelGenerator.js - Triggers download of sample Excel template for users
 */

export const downloadSampleExcel = () => {
  const link = document.createElement('a');
  link.href = '/sample_recipient_template.xlsx';
  link.download = 'Sample_Certificate_Recipient_List.xlsx';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
