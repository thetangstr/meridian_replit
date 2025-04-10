#!/bin/bash

# This script will push the current code to GitHub
# You'll need to run this manually with your GitHub credentials

# Make sure we're on the main branch
git checkout main

# Push the changes to GitHub
git push -u origin main

echo "Push completed successfully!"