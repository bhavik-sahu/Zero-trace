'''
// src/lib.rs
// This is the main library crate for the secure wiper tool.

pub mod certificate;
pub mod error;
pub mod platform;
pub mod wipe;

use crate::error::{Result, Error};
use crate::certificate::{WipeCertificate, DeviceInfo, WipeDetails, Verification, Signature};
use crate::wipe::{WipeMethod, clear, purge};

/// Configuration for a wipe operation.
pub struct WipeConfig {
    pub drive_path: String,
    pub method: WipeMethod,
    pub passes: u8,
    pub key_path: std::path::PathBuf,
}

/// The main entry point for running a wipe operation.
pub fn run_wipe(config: WipeConfig) -> Result<WipeCertificate> {
    println!("Initializing wipe operation...");

    // --- Pre-flight checks ---
    if !platform::is_admin() {
        return Err(Error::Permissions("Administrator/root privileges are required.".to_string()));
    }

    let disks = platform::list_disks()?;
    let disk_info = disks.iter()
        .find(|d| d.device_id == config.drive_path)
        .ok_or_else(|| Error::DiskNotFound(config.drive_path.clone()))?;

    let device_info = DeviceInfo {
        path: disk_info.device_id.clone(),
        model: disk_info.model.clone(),
        serial: disk_info.serial_number.clone(),
        size_bytes: disk_info.size,
    };

    // --- HPA/DCO Handling ---
    let (hpa_removed, dco_detected) = {
        let mut file = platform::open_disk(&config.drive_path, true)?;
        let hpa = wipe::advanced::handle_hpa(&mut file)?;
        let dco = wipe::advanced::handle_dco(&mut file)?;
        (hpa, dco)
    };

    // --- Main Wipe Operation ---
    let start_time = chrono::Utc::now();
    let wipe_result = match config.method {
        WipeMethod::ClearZeros | WipeMethod::ClearRandom => {
            let mut file = platform::open_disk(&config.drive_path, true)?;
            clear::run_clear(&mut file, &config.method, config.passes, device_info.size_bytes)
        }
        WipeMethod::Purge => {
            let mut file = platform::open_disk(&config.drive_path, false)?;
            purge::run_purge(&mut file)
        }
    };

    let end_time = chrono::Utc::now();

    // --- Certificate Generation ---
    let (status, notes, verification) = match wipe_result {
        Ok((method, result)) => ("Success".to_string(), "Operation completed successfully.".to_string(), Verification { method, result }),
        Err(e) => ("Failed".to_string(), format!("Operation failed: {}", e), Verification { method: "N/A".to_string(), result: "N/A".to_string() }),
    };

    let wipe_details = WipeDetails {
        method: format!("{:?}", config.method),
        compliance: if matches!(config.method, WipeMethod::Purge) { "NIST 800-88 Purge" } else { "NIST 800-88 Clear" }.to_string(),
        passes: if matches!(config.method, WipeMethod::Purge) { 1 } else { config.passes },
        start_time,
        end_time,
        duration_seconds: end_time.signed_duration_since(start_time).num_seconds(),
        status,
        notes,
        hpa_removed,
        dco_detected,
    };

    let mut certificate = WipeCertificate::new(device_info, wipe_details);
    let signing_key = Signature::load_or_create_signing_key(&config.key_path)?;
    certificate.sign(&signing_key)?;

    println!("Wipe operation finished.");
    Ok(certificate)
}
'''