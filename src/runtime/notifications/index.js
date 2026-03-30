export function createTaskNotifier(notificationManager) {
  return {
    notifyTask(event) {
      return notificationManager.notify({ type: 'task', ...event });
    },
  };
}
