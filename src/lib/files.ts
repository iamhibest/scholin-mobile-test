import { PermissionsAndroid, Platform } from 'react-native';
import ReactNativeBlobUtil from 'react-native-blob-util';
import Share from 'react-native-share';

const FOLDER = 'Scholin';

export async function writeTempFile(name: string, content: string, encoding: 'utf8' | 'base64' = 'utf8') {
  const path = ReactNativeBlobUtil.fs.dirs.CacheDir + '/' + name;
  await ReactNativeBlobUtil.fs.writeFile(path, content, encoding);
  return path;
}

export async function shareFile(path: string, mime: string, title: string) {
  const url = path.startsWith('file://') ? path : 'file://' + path;
  await Share.open({ url, type: mime, title, failOnCancel: false });
}

export async function saveToDownloads(sourcePath: string, fileName: string, mime: string): Promise<string> {
  const path = sourcePath.replace('file://', '');
  if (Platform.OS === 'android' && Number(Platform.Version) >= 29) {
    await ReactNativeBlobUtil.MediaCollection.copyToMediaStore({ name: fileName, parentFolder: FOLDER, mimeType: mime }, 'Download', path);
    return 'Downloads/' + FOLDER;
  }
  const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE);
  if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
    throw new Error('Storage permission is needed to save files to your phone.');
  }
  const dir = ReactNativeBlobUtil.fs.dirs.DownloadDir + '/' + FOLDER;
  try {
    await ReactNativeBlobUtil.fs.mkdir(dir);
  } catch {}
  await ReactNativeBlobUtil.fs.cp(path, dir + '/' + fileName);
  return 'Downloads/' + FOLDER;
}

export function safeName(name: string) {
  return name.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'file';
}
