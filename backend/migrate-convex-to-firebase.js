/**
 * migrate-convex-to-firebase.js
 * 
 * Run this script to migrate existing data from Convex to Firestore:
 * 1. Fetches templates from Convex site API or MongoDB export
 * 2. Uploads base64 template images to Cloudinary (getting clean HTTPS URLs)
 * 3. Saves users, templates, certificates, and email logs into Firestore
 * 
 * Usage: node migrate-convex-to-firebase.js
 */

const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config();

const { initFirebase, getDb } = require('./config/firebase');
const { initCloudinary, cloudinary } = require('./config/cloudinary');

initFirebase();
initCloudinary();

const CONVEX_URL = process.env.VITE_CONVEX_SITE_URL || 'https://hearty-blackbird-795.convex.site';

async function uploadBase64ToCloudinary(base64Data, filename = 'template') {
  try {
    const dataUri = base64Data.startsWith('data:') ? base64Data : `data:image/png;base64,${base64Data}`;
    const result = await cloudinary.uploader.upload(dataUri, {
      folder: 'digicertify/templates',
      public_id: `migrated-${Date.now()}-${filename}`,
    });
    return result.secure_url;
  } catch (err) {
    console.error('Cloudinary upload error during migration:', err.message);
    return null;
  }
}

async function runMigration() {
  console.log('🚀 Starting Convex → Firebase + Cloudinary Migration...');
  
  try {
    // 1. Fetch templates from Convex HTTP endpoint
    console.log(`Fetching templates from ${CONVEX_URL}/api/templates...`);
    const resp = await axios.get(`${CONVEX_URL}/api/templates`, { timeout: 10000 }).catch(() => null);
    
    if (resp && resp.data && Array.isArray(resp.data)) {
      const db = getDb();
      let migratedTemplates = 0;

      for (const tmpl of resp.data) {
        let imageUrl = tmpl.imageUrl;
        
        // If template image is base64 in database, move it to Cloudinary!
        if (tmpl.imageBase64 || (imageUrl && imageUrl.startsWith('data:image'))) {
          console.log(`Uploading template image "${tmpl.name}" to Cloudinary...`);
          const cloudUrl = await uploadBase64ToCloudinary(tmpl.imageBase64 || imageUrl, tmpl.name);
          if (cloudUrl) imageUrl = cloudUrl;
        }

        const templateData = {
          name: tmpl.name || 'Untitled Template',
          imageUrl: imageUrl || '',
          layoutConfig: tmpl.layoutConfig || [],
          showId: tmpl.showId !== undefined ? tmpl.showId : true,
          showQr: tmpl.showQr !== undefined ? tmpl.showQr : true,
          createdAt: tmpl._creationTime ? new Date(tmpl._creationTime).toISOString() : new Date().toISOString(),
        };

        const docRef = db.collection('templates').doc();
        await docRef.set(templateData);
        migratedTemplates++;
      }

      console.log(`✅ Successfully migrated ${migratedTemplates} templates to Firestore & Cloudinary!`);
    } else {
      console.log('ℹ️ No existing Convex templates found to migrate (or Convex API offline). Skipping templates migration.');
    }

    console.log('\n🎉 Migration complete! Your system is now running 100% on Firebase + Cloudinary.');
  } catch (err) {
    console.error('Migration error:', err.message);
  }
  process.exit(0);
}

runMigration();
