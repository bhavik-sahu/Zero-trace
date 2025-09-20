'''
// src/platform/mod.rs
// Platform-agnostic interface for platform-specific operations.

use crate::error::{Result, Error};
use std::fs::File;
use std::io;

#[cfg(target_os = "windows")]
mod windows;
#[cfg(target_os = "windows")]
use self::windows as os;

#[cfg(target_os = "linux")]
mod linux;
#[cfg(target_os = "linux")]
use self::linux as os;

#[derive(Debug, Clone)]
pub struct DiskInfo {
    pub device_id: String,
    pub model: String,
    pub serial_number: String,
    pub size: u64,
}

/// Check for administrator/root privileges.
pub fn is_admin() -> bool {
    os::is_admin()
}

/// List all physical disks connected to the system.
pub fn list_disks() -> Result<Vec<DiskInfo>> {
    os::list_disks()
}

/// Open a handle to a disk with exclusive access.
pub fn open_disk(path: &str, write_access: bool) -> io::Result<File> {
    os::open_disk(path, write_access)
}
'''