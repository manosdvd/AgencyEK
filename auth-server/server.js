
const express = require('express');
const ImageKit = require('imagekit');
const cors = require('cors');

const app = express();
const port = 3001; // Choose a port for your backend server

// IMPORTANT: Use environment variables in a real application
// For this example, we are putting them here for simplicity.
const imagekit = new ImageKit({
    publicKey: "public_rJ83Er/Hs9uSD4BdDxH+wZ9n9m8=",
    privateKey: "private_QV2psQHw1UAwzR3kTqZml8mkstg=",
    urlEndpoint: "https://ik.imagekit.io/5r07rjszs"
});

// Allow requests from your frontend's origin
app.use(cors({
    origin: 'http://127.0.0.1:5500' // Updated to match frontend origin
}));

// The authentication endpoint
app.get('/auth', (req, res) => {
    const authenticationParameters = imagekit.getAuthenticationParameters();
    res.json(authenticationParameters);
});

app.listen(port, () => {
    console.log(`Authentication server listening at http://localhost:${port}`);
});
