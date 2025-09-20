'''
// src/error.rs
// Custom error types for the application.

use std::fmt;

/// A top-level error type for the application.
#[derive(Debug)]
pub enum Error {
    Permissions(String),
    DiskNotFound(String),
    Io(io::Error),
    Wmi(String), // For Windows-specific WMI errors
    Verification(String),
    Signing(String),
    Platform(String),
}

// Allow converting io::Error into our custom Error type.
impl From<io::Error> for Error {
    fn from(err: io::Error) -> Self {
        Error::Io(err)
    }
}

// Implement the standard Error trait.
impl std::error::Error for Error {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        match self {
            Error::Io(ref err) => Some(err),
            _ => None,
        }
    }
}

// Implement the Display trait for user-friendly error messages.
impl fmt::Display for Error {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        match self {
            Error::Permissions(msg) => write!(f, "Permission Denied: {}", msg),
            Error::DiskNotFound(path) => write!(f, "Disk not found: {}", path),
            Error::Io(err) => write!(f, "I/O Error: {}", err),
            Error::Wmi(msg) => write!(f, "Windows WMI Error: {}", msg),
            Error::Verification(msg) => write!(f, "Verification Failed: {}", msg),
            Error::Signing(msg) => write!(f, "Signing Error: {}", msg),
            Error::Platform(msg) => write!(f, "Platform Error: {}", msg),
        }
    }
}

/// A specialized `Result` type for this crate.
pub type Result<T> = std::result::Result<T, Error>;
'''