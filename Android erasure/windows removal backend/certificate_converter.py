'''
# certificate_converter.py (v2)
#
# Verifies the ECDSA signature of a JSON certificate and converts it to a PDF.
#
# Prerequisites:
# pip install fpdf2 cryptography
#
# Usage:
# python certificate_converter.py <json_path> <public_key_pem_path> <output_pdf_path>

import json
import sys
from fpdf import FPDF
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

    # The signature is removed from the data to be verified
    signature_hex = certificate_data.pop('signature', None)
    if not signature_hex:
        return False, "No signature found in certificate."

    try:
        signature = bytes.fromhex(signature_hex)
    except ValueError:
        return False, "Signature is not valid hex."

    # The payload is the JSON string of the certificate *without* the signature field.
    # It must be canonicalized to match how it was signed.
    payload = json.dumps(certificate_data, sort_keys=True, separators=(',', ':')).encode('utf-8')

    try:
        public_key.verify(
            signature,
            payload,
            ec.ECDSA(hashes.SHA256())
        )
        return True, "Signature is VALID"
    except InvalidSignature:
        return False, "Signature is INVALID"
    except Exception as e:
        return False, f"An unexpected error occurred during verification: {e}"

class PDF(FPDF):
    def header(self):
        self.set_font('Arial', 'B', 12)
        self.cell(0, 10, 'Certificate of Data Destruction', 0, 1, 'C')
        self.ln(10)

    def footer(self):
        self.set_y(-15)
        self.set_font('Arial', 'I', 8)
        self.cell(0, 10, f'Page {self.page_no()}', 0, 0, 'C')

def create_certificate(json_path, key_path, pdf_path):
    try:
        with open(json_path, 'r') as f:
            data = json.load(f)
    except Exception as e:
        print(f"Error reading JSON file: {e}")
        return

    # Verify the signature first
    is_valid, verification_status_text = verify_signature(key_path, data.copy()) # Pass a copy

    pdf = PDF()
    pdf.add_page()

    # --- Signature Status Section ---
    pdf.set_font('Arial', 'B', 14)
    if is_valid:
        pdf.set_text_color(0, 128, 0) # Green
        pdf.cell(0, 10, "Certificate Status: VERIFIED", 0, 1, 'C')
    else:
        pdf.set_text_color(255, 0, 0) # Red
        pdf.cell(0, 10, "Certificate Status: INVALID", 0, 1, 'C')
    pdf.set_text_color(0, 0, 0)
    pdf.set_font('Courier', '', 8)
    pdf.cell(0, 5, verification_status_text, 0, 1, 'C')
    pdf.ln(10)

    # --- Certificate Details ---
    pdf.set_font('Arial', 'B', 12)
    pdf.cell(0, 10, f"Certificate ID: {data.get('certificate_id', 'N/A')}", 0, 1, 'L')
    # ... (rest of the PDF generation logic from v2) ...
    # This part can be expanded to print all fields from the JSON.

    try:
        pdf.output(pdf_path, 'F')
        print(f"Successfully created PDF certificate at {pdf_path}")
    except Exception as e:
        print(f"Error saving PDF: {e}")

if __name__ == '__main__':
    if len(sys.argv) != 4:
        print("Usage: python certificate_converter.py <json_path> <public_key_pem_path> <output_pdf_path>")
        sys.exit(1)
    create_certificate(sys.argv[1], sys.argv[2], sys.argv[3])
'''