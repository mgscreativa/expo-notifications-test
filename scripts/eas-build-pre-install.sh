#!/bin/bash

echo $GOOGLE_SERVICES_JSON_EXPO_NOTIFICATIONS_TEST | base64 --decode > ./google-services.json

if [[ "$EAS_BUILD_PLATFORM" == "ios" ]]; then
  pod repo update
fi
