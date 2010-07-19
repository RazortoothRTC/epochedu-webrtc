#!/bin/sh

# IMPORTANT
# from the command line, you have to run this first
# cpan
# > install App::cpanminus 
# prompt it so it completes installtaion.  You may need to install pre-reqs
# for cpanm (http://search.cpan.org/~miyagawa/App-cpanminus-1.0006/lib/App/cpanminus.pm)
#

# Install plack
# http://search.cpan.org/~miyagawa/Plack-0.9941/lib/Plack.pm
sudo cpanm Task::Plack

# Install tatsumaki
# http://search.cpan.org/~miyagawa/Tatsumaki-0.1010/lib/Tatsumaki.pm
sudo cpanm Tatsumaki

#
# Install screen so you can keep the server running on the plug
# if you lose your connection 
sudo apt-get install screen
