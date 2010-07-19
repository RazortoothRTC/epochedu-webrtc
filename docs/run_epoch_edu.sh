#!/bin/sh
# 
# first run screen -D -R epochedu
#
cd ..
plackup -E 'development' -MPlack::App::Directory  -e 'Plack::App::Directory->new(root => "./contentrepo");' --port 5001 &
plackup -E 'development' -r -s Twiggy app.psgi &
