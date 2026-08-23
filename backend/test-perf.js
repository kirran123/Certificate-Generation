const Certificate = require('./models/Certificate');
const { initFirebase } = require('./config/firebase');

initFirebase();

async function testPerf() {
  console.time('fetchAndPopulate');
  const certs = await Certificate.find({ isArchived: { $ne: true } });
  const populated = await Certificate.populate(certs, 'templateId');
  console.timeEnd('fetchAndPopulate');
  console.log(`Successfully populated ${populated.length} certificates!`);
  process.exit(0);
}

testPerf();
