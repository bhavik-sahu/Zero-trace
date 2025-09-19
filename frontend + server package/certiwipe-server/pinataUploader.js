// pinataUploader.js

const axios = require('axios');
const FormData = require('form-data');

const PINATA_API_KEY = process.env.PINATA_API_KEY;
const PINATA_SECRET_API_KEY = process.env.PINATA_SECRET_API_KEY;

// --- THIS FUNCTION IS UPDATED ---
async function uploadJsonToIpfs(jsonData, fileName) {
  if (!PINATA_API_KEY || !PINATA_SECRET_API_KEY) {
    throw new Error('Pinata API Key or Secret is missing from the .env file.');
  }
  const url = `https://api.pinata.cloud/pinning/pinJSONToIPFS`;

  // Create the request body with the required metadata wrapper
  const body = {
    pinataMetadata: {
      name: fileName, // Use the provided filename
    },
    pinataContent: jsonData,
  };

  try {
    const response = await axios.post(url, body, {
      headers: {
        'pinata_api_key': PINATA_API_KEY,
        'pinata_secret_api_key': PINATA_SECRET_API_KEY,
      },
    });
    return response.data.IpfsHash;
  } catch (error) {
    console.error('Error uploading JSON to Pinata:', error.response?.data || error.message);
    throw new Error('Failed to pin JSON to IPFS.');
  }
}

// This function for files is already correct
async function uploadFileToIpfs(fileBuffer, fileName) {
  if (!PINATA_API_KEY || !PINATA_SECRET_API_KEY) {
    throw new Error('Pinata API Key or Secret is missing from the .env file.');
  }
  const url = `https://api.pinata.cloud/pinning/pinFileToIPFS`;
  const formData = new FormData();
  formData.append('file', fileBuffer, fileName);

  try {
    const response = await axios.post(url, formData, {
      maxBodyLength: 'Infinity',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${formData.getBoundary()}`,
        'pinata_api_key': PINATA_API_KEY,
        'pinata_secret_api_key': PINATA_SECRET_API_KEY,
      },
    });
    return response.data.IpfsHash;
  } catch (error) {
    console.error('Error uploading file to Pinata:', error.response?.data || error.message);
    throw new Error('Failed to pin file to IPFS.');
  }
}

module.exports = { uploadJsonToIpfs, uploadFileToIpfs };