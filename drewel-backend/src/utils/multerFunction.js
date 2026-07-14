import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
    deleteS3Object,
    isS3StorageEnabled,
    makeSafeFileName,
    uploadStreamToS3,
} from './s3Storage.js';

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const resolveLocalDestination = (destination) =>
    path.isAbsolute(destination) ? destination : path.join(backendRoot, destination);

export const generateStorage = (destination) => {
    const localDestination = resolveLocalDestination(destination);
    if (!fs.existsSync(localDestination)) {
        fs.mkdirSync(localDestination, { recursive: true });
    }

    return {
        _handleFile: function (req, file, cb) {
            const fileName = makeSafeFileName(file.originalname || "upload", file.mimetype);

            if (isS3StorageEnabled()) {
                uploadStreamToS3({
                    destination,
                    fileName,
                    stream: file.stream,
                    contentType: file.mimetype,
                })
                    .then(({ bucket, key }) => {
                        cb(null, {
                            filename: fileName,
                            bucket,
                            key,
                            path: key,
                            storage: "s3",
                        });
                    })
                    .catch(cb);
                return;
            }

            if (!fs.existsSync(localDestination)) {
                fs.mkdirSync(localDestination, { recursive: true });
            }

            const finalPath = path.join(localDestination, fileName);
            const outStream = fs.createWriteStream(finalPath);

            file.stream.pipe(outStream);
            outStream.on("error", cb);
            outStream.on("finish", () => {
                cb(null, {
                    destination: localDestination,
                    filename: fileName,
                    path: finalPath,
                    size: outStream.bytesWritten,
                    storage: "local",
                });
            });
        },

        _removeFile: function (req, file, cb) {
            if (file.storage === "s3") {
                deleteS3Object(file.key).then(() => cb(null)).catch(cb);
                return;
            }

            fs.unlink(file.path, cb);
        },
    };
};
