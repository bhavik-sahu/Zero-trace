'''
# Secure Data Wiping and Certification Platform

This project provides a full ecosystem for the secure sanitization of storage media and the generation of tamper-proof, verifiable certificates of data destruction.

## Project Architecture

The system is composed of several key components:

1.  **Rust Wiping Engine (`secure-wiper`):** A powerful, cross-platform command-line tool that performs the core data sanitization. It supports multiple wipe methods aligned with NIST SP 800-88 standards and generates a detailed JSON certificate.
2.  **ECDSA Signing Key:** A persistent cryptographic key (`signing_key.pem`) used by the Rust engine to digitally sign every certificate, ensuring its authenticity and integrity.
3.  **Python PDF Converter (`certificate_converter.py`):** A utility script that verifies the digital signature of a JSON certificate and converts it into a human-readable PDF document.
4.  **Python IPFS Uploader (`uploader.py`):** A utility script that verifies the certificate signature and then uploads the JSON file to the InterPlanetary File System (IPFS) for decentralized, permanent storage.
5.  **React Verification Portal (`VerificationPortal.jsx`):** A web component that allows anyone to verify a certificate's authenticity. It fetches the certificate from IPFS and performs client-side cryptographic verification of its digital signature.

---

## 1. The Signing Key

The entire system's security relies on a single Elliptic Curve (ECDSA P-256) private key.

-   **Generation:** The Rust tool will automatically generate `signing_key.pem` on its first run if it doesn't exist.
-   **Security:** This private key file must be kept secure. Anyone with access to it can sign fraudulent certificates.
-   **Public Key:** A corresponding public key needs to be extracted from this file to be used by the verification components. You can use OpenSSL to do this:
    ```bash
    openssl ec -in signing_key.pem -pubout -out public_key.pem
    ```

---

## 2. Rust Wiping Engine (`secure-wiper`)

This is the core tool for wiping drives.

### Compilation

```bash
# Build the optimized release binary
cargo build --release
```
The executable will be located at `target/release/secure-wiper`.

### Usage

**Warning:** This is a destructive tool. Always double-check the drive path.

```bash
# List all available disks
./secure-wiper --list-disks

# Perform a 3-pass "Clear" (overwrite with zeros)
./secure-wiper --drive /dev/sdX --method ClearZeros --passes 3 --output cert.json --key-path signing_key.pem

# Perform a "Purge" using the drive's built-in ATA Secure Erase command
./secure-wiper --drive /dev/sdX --method Purge --output cert.json --key-path signing_key.pem
```

---

## 3. Python Scripts

Both scripts require Python 3 and the `cryptography` library.

```bash
# Install dependencies
pip install fpdf2 cryptography
```

### PDF Converter (`certificate_converter.py`)

Verifies the signature and creates a PDF.

```bash
python certificate_converter.py cert.json public_key.pem certificate.pdf
```

### IPFS Uploader (`uploader.py`)

Verifies the signature and uploads to an IPFS daemon.

```bash
# Prerequisite: pip install ipfshttpclient
python uploader.py cert.json public_key.pem
```

---

## 4. React Verification Portal

The `VerificationPortal.jsx` component can be integrated into any React application. It performs client-side verification.

### Dependencies

```bash
npm install elliptic js-sha256
```

### Usage

The portal requires the public key to be available to the frontend. It takes an IPFS CID as input, fetches the corresponding JSON certificate, and displays its verification status.
'''