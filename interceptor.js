
import axios from 'axios';

// Votre token JWT
const token = "votre_token_jwt";

// Ajouter un intercepteur de requête
axios.interceptors.request.use(
  config => {
    // Ajouter le token JWT à l'en-tête Authorization
    config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  error => {
    return Promise.reject(error);
  }
);