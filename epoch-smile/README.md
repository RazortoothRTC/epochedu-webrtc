Application
===========

 * Pre-requisites:
  - NodeJS >= 0.8.16 (haven't tested on 0.10.x yet)
  - NPM >= 1.0

 * Run application
  $ sudo node smileplug.js (sudo only if you run on port 80)

Bundled Client Applications
===========================

* SMILE Student Web 1.0.0
* SMILE IQManager 1.0.0
* SMILE Teacher for Android 0.9.6
* Plugmin 0.5.1 for Android

Installation
============
Typically, just do:

npm install .

On ARMv7 devices running Arch Linux ARM, if you have problems installing, use the following npm packages:
wget http://polyblog.s3.amazonaws.com/node_modules-smileserver.tar.gz && tar -xvf node_modules-smileserver.tar.gz


Tests
=====

 * Install test dependencies:
  $ npm install -d

 * Run unit tests
  $ ./run_unit_tests 

 * Run functional tests
  $ ./run_functional_tests 
