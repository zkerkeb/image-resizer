import Redis from 'ioredis';
import sharp from "sharp";
import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import axios from 'axios';

import './interceptor.js'


const app = express();
const port = 3000;
const redis = new Redis(); // Connexion par défaut à Redis

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


app.get("/", (req, res) => {
    console.log("req.headers", req.headers);

    res.send("Serveur de redimensionnement d'images avec cache Redis");
}
);


app.post("/resize", async (req, res) => {
    axios.get('http://localhost:3000')

    let { width, height, url, quality = 80 } = req.body;
    const qualityNum = parseInt(quality);
    // Convertir en nombre ou en null si non fourni
    const widthNum = width ? parseInt(width) : null;
    const heightNum = height ? parseInt(height) : null;

    // Modifier la clé de cache pour inclure la qualité dynamique et la possibilité d'une seule dimension
    const cacheKey = `image:${url}-${widthNum || 'auto'}x${heightNum || 'auto'}-webp-quality-${qualityNum}`;

    try {
        const cachedImage = await redis.getBuffer(cacheKey);
        if (cachedImage) {
            console.log("Image servie depuis le cache Redis");
            return res.type('image/webp').send(cachedImage);
        }

        const response = await fetch(url);
        if (!response.ok) throw new Error('Réponse réseau non ok.');

        const originalBuffer = await response.buffer();
        const originalSizeMB = originalBuffer.length / 1048576; // Taille originale en MB

        const resizedBuffer = await sharp(originalBuffer)
            .resize(widthNum, heightNum, {
                // Garder le rapport d'aspect si une seule dimension est fournie
                fit: sharp.fit.inside,
                withoutEnlargement: true // Empêcher l'agrandissement
            })
            .webp({ quality: qualityNum }) // Réglage de la qualité
            .toBuffer();

        const finalSizeMB = resizedBuffer.length / 1048576; // Taille finale en MB
        const sizeReductionMB = originalSizeMB - finalSizeMB; // Réduction de la taille en MB
        const reductionPercentage = (sizeReductionMB / originalSizeMB * 100).toFixed(2); // Pourcentage de réduction

        await redis.set(cacheKey, resizedBuffer, 'EX', 60 * 60 * 24); // Expiration après 24 heures

        console.log(`Image redimensionnée et convertie en WebP avec qualité de ${qualityNum}% ajoutée au cache Redis. Taille originale: ${originalSizeMB.toFixed(2)} MB, Taille finale: ${finalSizeMB.toFixed(2)} MB, Réduction: ${sizeReductionMB.toFixed(2)} MB (${reductionPercentage}%)`);

        res.type('image/webp').send(resizedBuffer);
    } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Erreur lors du redimensionnement et de la conversion de l'image", error });
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
