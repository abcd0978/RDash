#!/bin/sh
cd "$(dirname "$0")"
while true; do ROS_VER=1 node backend/server.js; sleep 1; done
