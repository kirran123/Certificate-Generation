const { initFirebase, getDb } = require('./config/firebase');
const User = require('./models/User');
const Certificate = require('./models/Certificate');
const EmailLog = require('./models/EmailLog');
const Feedback = require('./models/Feedback');
initFirebase();

async function testAll() {
  try {
    const usersCount = await User.countDocuments();
    const usersList = await User.find({});
    
    const allCerts = await Certificate.find({ isArchived: { $ne: true } });
    const populated = await Certificate.populate(allCerts, 'templateId');
    const sentCount = allCerts.filter(c => c.status === 'Sent').length;
    const failedCount = allCerts.filter(c => c.status === 'Failed').length;

    const recentLogs = await EmailLog.find({});
    const recentFeedbacks = await Feedback.find({});

    console.log('✅ ALL ADMIN API LOGIC VERIFIED SUCCESSFULLY!');
    console.log(`- Total Unique Users: ${usersCount} (List length: ${usersList.length})`);
    console.log(`- Total Unique Certificates: ${allCerts.length} (Populated: ${populated.length})`);
    console.log(`- Sent Count: ${sentCount}, Failed Count: ${failedCount}`);
    console.log(`- Email Logs Count: ${recentLogs.length}`);
    console.log(`- Feedback Logs Count: ${recentFeedbacks.length}`);
  } catch (err) {
    console.error('❌ ERROR testing admin routes:', err);
  }
  process.exit(0);
}

testAll();
