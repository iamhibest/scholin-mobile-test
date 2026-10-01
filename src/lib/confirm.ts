import { Alert } from 'react-native';

export function confirmAction(title: string, message: string, actionLabel: string, onConfirm: () => void, destructive = true) {
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: actionLabel, style: destructive ? 'destructive' : 'default', onPress: onConfirm },
  ]);
}

export function showError(message: string) {
  Alert.alert('Something went wrong', message);
}
