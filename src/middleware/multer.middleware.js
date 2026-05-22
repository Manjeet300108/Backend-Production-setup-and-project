import multer from "multer";
import crypto from "crypto";
import path from "path";

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, './public/temp')
    },

    filename: function (req, file, cb) {
        crypto.randomBytes(12, function (err, bytes) {
            const fileName = bytes.toString('hex') + path.extname(file.filename)
            cb(null, fileName)
        })
    }
})

const upload = multer({ storage: storage })