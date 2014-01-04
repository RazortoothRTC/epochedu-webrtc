@echo off

echo Android Screenshot Library -- Initializing...

if not defined ANDROID goto SdkPathNotDefined

echo Waiting for device to be connected...
%ANDROID%\platform-tools\adb.exe wait-for-device

echo - Installing native service...
%ANDROID%\platform-tools\adb.exe push ./asl-native /data/local/tmp/asl-native
%ANDROID%\platform-tools\adb.exe shell /system/bin/chmod 0777 /data/local/tmp/asl-native

echo Starting...

%ANDROID%\platform-tools\adb.exe shell kill -9 "/data/local/tmp/asl-native"
start /B %ANDROID%\platform-tools\adb.exe shell "/data/local/tmp/asl-native /data/local/tmp/asl-native.log"

echo Service started successfully.


goto Finish

:SdkPathNotDefined
echo *** Android SDK not found ***
echo Make sure ANDROID variable is set to root folder of Android SDK.

:Finish