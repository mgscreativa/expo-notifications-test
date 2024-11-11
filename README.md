# expo-notifications-test
Test project to try expo-notifications package in an expo development build

## BUILD

For local builds you must setup your dev environment as stated in Expo and RN documentation. If you use EAS servers, just remove the `--local` flag

### Production local test build 
- Android local production test build `npx eas build --profile production-preview --platform android --clear-cache --local`
- iOS local production test build `npx eas build --profile production-preview --platform ios --clear-cache --local`

### Development local test build
- Android local development build `npx eas build --profile development --platform android --clear-cache --local`
- iOS local development build `npx eas build --profile development --platform ios --clear-cache --local`

## RELATED ISSUES
- [FCM v1 Issue](https://github.com/expo/expo/issues/28656)
- [Background Task Issue](https://github.com/expo/expo/issues/29622)

## DOCUMENTATION
- [Push notifications setup](https://docs.expo.dev/push-notifications/push-notifications-setup/)
- [Expo notifications package source](https://github.com/expo/expo/tree/main/packages/expo-notifications)
- [Expo notifications official docs](https://docs.expo.dev/versions/latest/sdk/notifications/)
- [Notification events listeners](https://docs.expo.dev/versions/latest/sdk/notifications/#notification-events-listeners)