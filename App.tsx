import { useState, useEffect, useRef } from 'react';
import { Text, View, Pressable, Platform, StyleSheet } from 'react-native';
import * as Device from 'expo-device';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

/*
 * DOCUMENTATION
 * https://docs.expo.dev/push-notifications/push-notifications-setup/
 * https://github.com/expo/expo/tree/sdk-50/packages/expo-notifications
 * https://docs.expo.dev/versions/latest/sdk/notifications/
 * Notification events listeners: https://docs.expo.dev/versions/latest/sdk/notifications/#notification-events-listeners
 *
 */

/**
 *
 * Start Hack Android
 * https://github.com/expo/expo/issues/14078#issuecomment-1041294084
 *
 */

const androidNotificationStack = [];
let androidNotificationListener = null;

const enableAndroidNotificationListener = () => {
  if (Platform.OS !== "android") {
    return;
  }

  console.log(`Creating androidNotificationListener`);
  androidNotificationListener =
      Notifications.addNotificationResponseReceivedListener(
          ({ notification }) => {
            console.log(`Got notification trough addNotificationResponseReceivedListener ${JSON.stringify(notification)}`);

            androidNotificationStack.push(notification);
          }
      );
};

enableAndroidNotificationListener();

const disableAndroidNotificationListener = () => {
  console.log(`Removing androidNotificationListener`);

  androidNotificationListener?.remove();
};

/**
 *
 * End Hack Android
 *
 */

// setNotificationHandler -- sets the handler function responsible for deciding what to do with a notification that is received when the app is in foreground
// Foreground
// https://github.com/expo/expo/tree/sdk-50/packages/expo-notifications#api
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function sendPushNotification(expoPushToken: string) {
  const message = {
    to: expoPushToken,
    sound: 'default',
    title: 'Sent notification through button',
    body: 'Send through "Press to Send Notification" button!',
    data: { someLocalData: 'goes here' },
  };

  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      // Authorization: 'Bearer ',
      Accept: 'application/json',
      'Accept-encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(message),
  });
}

function handleRegistrationError(errorMessage: string) {
  alert(errorMessage);
  throw new Error(errorMessage);
}

async function registerForPushNotificationsAsync() {
  if (Platform.OS === 'android') {
    console.log(`Setting Android setNotificationChannelAsync`);

    // setNotificationChannelAsync -- saves a notification channel configuration
    // https://github.com/expo/expo/tree/sdk-50/packages/expo-notifications#api
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  if (Device.isDevice) {
    // getPermissionsAsync -- fetches current permission settings related to notifications
    // https://github.com/expo/expo/tree/sdk-50/packages/expo-notifications#api
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      // requestPermissionsAsync -- requests permissions related to notifications
      // https://github.com/expo/expo/tree/sdk-50/packages/expo-notifications#api
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      handleRegistrationError('Permission not granted to get push token for push notification!');
      return;
    }

    const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;

    if (!projectId) {
      handleRegistrationError('Project ID not found');
    }

    try {
      const pushTokenString = (
          // getExpoPushTokenAsync -- resolves with an Expo push token
          // https://github.com/expo/expo/tree/sdk-50/packages/expo-notifications#api
          await Notifications.getExpoPushTokenAsync({
            projectId,
          })
      ).data;

      console.log(`Got Expo push token ${pushTokenString}`);

      return pushTokenString;
    } catch (e: unknown) {
      handleRegistrationError(`${e}`);
    }
  } else {
    handleRegistrationError('Must use physical device for push notifications');
  }
}

export default function App() {
  const [expoPushToken, setExpoPushToken] = useState('');
  const [notification, setNotification] = useState<Notifications.Notification | undefined>(undefined);
  const notificationListener = useRef<Notifications.Subscription>();
  const responseListener = useRef<Notifications.Subscription>();

  /**
   *
   * Start Hack Android
   * https://github.com/expo/expo/issues/14078#issuecomment-1041294084
   *
   */

  const onNotificationReceipt = async (
      response: Notifications.NotificationResponse | undefined,
  ) => {
    if (response) {
      console.log(`onNotificationReceipt ${JSON.stringify(response)}`);

      setNotification(response.request.content);
    }
  };

  /**
   *
   * End hack Android
   *
   */

  // https://github.com/expo/expo/tree/sdk-50/packages/expo-notifications#handling-incoming-notifications-when-the-app-is-not-in-the-foreground-not-supported-in-expo-go
  // Background
  const BACKGROUND_NOTIFICATION_TASK = 'BACKGROUND-NOTIFICATION-TASK';
  TaskManager.defineTask(BACKGROUND_NOTIFICATION_TASK, ({ data, error, executionInfo }) => {
    console.log(`Received a notification in the background! ${JSON.stringify(data)}`);

    data.notification.data.data = JSON.parse(data.notification.data.body);
    data.notification.data.body = data.notification.data.message;
    setNotification(data.notification.data);
  });

  // useLastNotificationResponse -- a React hook returning the most recently received notification response
  // Foreground & Background
  // https://github.com/expo/expo/tree/sdk-50/packages/expo-notifications#api
  const latestNotificationResponse = Notifications.useLastNotificationResponse();

  useEffect(() => {
    console.log('Getting Expo Token with registerForPushNotificationsAsync');
    registerForPushNotificationsAsync()
        .then((token) => setExpoPushToken(token ?? ''))
        .catch((error: any) => setExpoPushToken(`${error}`));

    console.log(`latestNotificationResponse [useLastNotificationResponse] ${JSON.stringify(latestNotificationResponse)}`);

    /**
     *
     * Start Hack Android
     * https://github.com/expo/expo/issues/14078#issuecomment-1041294084
     *
     */

    if (latestNotificationResponse) {
      console.log(`Got notification from latestNotificationResponse ${JSON.stringify(latestNotificationResponse)}`);

      onNotificationReceipt(latestNotificationResponse).then(() => null);
    } else {
      while (androidNotificationStack.length > 0) {
        console.log(`Got notification from androidNotificationStack ${JSON.stringify(androidNotificationStack)}`);

        onNotificationReceipt(androidNotificationStack.shift()).then(() => null);
      }
    }

    disableAndroidNotificationListener();

    /**
     *
     * End hack Android
     *
     */

    console.log('Creating notificationListener');
    notificationListener.current =
        // addNotificationReceivedListener -- adds a listener called whenever a new notification is received
        // Foreground
        // https://github.com/expo/expo/tree/sdk-50/packages/expo-notifications#api
        Notifications.addNotificationReceivedListener((notification) => {
          console.log(`Notification received through notificationListener [NotificationReceivedListener] ${JSON.stringify(notification)}`);

          setNotification(notification.request.content);
        });

    console.log('Creating responseListener');
    responseListener.current =
        // addNotificationResponseReceivedListener -- adds a listener called whenever user interacts with a notification
        // Foreground & Background & Killed
        // https://github.com/expo/expo/tree/sdk-50/packages/expo-notifications#api
        Notifications.addNotificationResponseReceivedListener((response) => {
          console.log(`Notification received through responseListener [NotificationResponseReceivedListener] ${JSON.stringify(response)}`);

          setNotification(response.notification.request.content);
        });

    Notifications.registerTaskAsync(BACKGROUND_NOTIFICATION_TASK).then(() => null);

    return () => {
      console.log('Removing notificationListener');
      notificationListener.current &&
      // removeNotificationSubscription -- removes the listener registered with addNotification*Listener()
      // https://github.com/expo/expo/tree/sdk-50/packages/expo-notifications#api
      Notifications.removeNotificationSubscription(
          notificationListener.current
      );

      console.log('Removing responseListener');
      responseListener.current &&
      // removeNotificationSubscription -- removes the listener registered with addNotification*Listener()
      // https://github.com/expo/expo/tree/sdk-50/packages/expo-notifications#api
      Notifications.removeNotificationSubscription(
          responseListener.current
      );
    };
  }, []);

  console.log(`Notification to parse ${JSON.stringify(notification)}`);

  return (
    <View style={styles.container}>
      <Text>Your Expo push token: {expoPushToken}</Text>
      <View style={styles.notification}>
        <Text>
          Title: {notification && notification.title}{' '}
        </Text>
        <Text>Body: {notification && notification.body}</Text>
        <Text>
          Data:{' '}
          {notification && JSON.stringify(notification.data)}
        </Text>
      </View>
      <Pressable
        style={({ pressed }) => [{ backgroundColor: pressed ? 'blue' : 'cornflowerblue' }, styles.btn ]}
        onPress={async () => {
            console.log('Sending test notification...');

            await sendPushNotification(expoPushToken);
          }}
      >
        {({pressed}) => (
            <Text style={{ color: pressed ? 'black' : 'azure' }}>
              Press to Send Notification
            </Text>
        )}
      </Pressable>
      <Pressable
          style={({ pressed }) => [{ backgroundColor: pressed ? 'blue' : 'cornflowerblue' }, styles.btn ]}
          onPress={async () => {
            console.log('Clearing last notification...');

            await setNotification(undefined);
          }}
      >
        {({pressed}) => (
            <Text style={{ color: pressed ? 'black' : 'azure' }}>
              Clear notification
            </Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  notification: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  btn: {
    padding: 15,
    borderRadius: 5,
  }
});
