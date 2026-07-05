#!/bin/bash
apt-get update -y
apt-get install -y docker.io docker-compose-v2
usermod -aG docker ubuntu
systemctl enable docker
systemctl start docker
