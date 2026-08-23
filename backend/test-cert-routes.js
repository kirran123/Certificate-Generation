const FormAutomation = require('./models/FormAutomation');
const Certificate = require('./models/Certificate');
const { initFirebase } = require('./config/firebase');

initFirebase();

async function testCertRoutes() {
  console.log('Testing Certificate.find and FormAutomation.findAndPopulate...');
  try {
    const certs = await Certificate.find({ isArchived: { $ne: true } });
    console.log(`Certs count: ${certs.length}`);
    const populated = await Certificate.populate(certs, 'templateId');
    console.log(`Populated certs count: ${populated.length}`);

    const autos = await FormAutomation.findAndPopulate({});
    console.log(`Automations count: ${autos.length}`);
  } catch (err) {
    console.error('Error in cert routes test:', err);
  }
  process.exit(0);
}

testCertRoutes();
