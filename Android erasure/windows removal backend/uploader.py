'''
# uploader.py (v2)
#
# Verifies the ECDSA signature of a certificate and then uploads it to IPFS.
#
# Prerequisites:
# pip install ipfshttpclient cryptography
#
# Usage:
# python uploader.py <json_path> <public_key_pem_path>

import json
import sys
import ipfshttpclient
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.serialization import load_pem_public_key
from cryptography.exceptions import InvalidSignature

def verify_signature(public_key_path, certificate_data):
    """Verifies the ECDSA signature of the certificate."""
    try:
        with open(public_key_path, "rb") as f:
            public_key = load_pem_public_key(f.read())
    except Exception as e:
        return False, f"Could not load public key: {e}"

    signature_hex = certificate_data.pop('signature', None)
    if not signature_hex:
        return False, "No signature found in certificate."

    try:
        signature = bytes.fromhex(signature_hex)
    except ValueError:
        return False, "Signature is not valid hex."

    payload = json.dumps(certificate_data, sort_keys=True, separators=(',', ':')).encode('utf-8')

    try:
        public_key.verify(signature, payload, ec.ECDSA(hashes.SHA256()))
        return True, "Signature is VALID"
    except InvalidSignature:
        return False, "Signature is INVALID"
    except Exception as e:
        return False, f"An unexpected error occurred during verification: {e}"

def main(json_path, key_path):
    # 1. Read the certificate data
    try:
        with open(json_path, 'r') as f:
            data = json.load(f)
    except Exception as e:
        print(f"Error: Could not read JSON file at {json_path}. {e}")
        sys.exit(1)

    # 2. Verify the signature before proceeding
    print(f"Verifying signature for {json_path}...")
    is_valid, status_text = verify_signature(key_path, data.copy())

    if not is_valid:
        print(f"Verification FAILED: {status_text}")
        print("Aborting upload. Only valid certificates should be uploaded.")
        sys.exit(1)

    print(f"Verification PASSED: {status_text}")

    # 3. Connect to IPFS and upload
    try:
        client = ipfshttpclient.connect()
        print("Connecting to IPFS daemon...")
        res = client.add(json_path)
        ipfs_cid = res['Hash']
        print(f"Successfully uploaded to IPFS. CID: {ipfs_cid}")
        print("You can view the file at: https://ipfs.io/ipfs/" + ipfs_cid)
    except Exception as e:
        print(f"Error: Failed to connect to or upload to IPFS daemon: {e}")
        print("Please ensure the IPFS daemon is running.")
        sys.exit(1)

    # 4. (Optional) Update JSON with IPFS CID and re-save
    # This part is commented out as it would invalidate the original signature.
    # A better approach is to have a separate system that links the certificate ID to the CID.
    # with open(json_path, 'r+') as f:
    #     data = json.load(f)
    #     data['blockchain_integration']['ipfs_cid'] = ipfs_cid
    #     f.seek(0)
    #     json.dump(data, f, indent=4)
    #     f.truncate()
    # print(f"Updated {json_path} with IPFS CID.")

if __name__ == '__main__':
    if len(sys.argv) != 3:
        print("Usage: python uploader.py <json_path> <public_key_pem_path>")
        sys.exit(1)
    main(sys.argv[1], sys.argv[2])
'''