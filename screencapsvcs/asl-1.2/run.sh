#!/bin/bash

# Android Screenshot Library #
##############################
#       Startup script       #

echo "Android Screenshot Library -- initializing..."
#
if [ -z $ANDROID ]; then
	echo "*** Android SDK not found ***"
	echo "Make sure the ANDROID variable is pointing to Android SDK root directory"
else
	adb="$ANDROID/platform-tools/adb"
	
	# Check whether device is connected or wait for one
	adbState=`$adb get-state`
	if [ $adbState = "device" ]; then
		echo "Device not found -- connect one to continue..."
		$adb wait-for-device
		echo "Device connected."
	fi
	
	# Install service
	echo "Installing native service..."
	$adb push ./asl-native /data/local/tmp/asl-native
	$adb shell /system/bin/chmod 0777 /data/local/tmp/asl-native
	
	# Start the service
	echo "Starting service..."
	$adb shell "/data/local/tmp/asl-native /data/local/tmp/asl-native.log" &
	echo "Service started successfully."
fi
