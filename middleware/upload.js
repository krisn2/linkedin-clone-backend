const multer = require('multer');
const path = require('path');
const fs = require('fs');


const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);


const storage = multer.diskStorage({
destination: (req, file, cb) => cb(null, uploadsDir),
filename: (req, file, cb) => {
const ext = path.extname(file.originalname);
const name = `${Date.now()}-${Math.round(Math.random()*1E9)}${ext}`;
cb(null, name);
}
});


const fileFilter = (req, file, cb) => {
    
const allowed = /jpeg|jpg|png|gif|mp4|mov|avi|mkv/;
const ext = path.extname(file.originalname).toLowerCase();
if (allowed.test(ext)) cb(null, true);
else cb(new Error('Unsupported file type'), false);
};


const limits = { fileSize: 50 * 1024 * 1024 }; // 50MB limit


const upload = multer({ storage, fileFilter, limits });


module.exports = upload;