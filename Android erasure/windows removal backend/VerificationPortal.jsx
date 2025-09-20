// VerificationPortal.jsx (v2)
//
// A React component to fetch a certificate from IPFS and cryptographically verify its signature.
//
// Prerequisites:
// - A React project setup.
// - npm install elliptic js-sha256

import React, { useState, useEffect } from 'react';
import { ec as EC } from 'elliptic';
import { sha256 } from 'js-sha256';

const IPFS_GATEWAY = 'https://ipfs.io/ipfs/';

// Initialize the Elliptic Curve context for P-256
const ec = new EC('p256');

const VerificationPortal = ({ ipfsCid, publicKeyPem }) => {
    const [certificate, setCertificate] = useState(null);
    const [status, setStatus] = useState({ message: 'Enter an IPFS CID to begin.', color: 'grey' });

    useEffect(() => {
        if (!ipfsCid) {
            setStatus({ message: 'Waiting for IPFS CID...', color: 'grey' });
            return;
        }

        const verifyCertificate = async () => {
            setStatus({ message: `Fetching from ${IPFS_GATEWAY}${ipfsCid}...`, color: 'orange' });

            try {
                // 1. Fetch the certificate from IPFS
                const response = await fetch(`${IPFS_GATEWAY}${ipfsCid}`);
                if (!response.ok) {
                    throw new Error(`Failed to fetch from IPFS: ${response.statusText}`);
                }
                const certData = await response.json();
                setCertificate(certData);

                // 2. Check for a public key
                if (!publicKeyPem) {
                    throw new Error("Public key is missing. Cannot verify signature.");
                }

                // 3. Separate signature from payload
                const signatureHex = certData.signature;
                if (!signatureHex) {
                    throw new Error("Certificate does not contain a signature.");
                }
                delete certData.signature;

                // 4. Canonicalize and hash the payload
                // IMPORTANT: Must match the signing format in the Rust application
                const payload = JSON.stringify(certData, Object.keys(certData).sort(), ',', ':');
                const payloadHash = sha256(payload);

                // 5. Verify the signature
                const key = ec.keyFromPublic(publicKeyPem, 'pem');
                const isVerified = key.verify(payloadHash, signatureHex);

                if (isVerified) {
                    setStatus({ message: '✅ Signature is VERIFIED and Authentic', color: 'green' });
                } else {
                    setStatus({ message: '❌ Signature is INVALID', color: 'red' });
                }

            } catch (e) {
                setStatus({ message: `Error: ${e.message}`, color: 'red' });
                setCertificate(null);
            }
        };

        verifyCertificate();
    }, [ipfsCid, publicKeyPem]);

    const StatusBadge = () => (
        <div style={{ 
            padding: '1em', 
            margin: '1em 0', 
            backgroundColor: status.color, 
            color: 'white', 
            borderRadius: '5px', 
            fontWeight: 'bold' 
        }}>
            {status.message}
        </div>
    );

    return (
        <div style={{ fontFamily: 'sans-serif', maxWidth: '800px', margin: '2em auto' }}>
            <h2>Certificate Verification</h2>
            <p>This portal fetches a JSON certificate from IPFS and cryptographically verifies its digital signature on the client-side.</p>
            <StatusBadge />
            {certificate && (
                <pre style={{ 
                    backgroundColor: '#f4f4f4', 
                    padding: '1em', 
                    border: '1px solid #ddd', 
                    borderRadius: '5px', 
                    whiteSpace: 'pre-wrap', 
                    wordWrap: 'break-word' 
                }}>
                    {JSON.stringify(certificate, null, 2)}
                </pre>
            )}
        </div>
    );
};

export default VerificationPortal;

// Example Usage in an App component:
//
// const App = () => {
//   const [cid, setCid] = useState('');
//   const publicKey = `-----BEGIN PUBLIC KEY-----
// MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE...your key...
// -----END PUBLIC KEY-----
// `;
//
//   return (
//     <div>
//       <input type="text" value={cid} onChange={(e) => setCid(e.target.value)} placeholder="Enter IPFS CID" />
//       <VerificationPortal ipfsCid={cid} publicKeyPem={publicKey} />
//     </div>
//   );
// };