/**
 * Script to sync any remaining base64/local templates in Firestore directly to Cloudinary
 */
const { initFirebase, getDb } = require('./config/firebase');
const { initCloudinary, cloudinary } = require('./config/cloudinary');

initFirebase();
initCloudinary();

async function syncTemplates() {
  const db = getDb();
  console.log('🔍 Checking Firestore templates for any non-Cloudinary images...');

  const snapshot = await db.collection('templates').get();
  console.log(`Found ${snapshot.size} templates in Firestore.`);

  let updatedCount = 0;
  for (const doc of snapshot.docs) {
    const data = doc.data();
    const imageUrl = data.imageUrl || '';
    const imageBase64 = data.imageBase64 || '';

    if ((!imageUrl || !imageUrl.includes('res.cloudinary.com')) || imageBase64) {
      const source = imageBase64 || imageUrl;
      if (source && source.length > 20) {
        try {
          const dataUri = source.startsWith('data:') ? source : `data:image/png;base64,${source}`;
          const res = await cloudinary.uploader.upload(dataUri, {
            folder: 'digicertify/templates',
            public_id: `sync-${Date.now()}-${(data.name || 'template').replace(/[^a-zA-Z0-9]/g, '_')}`,
          });
          console.log(`  📸 Uploaded "${data.name}" (${doc.id}) -> ${res.secure_url}`);
          await doc.ref.update({
            imageUrl: res.secure_url,
            imageBase64: null, // Clear out base64!
          });
          updatedCount++;
        } catch (err) {
          console.error(`  ❌ Failed for "${data.name}":`, err.message);
        }
      }
    }
  }

  console.log(`\n🎉 Synced ${updatedCount} additional templates to Cloudinary!`);
  process.exit(0);
}

syncTemplates();
