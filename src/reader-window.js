export function isHorizontalReaderWindow(windowInfo, readerUrl) {
  return windowInfo?.tabs?.some(tab => tab.url === readerUrl) === true;
}

export async function findHorizontalReaderWindow(windowsApi, readerUrl) {
  const windows = await windowsApi.getAll({
    populate: true,
    windowTypes: ['popup']
  });
  return windows.find(windowInfo => (
    isHorizontalReaderWindow(windowInfo, readerUrl)
  )) || null;
}

export async function focusHorizontalReaderWindow(windowsApi, readerUrl) {
  const windowInfo = await findHorizontalReaderWindow(windowsApi, readerUrl);
  if (!Number.isInteger(windowInfo?.id)) return null;
  await windowsApi.update(windowInfo.id, { focused: true });
  return windowInfo.id;
}
