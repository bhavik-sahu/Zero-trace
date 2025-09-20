'''
// src/main.rs
// The binary crate that acts as a thin wrapper around the library.

use clap::Parser;
use std::path::PathBuf;
use std::process;
use secure_wiper::{WipeConfig, WipeMethod, run_wipe};

#[derive(Parser, Debug)]
#[command(author, version, about, long_about = None)]
struct Args {
    #[arg(long, help = "List available disks and exit")]
    list_disks: bool,
    #[arg(short, long, help = "The physical drive to wipe")]
    drive: Option<String>,
    #[arg(short, long, value_enum, default_value_t = WipeMethod::ClearZeros, help = "Wipe method")]
    method: WipeMethod,
    #[arg(short, long, default_value_t = 1, help = "Number of passes for Clear methods")]
    passes: u8,
    #[arg(short, long, help = "Path to save the JSON certificate")]
    output: Option<PathBuf>,
    #[arg(long, help = "Path to the ECDSA signing key")]
    key_path: Option<PathBuf>,
}

fn main() {
    let args = Args::parse();

    if args.list_disks {
        match secure_wiper::platform::list_disks() {
            Ok(disks) => {
                println!("Available disks:");
                disks.iter().for_each(|d| println!("- {:?}", d));
            }
            Err(e) => {
                eprintln!("Error listing disks: {}", e);
                process::exit(1);
            }
        }
        return;
    }

    // Validate arguments for wipe operation
    let (drive_path, output_path, key_path) = match (args.drive, args.output, args.key_path) {
        (Some(d), Some(o), Some(k)) => (d, o, k),
        _ => {
            eprintln!("Error: --drive, --output, and --key_path are all required for a wipe operation.");
            process::exit(1);
        }
    };

    // Create the configuration for the library
    let config = WipeConfig {
        drive_path,
        method: args.method,
        passes: args.passes,
        key_path,
    };

    // Run the wipe
    println!("Starting wipe operation...");
    match run_wipe(config) {
        Ok(certificate) => {
            println!("Operation successful. Saving certificate...");
            let cert_json = serde_json::to_string_pretty(&certificate).unwrap();
            if let Err(e) = std::fs::write(&output_path, cert_json) {
                eprintln!("Failed to save certificate file: {}", e);
                process::exit(1);
            }
            println!("Certificate saved to {:?}", output_path);
        }
        Err(e) => {
            eprintln!("An error occurred during the wipe operation:");
            eprintln!("{}", e);
            // Optionally, save a FAILED certificate here
            process::exit(1);
        }
    }
}
'''