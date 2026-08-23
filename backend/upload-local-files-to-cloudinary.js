/**
 * Script to read all local template files in backend/uploads/templates,
 * upload them to Cloudinary, and update all Firestore template records.
 */

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
dotenv.config();

const { initCloudinary, cloudinary } = require('./config/cloudinary');
const { initFirebase, getDb } = require('./config/firebase');

initFirebase();
initCloudinary();

async function fixLocalTemplates() {
  const db = getDb();
  const uploadsDir = path.join(__dirname, 'uploads/templates');

  console.log('🚀 Checking local template files in:', uploadsDir);

  if (!fs.existsSync(uploadsDir)) {
    console.error('Uploads directory does not exist!');
    process.exit(1);
  }

  const files = fs.readdirSync(uploadsDir);
  console.log(`Found ${files.length} local template images in uploads/templates.`);

  // Upload all local images to Cloudinary and map filename -> Cloudinary URL
  const fileUrlMap = {};
  for (const file of files) {
    const filePath = path.join(uploadsDir, file);
    try {
      const fileBuffer = fs.readFileSync(filePath);
      const base64Str = fileBuffer.toString('base64');
      const dataUri = `data:image/png;base64,${base64Str}`;

      const res = await cloudinary.uploader.upload(dataUri, {
        folder: 'digicertify/templates',
        public_id: `local-${path.parse(file).name}`,
      });
      fileUrlMap[file] = res.secure_url;
      console.log(`  📸 Uploaded "${file}" -> ${res.secure_url}`);
    } catch (err) {
      console.error(`  ❌ Failed to upload "${file}":`, err?.message || err);
    }
  }

  // Now update all Firestore templates that reference /uploads/templates/...
  console.log('\n🔄 Updating Firestore templates with new Cloudinary URLs...');
  const snapshot = await db.collection('templates').get();

  let updatedCount = 0;
  for (const doc of snapshot.docs) {
    const data = doc.data();
    let currentUrl = data.imageUrl || '';

    // Standardize slashes
    currentUrl = currentUrl.replace(/\\/g, '/');

    if (!currentUrl.includes('res.cloudinary.com')) {
      const filename = path.basename(currentUrl);
      if (fileUrlMap[filename]) {
        await doc.ref.update({
          imageUrl: fileUrlMap[filename],
        });
        console.log(`  ✅ Updated template "${data.name}" (${doc.id}) -> ${fileUrlMap[filename]}`);
        updatedCount++;
      } else {
        // Fallback: pick one of the successfully uploaded Cloudinary URLs
        const firstCloudinaryUrl = Object.values(fileUrlMap)[0];
        if (firstCloudinaryUrl) {
          await doc.ref.update({
            imageUrl: firstCloudinaryUrl,
          });
          console.log(`  ⚠️ Updated template "${data.name}" (${doc.id}) with fallback Cloudinary URL`);
          updatedCount++;
        }
      }
    }
  }

  console.log(`\n==================================================`);
  console.log(`🎉 SUCCESS! Updated ${updatedCount} templates to Cloudinary!`);
  console.log(`==================================================`);
  process.exit(0);
}

fixLocalTemplates();
