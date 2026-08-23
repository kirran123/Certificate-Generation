const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

const initCloudinary = () => {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  console.log('✅ Cloudinary initialized.');
};

// Multer storage that uploads directly to Cloudinary
const createCloudinaryUpload = () => {
  const storage = new CloudinaryStorage({
    cloudinary,
    params: {
      folder: 'digicertify/templates',
      allowed_formats: ['jpg', 'jpeg', 'png'],
      transformation: [{ quality: 'auto', fetch_format: 'auto' }],
    },
  });
  return multer({ storage });
};

module.exports = { initCloudinary, createCloudinaryUpload, cloudinary };
