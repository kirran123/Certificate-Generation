const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const feedbackSchema = new mongoose.Schema({
  name: { type: String, required: true },
  message: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const Feedback = mongoose.models.Feedback || mongoose.model('Feedback', feedbackSchema);

async function checkDB() {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/certificate');
        console.log('Connected to DB');
        const count = await Feedback.countDocuments();
        console.log('Feedback count:', count);
        process.exit(0);
    } catch (err) {
        console.error('DB Error:', err);
        process.exit(1);
    }
}

checkDB();
