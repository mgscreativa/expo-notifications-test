import { useEffect, useRef, useState } from 'react';
import { AppState, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Checkbox from 'expo-checkbox';
import { defineTask } from 'expo-task-manager';
import {
  addNotificationReceivedListener,
  addNotificationResponseReceivedListener,
  AndroidImportance,
  getExpoPushTokenAsync,
  getNotificationChannelsAsync,
  getPermissionsAsync,
  Notification,
  NotificationChannel,
  NotificationResponse,
  registerTaskAsync,
  removeNotificationSubscription,
  requestPermissionsAsync,
  setNotificationChannelAsync,
  setNotificationHandler,
  Subscription,
  useLastNotificationResponse,
} from 'expo-notifications';
import Constants from 'expo-constants';

// https://github.com/expo/expo/tree/main/packages/expo-notifications#api
// setNotificationHandler -- sets the handler function responsible for deciding what to do with a notification that is received when the app is in foreground
// Foreground
setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Background task
// Reacts to data only notifications
// https://github.com/expo/expo/issues/29622#issuecomment-2166499879
// EXAMPLE: Send only "to" and "data" parameters
//  {
//    to: pushToken,
//    data: { someLocalData: 'goes here' },
//  }
// https://github.com/expo/expo/tree/main/packages/expo-notifications#handling-incoming-notifications-when-the-app-is-not-in-the-foreground-not-supported-in-expo-go
const BACKGROUND_NOTIFICATION_TASK = 'BACKGROUND-NOTIFICATION-TASK';
defineTask(BACKGROUND_NOTIFICATION_TASK, ({ data, error, executionInfo }) => {
  console.log(
    `${Platform.OS} BACKGROUND-NOTIFICATION-TASK: App in ${AppState.currentState} state.`,
  );

  if (error) {
    console.log(`${Platform.OS} BACKGROUND-NOTIFICATION-TASK: Error! ${JSON.stringify(error)}`);

    return;
  }

  if (AppState.currentState.match(/inactive|background/) === null) {
    console.log(
      `${Platform.OS} BACKGROUND-NOTIFICATION-TASK: App not in background state, skipping task.`,
    );

    return;
  }

  console.log(
    `${
      Platform.OS
    } BACKGROUND-NOTIFICATION-TASK: Received a notification in the background! ${JSON.stringify(
      data,
      null,
      2,
    )}`,
  );
});

// Background task
// Reacts to data only notifications
// https://github.com/expo/expo/issues/29622#issuecomment-2166499879
// EXAMPLE: Send only "to" and "data" parameters
//  {
//    to: pushToken,
//    data: { someLocalData: 'goes here' },
//  }
registerTaskAsync(BACKGROUND_NOTIFICATION_TASK)
  .then(() => {
    console.log(
      `${Platform.OS} Notifications.registerTaskAsync success: ${BACKGROUND_NOTIFICATION_TASK}`,
    );
  })
  .catch((reason) => {
    console.log(`${Platform.OS} Notifications registerTaskAsync failed: ${reason}`);
  });

async function sendPushNotification(expoPushToken: string, useFCMv1: boolean = false) {
  const message = {
    to: expoPushToken,
    sound: 'default',
    title: 'Sent notification through button',
    body: 'Send through "Press to Send Notification" button!',
    data: { someLocalData: 'goes here' },
    channelId: 'default',
  };

  const request: 'true' | 'false' = useFCMv1 ? 'true' : 'false';

  console.log(`${Platform.OS} Sending message ${JSON.stringify(message, null, 2)}`);

  await fetch(`https://exp.host/--/api/v2/push/send?useFcmV1=${request}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.EXPO_PUBLIC_NOTIFICATIONS_AUTH_KEY}`,
      Accept: 'application/json',
      'Accept-encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(message),
  });
}

async function registerForPushNotificationsAsync() {
  if (Platform.OS === 'android') {
    console.log(`${Platform.OS} Set channel default setNotificationChannelAsync`);

    // https://github.com/expo/expo/tree/main/packages/expo-notifications#api
    // setNotificationChannelAsync -- saves a notification channel configuration
    if (Platform.OS === 'android') {
      await setNotificationChannelAsync('default', {
        name: 'default',
        importance: AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }
  }

  // https://github.com/expo/expo/tree/main/packages/expo-notifications#api
  // getPermissionsAsync -- fetches current permission settings related to notifications
  const { status: existingStatus } = await getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    // https://github.com/expo/expo/tree/main/packages/expo-notifications#api
    // requestPermissionsAsync -- requests permissions related to notifications
    const { status } = await requestPermissionsAsync();
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
    const pushTokenString =
      // https://github.com/expo/expo/tree/main/packages/expo-notifications#api
      // getExpoPushTokenAsync -- resolves with an Expo push token
      (
        await getExpoPushTokenAsync({
          projectId,
        })
      ).data;

    console.log(`${Platform.OS} Got Expo push token ${pushTokenString}`);

    return pushTokenString;
  } catch (e: unknown) {
    handleRegistrationError(`${e}`);
  }
}

function handleRegistrationError(errorMessage: string) {
  alert(errorMessage);
  throw new Error(errorMessage);
}

export default function App() {
  const [expoPushToken, setExpoPushToken] = useState('');
  const [channels, setChannels] = useState<NotificationChannel[]>([]);
  const [forceFcmv1, setForceFcmv1] = useState(false);
  const [notification, setNotification] = useState<Notification | undefined>(undefined);
  const [response, setResponse] = useState<NotificationResponse | undefined>(undefined);
  const notificationListener = useRef<Subscription>();
  const responseListener = useRef<Subscription>();

  useEffect(() => {
    console.log(`${Platform.OS} Getting Expo Token with registerForPushNotificationsAsync`);
    registerForPushNotificationsAsync()
      .then((token) => setExpoPushToken(token ?? ''))
      .catch((error: any) => setExpoPushToken(`${error}`));

    getNotificationChannelsAsync().then((value) => setChannels(value ?? []));
  }, []);

  useEffect(() => {
    // https://github.com/expo/expo/tree/main/packages/expo-notifications#api
    // addNotificationReceivedListener -- adds a listener called whenever a new notification is received
    // Foreground
    console.log(`${Platform.OS} Creating notificationListener`);
    notificationListener.current = addNotificationReceivedListener((notification) => {
      console.log(
        `${Platform.OS} Notification received through notificationListener [NotificationReceivedListener] ${JSON.stringify(notification, null, 2)}`,
      );

      setNotification(notification);
    });

    // https://github.com/expo/expo/tree/main/packages/expo-notifications#api
    // addNotificationResponseReceivedListener -- adds a listener called whenever user interacts with a notification
    // Foreground & Background & Killed
    console.log(`${Platform.OS} Creating responseListener`);
    responseListener.current = addNotificationResponseReceivedListener((response) => {
      console.log(
        `${Platform.OS} Response received through responseListener [NotificationResponseReceivedListener] ${JSON.stringify(response, null, 2)}`,
      );

      setResponse(response);
    });

    console.log(`${Platform.OS} added listeners`);

    return () => {
      // https://github.com/expo/expo/tree/main/packages/expo-notifications#api
      // removeNotificationSubscription -- removes the listener registered with addNotificationReceivedListener()
      console.log(`${Platform.OS} Removing notificationListener`);
      notificationListener.current && removeNotificationSubscription(notificationListener.current);

      // https://github.com/expo/expo/tree/main/packages/expo-notifications#api
      // removeNotificationSubscription -- removes the listener registered with addNotification*Listener()
      console.log(`${Platform.OS} Removing responseListener`);
      responseListener.current && removeNotificationSubscription(responseListener.current);
    };
  }, []);

  // https://github.com/expo/expo/tree/main/packages/expo-notifications#api
  // useLastNotificationResponse -- a React hook returning the most recently received notification response
  // Foreground & Background
  const lastNotificationResponse = useLastNotificationResponse();
  useEffect(() => {
    if (lastNotificationResponse === undefined || lastNotificationResponse === null) {
      console.log(
        `${Platform.OS} lastNotificationResponse is undefined or null [useLastNotificationResponse] ${JSON.stringify(lastNotificationResponse, null, 2)}`,
      );

      return;
    }

    console.log(
      `${Platform.OS} Got notification from lastNotificationResponse [useLastNotificationResponse] ${JSON.stringify(lastNotificationResponse, null, 2)}`,
    );
  }, [lastNotificationResponse]); // <!--- this bit is important

  // https://reactnative.dev/docs/appstate#basic-usage
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      console.log(`${Platform.OS} App state changed to ${nextAppState}`);
    });

    return () => {
      subscription.remove();
    };
  }, []);

  return (
    <View style={styles.container}>
      <Text>Your Expo push token: {expoPushToken}</Text>
      <Text>{`Channels: ${JSON.stringify(
        channels.map((c: { id: string }) => c.id),
        null,
        2,
      )}`}</Text>
      <View style={styles.notification}>
        <Text>Title: {notification && notification.request.content.title} </Text>
        <Text>Body: {notification && notification.request.content.body}</Text>
        <Text>Data: {notification && JSON.stringify(notification.request.content.data)}</Text>
        <Text>
          Response received title: {response && response.notification.request.content.title}
        </Text>
        <Text>
          Response received body: {response && response.notification.request.content.body}
        </Text>
        <Text>
          Response received data:{' '}
          {response && JSON.stringify(response.notification.request.content.data)}
        </Text>
        <Text>
          Last response title:{' '}
          {lastNotificationResponse && lastNotificationResponse.notification.request.content.title}
        </Text>
        <Text>
          Last response body:{' '}
          {lastNotificationResponse &&
            JSON.stringify(lastNotificationResponse.notification.request.content.body)}
        </Text>
        <Text>
          Last response data:{' '}
          {lastNotificationResponse &&
            JSON.stringify(lastNotificationResponse.notification.request.content.data)}
        </Text>
      </View>
      <Pressable
        style={({ pressed }) => [
          { backgroundColor: pressed ? 'blue' : 'cornflowerblue' },
          styles.btn,
        ]}
        onPress={async () => {
          console.log(`${Platform.OS} Sending test notification...`);

          await sendPushNotification(expoPushToken, forceFcmv1);
        }}>
        {({ pressed }) => (
          <Text style={{ color: pressed ? 'black' : 'azure' }}>Press to Send Notification</Text>
        )}
      </Pressable>
      <Pressable
        style={({ pressed }) => [
          { backgroundColor: pressed ? 'blue' : 'cornflowerblue' },
          styles.btn,
        ]}
        onPress={async () => {
          console.log(`${Platform.OS} Clearing notifications...`);

          await setNotification(undefined);
          await setResponse(undefined);
        }}>
        {({ pressed }) => (
          <Text style={{ color: pressed ? 'black' : 'azure' }}>Clear notifications</Text>
        )}
      </Pressable>
      <Pressable
        style={({ pressed }) => [
          { backgroundColor: pressed ? 'blue' : 'cornflowerblue' },
          styles.btn,
        ]}
        onPress={async () => {
          console.log(`${Platform.OS} channels object ${JSON.stringify(channels, null, 2)}`);
        }}>
        {({ pressed }) => (
          <Text style={{ color: pressed ? 'black' : 'azure' }}>Console.log channels object</Text>
        )}
      </Pressable>
      <View style={styles.section}>
        <Checkbox style={styles.checkbox} value={forceFcmv1} onValueChange={setForceFcmv1} />
        <Text style={styles.paragraph}>Force FCM v1</Text>
      </View>
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
  section: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  paragraph: {
    fontSize: 15,
  },
  checkbox: {
    margin: 8,
  },
  btn: {
    padding: 15,
    borderRadius: 5,
  },
});
