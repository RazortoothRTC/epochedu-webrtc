#!/bin/sh
# adb shell "while [ 1 ]; do ls; done"
echo "Running screengrabs"
while [ 1 ]
do 
	/system/bin/screencap -p "foo.png"
done
	
