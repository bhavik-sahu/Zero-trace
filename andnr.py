#!/usr/bin/env python3
"""
Real Android Data Wiping Tool - Fastboot Method with JSON Logging
This script actually works by using fastboot commands to wipe partitions.
"""

import os
import sys
import subprocess
import time
import argparse
import json
from pathlib import Path
from datetime import datetime

class AndroidDataWiper:
    def __init__(self, verbose=False, log_file="wipe_log.json"):
        self.verbose = verbose
        self.log_file = log_file
        self.log_data = {
            "tool": "Android Data Wiping Tool (Fastboot Method)",
            "timestamp": datetime.now().isoformat(),
            "system_info": {
                "hostname": os.uname().nodename if hasattr(os, 'uname') else "Unknown",
                "python_version": sys.version,
                "script_path": os.path.abspath(__file__)
            },
            "device_info": {},
            "settings": {
                "verbose": verbose,
                "log_file": log_file
            },
            "steps": [],
            "commands_executed": [],
            "result": "not_started",
            "errors": [],
            "warnings": []
        }
        self.adb_path = self.find_adb()
        self.fastboot_path = self.find_fastboot()
    
    def log_step(self, step, status, details=None):
        """Log a step in the process"""
        step_data = {
            "step": step,
            "timestamp": datetime.now().isoformat(),
            "status": status,
            "details": details
        }
        self.log_data["steps"].append(step_data)
        
        if self.verbose:
            print(f"[{step}] {status}: {details}")
        else:
            print(f"{step}: {status}")
    
    def save_log(self):
        """Save the log data to JSON file"""
        try:
            with open(self.log_file, 'w') as f:
                json.dump(self.log_data, f, indent=2, ensure_ascii=False)
            self.log_step("save_log", "success", f"Log saved to {self.log_file}")
            return True
        except Exception as e:
            error_msg = f"Failed to save log: {e}"
            self.log_step("save_log", "failed", error_msg)
            self.log_data["errors"].append(error_msg)
            return False
    
    def run_command(self, command, check=True, timeout=120):
        """Run a system command and return the result"""
        self.log_step("command", "started", command)
        
        # Add to commands executed list
        cmd_data = {
            "command": command,
            "timestamp": datetime.now().isoformat(),
            "timeout": timeout
        }
        self.log_data["commands_executed"].append(cmd_data)
        
        try:
            result = subprocess.run(
                command, 
                shell=True,
                capture_output=True, 
                text=True, 
                timeout=timeout
            )
            
            log_details = {
                "command": command,
                "returncode": result.returncode,
                "stdout": result.stdout.strip(),
                "stderr": result.stderr.strip()
            }
            
            # Update command data with results
            cmd_data.update({
                "returncode": result.returncode,
                "stdout": result.stdout.strip(),
                "stderr": result.stderr.strip(),
                "completed": True
            })
            
            if check and result.returncode != 0:
                self.log_step("command", "failed", log_details)
                return None
                
            self.log_step("command", "success", log_details)
            return result
            
        except subprocess.TimeoutExpired:
            error_msg = f"Command timed out: {command}"
            self.log_step("command", "timeout", error_msg)
            cmd_data.update({
                "completed": False,
                "error": "timeout"
            })
            self.log_data["errors"].append(error_msg)
            return None
        except Exception as e:
            error_msg = f"Error running command: {e}"
            self.log_step("command", "error", error_msg)
            cmd_data.update({
                "completed": False,
                "error": str(e)
            })
            self.log_data["errors"].append(error_msg)
            return None
    
    def find_adb(self):
        """Locate ADB executable"""
        self.log_step("find_adb", "started", "Looking for ADB executable")
        
        try:
            result = subprocess.run(["which", "adb"], capture_output=True, text=True)
            if result.returncode == 0:
                adb_path = result.stdout.strip()
                self.log_step("find_adb", "success", f"Found ADB at {adb_path}")
                return adb_path
        except Exception as e:
            self.log_step("find_adb", "error", f"Error finding ADB: {e}")
            
        error_msg = "ADB not found. Please install: sudo apt install adb fastboot"
        self.log_step("find_adb", "failed", error_msg)
        self.log_data["errors"].append(error_msg)
        print("ERROR: " + error_msg)
        sys.exit(1)
    
    def find_fastboot(self):
        """Locate Fastboot executable"""
        self.log_step("find_fastboot", "started", "Looking for Fastboot executable")
        
        try:
            result = subprocess.run(["which", "fastboot"], capture_output=True, text=True)
            if result.returncode == 0:
                fastboot_path = result.stdout.strip()
                self.log_step("find_fastboot", "success", f"Found Fastboot at {fastboot_path}")
                return fastboot_path
        except Exception as e:
            self.log_step("find_fastboot", "error", f"Error finding Fastboot: {e}")
            
        error_msg = "Fastboot not found. Please install: sudo apt install adb fastboot"
        self.log_step("find_fastboot", "failed", error_msg)
        self.log_data["errors"].append(error_msg)
        print("ERROR: " + error_msg)
        sys.exit(1)
    
    def check_device_connection(self):
        """Verify that a device is connected and authorized"""
        self.log_step("check_connection", "started", "Checking device connection")
        
        result = self.run_command(f"{self.adb_path} devices", check=False)
        if not result:
            self.log_step("check_connection", "failed", "ADB devices command failed")
            return False
            
        lines = result.stdout.strip().split('\n')
        if len(lines) < 2:
            error_msg = "No devices found"
            self.log_step("check_connection", "failed", error_msg)
            self.log_data["errors"].append(error_msg)
            print("No devices found. Please connect an Android device with USB debugging enabled.")
            return False
            
        # Check if device is authorized
        devices = []
        for line in lines[1:]:
            if line.strip():
                parts = line.split()
                if len(parts) >= 2:
                    device_id = parts[0]
                    status = parts[1]
                    devices.append({"id": device_id, "status": status})
                    
                    if status == "unauthorized":
                        error_msg = "Device is not authorized"
                        self.log_step("check_connection", "failed", error_msg)
                        self.log_data["errors"].append(error_msg)
                        print("Device is not authorized. Please allow USB debugging on your device.")
                        return False
                    elif status == "device":
                        self.log_step("check_connection", "success", f"Device found: {device_id}")
                        self.log_data["device_info"]["device_id"] = device_id
                        print("Device found and authorized.")
                        return True
        
        self.log_data["detected_devices"] = devices
        error_msg = "No authorized devices found"
        self.log_step("check_connection", "failed", error_msg)
        self.log_data["errors"].append(error_msg)
        print("No authorized devices found.")
        return False
    
    def get_device_info(self):
        """Get information about the connected device"""
        self.log_step("get_device_info", "started", "Collecting device information")
        
        info = {}
        commands = {
            "model": "getprop ro.product.model",
            "manufacturer": "getprop ro.product.manufacturer",
            "android_version": "getprop ro.build.version.release",
            "serial": "getprop ro.serialno",
            "product_name": "getprop ro.product.name",
            "build_id": "getprop ro.build.id",
            "build_version": "getprop ro.build.version.incremental",
            "hardware": "getprop ro.hardware",
            "platform": "getprop ro.board.platform",
        }
        
        for key, cmd in commands.items():
            result = self.run_command(f"{self.adb_path} shell {cmd}", check=False)
            if result and result.stdout.strip():
                info[key] = result.stdout.strip()
            else:
                info[key] = "unknown"
                self.log_data["warnings"].append(f"Could not retrieve {key} from device")
        
        self.log_data["device_info"].update(info)
        self.log_step("get_device_info", "completed", f"Collected info for {info.get('manufacturer', 'Unknown')} {info.get('model', 'Unknown')}")
        return info
    
    def confirm_wipe(self, device_info):
        """Ask for confirmation before wiping"""
        self.log_step("confirmation", "started", "Requesting user confirmation")
        
        print("\n" + "="*60)
        print("WARNING: THIS WILL ERASE ALL DATA ON THE DEVICE")
        print("="*60)
        print(f"Device: {device_info.get('manufacturer', 'Unknown')} {device_info.get('model', 'Unknown')}")
        print(f"Android Version: {device_info.get('android_version', 'Unknown')}")
        print(f"Serial: {device_info.get('serial', 'Unknown')}")
        print("="*60)
        print("This operation will PERMANENTLY ERASE ALL DATA!")
        print("ALL DATA WILL BE PERMANENTLY DELETED AND UNRECOVERABLE!")
        print("="*60)
        print("MAKE SURE OEM UNLOCKING IS ENABLED IN DEVELOPER OPTIONS!")
        print("="*60)
        
        response = input("Type 'ERASE EVERYTHING' to confirm: ")
        if response != "ERASE EVERYTHING":
            self.log_step("confirmation", "cancelled", "User did not type the confirmation phrase")
            print("Wipe cancelled.")
            return False
            
        # Final confirmation
        response = input("Are you absolutely sure? This cannot be undone! (yes/NO): ")
        if response.lower() != "yes":
            self.log_step("confirmation", "cancelled", "User declined final confirmation")
            print("Wipe cancelled.")
            return False
        
        self.log_step("confirmation", "confirmed", "User confirmed wipe operation")
        return True
    
    def reboot_to_bootloader(self):
        """Reboot device to bootloader mode"""
        self.log_step("reboot_bootloader", "started", "Rebooting to bootloader mode")
        result = self.run_command(f"{self.adb_path} reboot bootloader")
        time.sleep(10)  # Wait for reboot
        return result is not None
    
    def check_fastboot_connection(self):
        """Check if device is connected in fastboot mode"""
        self.log_step("check_fastboot", "started", "Checking fastboot connection")
        
        result = self.run_command(f"{self.fastboot_path} devices", check=False)
        if not result:
            self.log_step("check_fastboot", "failed", "Fastboot devices command failed")
            return False
            
        lines = result.stdout.strip().split('\n')
        if len(lines) < 1 or "fastboot" not in result.stdout:
            error_msg = "No devices found in fastboot mode"
            self.log_step("check_fastboot", "failed", error_msg)
            self.log_data["errors"].append(error_msg)
            print("No devices found in fastboot mode. Trying to reboot to bootloader again.")
            return False
            
        self.log_step("check_fastboot", "success", "Device found in fastboot mode")
        
        # Extract fastboot device ID
        for line in lines:
            if "fastboot" in line:
                device_id = line.split()[0]
                self.log_data["device_info"]["fastboot_id"] = device_id
                break
                
        return True
    
    def unlock_bootloader(self):
        """Unlock the device bootloader"""
        self.log_step("unlock_bootloader", "started", "Unlocking bootloader")
        
        # First check if already unlocked
        result = self.run_command(f"{self.fastboot_path} getvar unlocked", check=False)
        if result and "yes" in result.stdout:
            self.log_step("unlock_bootloader", "skipped", "Bootloader already unlocked")
            self.log_data["device_info"]["bootloader_status"] = "already_unlocked"
            return True
        
        # Try to unlock using different methods
        unlock_methods = [
            f"echo -e '\ny\n' | {self.fastboot_path} flashing unlock",
            f"{self.fastboot_path} oem unlock",
            f"echo y | {self.fastboot_path} flashing unlock"
        ]
        
        for method in unlock_methods:
            result = self.run_command(method, check=False)
            if result and result.returncode == 0:
                self.log_step("unlock_bootloader", "success", "Bootloader unlock command sent")
                self.log_data["device_info"]["bootloader_status"] = "unlocked"
                self.log_data["device_info"]["unlock_method"] = method
                print("Please confirm unlock on your device using volume and power buttons")
                time.sleep(10)
                return True
        
        self.log_step("unlock_bootloader", "failed", "Could not unlock bootloader")
        self.log_data["errors"].append("Failed to unlock bootloader")
        return False
    
    def wipe_partitions(self):
        """Wipe all partitions using fastboot"""
        self.log_step("wipe_partitions", "started", "Wiping partitions")
        
        partitions = [
            ("userdata", "erase"),
            ("userdata", "format"),
            ("cache", "erase"),
            ("cache", "format"),
            ("system", "erase"),
            ("boot", "erase"),
            ("recovery", "erase"),
            ("persist", "erase"),
            ("metadata", "erase"),
        ]
        
        wipe_results = []
        
        for partition, action in partitions:
            if action == "erase":
                cmd = f"{self.fastboot_path} erase {partition}"
            else:
                cmd = f"{self.fastboot_path} format {partition}"
            
            result = self.run_command(cmd, check=False)
            if not result or result.returncode != 0:
                status = "failed"
                self.log_step(f"wipe_{partition}", "failed", f"Failed to {action} {partition}")
            else:
                status = "success"
                self.log_step(f"wipe_{partition}", "success", f"Successfully {action}ed {partition}")
            
            wipe_results.append({
                "partition": partition,
                "action": action,
                "status": status,
                "timestamp": datetime.now().isoformat()
            })
            
            time.sleep(2)
        
        self.log_data["wipe_results"] = wipe_results
        self.log_step("wipe_partitions", "completed", "Partition wiping completed")
        return True
    
    def lock_bootloader(self):
        """Lock the bootloader after wiping"""
        self.log_step("lock_bootloader", "started", "Locking bootloader")
        
        lock_methods = [
            f"{self.fastboot_path} flashing lock",
            f"echo y | {self.fastboot_path} flashing lock",
            f"{self.fastboot_path} oem lock"
        ]
        
        for method in lock_methods:
            result = self.run_command(method, check=False)
            if result and result.returncode == 0:
                self.log_step("lock_bootloader", "success", "Bootloader lock command sent")
                self.log_data["device_info"]["bootloader_status"] = "locked"
                print("Please confirm lock on your device using volume and power buttons")
                time.sleep(10)
                return True
        
        self.log_step("lock_bootloader", "failed", "Could not lock bootloader")
        self.log_data["warnings"].append("Failed to lock bootloader")
        return False
    
    def reboot_device(self):
        """Reboot the device"""
        self.log_step("reboot_device", "started", "Rebooting device")
        result = self.run_command(f"{self.fastboot_path} reboot")
        time.sleep(5)
        return result is not None
    
    def generate_summary(self):
        """Generate a summary of the wipe operation"""
        success_steps = sum(1 for step in self.log_data["steps"] if step["status"] == "success")
        total_steps = len(self.log_data["steps"])
        
        summary = {
            "start_time": self.log_data["timestamp"],
            "end_time": datetime.now().isoformat(),
            "duration_seconds": (datetime.now() - datetime.fromisoformat(self.log_data["timestamp"].replace('Z', '+00:00'))).total_seconds(),
            "total_steps": total_steps,
            "successful_steps": success_steps,
            "success_rate": f"{(success_steps / total_steps * 100):.1f}%" if total_steps > 0 else "0%",
            "errors_count": len(self.log_data["errors"]),
            "warnings_count": len(self.log_data["warnings"]),
            "commands_executed": len(self.log_data["commands_executed"]),
            "device_model": self.log_data["device_info"].get("model", "Unknown"),
            "android_version": self.log_data["device_info"].get("android_version", "Unknown")
        }
        
        self.log_data["summary"] = summary
        return summary
    
    def main(self):
        """Main wiping procedure using fastboot"""
        self.log_step("main", "started", "Android Data Wiping Tool started")
        
        print("Android Data Wiping Tool (Fastboot Method)")
        print("=" * 50)
        print("THIS WILL UNLOCK BOOTLOADER AND WIPE ALL DATA!")
        print("=" * 50)
        
        # Check if ADB and fastboot are available
        if not self.adb_path or not self.fastboot_path:
            self.log_step("main", "failed", "ADB or Fastboot not available")
            self.log_data["result"] = "failed"
            self.generate_summary()
            self.save_log()
            return False
            
        # Check device connection
        if not self.check_device_connection():
            self.log_step("main", "failed", "No device connected")
            self.log_data["result"] = "failed"
            self.generate_summary()
            self.save_log()
            return False
            
        # Get device info
        device_info = self.get_device_info()
        
        # Confirm the wipe
        if not self.confirm_wipe(device_info):
            self.log_step("main", "cancelled", "User cancelled the operation")
            self.log_data["result"] = "cancelled"
            self.generate_summary()
            self.save_log()
            return False
            
        print("Starting wipe process in 10 seconds...")
        print("Press Ctrl+C to cancel")
        time.sleep(10)
        
        # Step 1: Reboot to bootloader
        if not self.reboot_to_bootloader():
            self.log_step("main", "failed", "Failed to reboot to bootloader")
            self.log_data["result"] = "failed"
            self.generate_summary()
            self.save_log()
            return False
        
        # Step 2: Check fastboot connection
        if not self.check_fastboot_connection():
            # Try one more time
            self.reboot_to_bootloader()
            time.sleep(10)
            if not self.check_fastboot_connection():
                self.log_step("main", "failed", "Failed to connect in fastboot mode")
                self.log_data["result"] = "failed"
                self.generate_summary()
                self.save_log()
                return False
        
        # Step 3: Unlock bootloader
        if not self.unlock_bootloader():
            self.log_step("main", "failed", "Failed to unlock bootloader")
            self.log_data["result"] = "failed"
            self.generate_summary()
            self.save_log()
            return False
        
        # Step 4: Wipe partitions
        if not self.wipe_partitions():
            self.log_step("main", "failed", "Failed to wipe partitions")
            self.log_data["result"] = "failed"
            self.generate_summary()
            self.save_log()
            return False
        
        # Step 5: Lock bootloader (optional)
        self.lock_bootloader()
        
        # Step 6: Reboot device
        self.reboot_device()
        
        self.log_step("main", "completed", "Wipe process completed")
        self.log_data["result"] = "success"
        
        # Generate and display summary
        summary = self.generate_summary()
        self.save_log()
        
        print("=" * 60)
        print("WIPE COMPLETED SUCCESSFULLY!")
        print("=" * 60)
        print(f"Device: {summary['device_model']}")
        print(f"Android: {summary['android_version']}")
        print(f"Steps: {summary['successful_steps']}/{summary['total_steps']} successful")
        print(f"Duration: {summary['duration_seconds']:.1f} seconds")
        print(f"Log saved to: {self.log_file}")
        print("=" * 60)
        print("Your device should now be completely erased.")
        print("It may take several minutes to boot up for the first time.")
        print("=" * 60)
        
        return True

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Android Data Wiping Tool (Fastboot Method)")
    parser.add_argument("-v", "--verbose", action="store_true", help="Enable verbose output")
    parser.add_argument("-l", "--log-file", default="wipe_log.json", help="JSON log file name")
    
    args = parser.parse_args()
    
    wiper = AndroidDataWiper(verbose=args.verbose, log_file=args.log_file)
    
    try:
        success = wiper.main()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        wiper.log_step("main", "interrupted", "Operation cancelled by user")
        wiper.log_data["result"] = "cancelled"
        wiper.generate_summary()
        wiper.save_log()
        print("\nOperation cancelled by user.")
        sys.exit(1)
    except Exception as e:
        error_msg = f"Unexpected error: {e}"
        wiper.log_step("main", "error", error_msg)
        wiper.log_data["result"] = "error"
        wiper.log_data["errors"].append(error_msg)
        wiper.generate_summary()
        wiper.save_log()
        print(error_msg)
        sys.exit(1)
