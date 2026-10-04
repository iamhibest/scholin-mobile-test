import { launchImageLibrary } from 'react-native-image-picker';
import { supabase } from './supabase';

export type PickResult = { uri: string; url: string } | null;

// The picture is sent to the upload-image Edge Function, which holds the
// storage credentials. Nothing secret or account specific lives in the app.
export async function pickAndUploadImage(schoolId: string | null): Promise<PickResult> {
  const picked = await launchImageLibrary({
    mediaType: 'photo',
    selectionLimit: 1,
    maxWidth: 1000,
    maxHeight: 1000,
    quality: 0.75,
    includeBase64: true,
  });
  if (picked.didCancel) {
    return null;
  }
  if (picked.errorCode) {
    throw new Error(picked.errorMessage || 'Could not open your photos.');
  }
  const asset = picked.assets && picked.assets[0];
  if (!asset || !asset.uri || !asset.base64) {
    return null;
  }
  if (asset.fileSize && asset.fileSize > 8 * 1024 * 1024) {
    throw new Error('Image is too large (max 8MB).');
  }

  const { data, error } = await supabase.functions.invoke('upload-image', {
    body: { school_id: schoolId, image_base64: asset.base64, content_type: asset.type || 'image/jpeg' },
  });
  if (error || !data || data.error || !data.url) {
    throw new Error((data && data.error) || 'Upload failed. Check your connection and try again.');
  }
  const problem = await linkProblem(data.url as string);
  if (problem) {
    throw new Error(problem);
  }
  return { uri: asset.uri, url: data.url as string };
}

async function linkProblem(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { method: 'HEAD', signal: controller.signal });
    clearTimeout(timer);
    if (res.status === 401 || res.status === 403 || res.status === 404) {
      return 'The picture was uploaded, but its link cannot be opened (code ' + res.status + '). Please check the delivery settings of your Cloudinary account.';
    }
    return null;
  } catch {
    return null;
  }
}

export async function photosAllowed() {
  try {
    const { data } = await supabase.from('app_settings').select('allow_student_photos').limit(1).maybeSingle();
    return !data || data.allow_student_photos !== false;
  } catch {
    return true;
  }
}
