import mongoose from 'mongoose';
import dotenv from 'dotenv';
import crypto from 'crypto';

if (!globalThis.crypto) {
    globalThis.crypto = crypto;
}

// ENV configuration
dotenv.config();

let connectionPromise = null;

export async function dbConnection() {
    const mongo_URL = process.env.MONGO_URL || process.env.MONGO_URI;

    if (!mongo_URL) {
        console.error("❌ MONGO_URL environment variable is missing!");
        return;
    }

    // 1️⃣ If already connected
    if (mongoose.connection.readyState === 1) {
        return mongoose.connection;
    }

    // 2️⃣ If connection is in progress, await existing promise
    if (connectionPromise) {
        return connectionPromise;
    }

    // 3️⃣ Establish new connection
    connectionPromise = mongoose.connect(mongo_URL, {
        serverSelectionTimeoutMS: 15000,
        maxPoolSize: 10,
    }).then((m) => {
        console.log("✅ Database Connected Successfully");
        connectionPromise = null;
        return m.connection;
    }).catch((error) => {
        console.error("❌ Error Connecting in DB", error);
        connectionPromise = null;
        throw error;
    });

    return connectionPromise;
}