const { initFirebase, getDb } = require('./config/firebase');
const Certificate = require('./models/Certificate');
initFirebase();

async function testRoute() {
  try {
    const certs = await Certificate.find({ isArchived: { $ne: true } });
    console.log(`Found ${certs.length} certificates with isArchived !== true.`);
    
    const populated = await Certificate.populate(certs, 'templateId');
    console.log(`Populated ${populated.length} certificates.`);
    
    // Group into batches
    const grouped = populated.reduce((acc, cert) => {
      let bid = cert.batchId || ((cert.createdAt || cert._creationTime) ? `Generated ${new Date(cert.createdAt || cert._creationTime).toLocaleDateString()}` : 'Individual');
      if (!acc[bid]) acc[bid] = [];
      acc[bid].push(cert);
      return acc;
    }, {});

    console.log(`Total Batches Created: ${Object.keys(grouped).length}`);
    console.log('Batch names:', Object.keys(grouped));
  } catch (err) {
    console.error('Error in route logic:', err);
  }
  process.exit(0);
}

testRoute();
