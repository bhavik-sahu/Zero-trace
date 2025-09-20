'''
// src/wipe/mod.rs
// Declares the modules for different wipe methodologies.

pub mod clear;
pub mod purge;

// Re-exporting the advanced HPA/DCO handling functions for use in lib.rs
pub use purge::advanced;

use serde::{Deserialize, Serialize};

#[derive(clap::ValueEnum, Clone, Debug, Serialize, Deserialize)]
pub enum WipeMethod {
    ClearZeros,  // NIST 800-88 Clear
    ClearRandom, // NIST 800-88 Clear
    Purge,       // NIST 800-88 Purge (ATA Secure Erase)
}
'''