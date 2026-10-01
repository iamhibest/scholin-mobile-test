import { launchImageLibrary } from 'react-native-image-picker';
import { supabase } from './supabase';

const CLOUD_NAME = 'lletfxjm';
const UPLOAD_PRESET = 'Scholin Images';

export type PickResult = { uri: string; url: string } | null;

export async function pickAndUploadImage(schoolId: string | null): Promise<PickResult> {
  const picked = await launchImageLibrary({
    mediaType: 'photo',
    selectionLimit: 1,
    maxWidth: 1000,
    maxHeight: 1000,
    quality: 0.75,
    includeBase64: false,
  });
  if (picked.didCancel) {
    return null;
  }
  if (picked.errorCode) {
    throw new Error(picked.errorMessage || 'Could not open your photos.');
  }
  const asset = picked.assets && picked.assets[0];
  if (!asset || !asset.uri) {
    return null;
  }
  if (asset.fileSize && asset.fileSize > 8 * 1024 * 1024) {
    throw new Error('Image is too large (max 8MB).');
  }

  const form = new FormData();
  form.append('file', { uri: asset.uri, type: asset.type || 'image/jpeg', name: asset.fileName || 'photo.jpg' } as any);
  form.append('upload_preset', UPLOAD_PRESET);

  let data: any;
  try {
    const response = await fetch('https://api.cloudinary.com/v1_1/' + CLOUD_NAME + '/image/upload', { method: 'POST', body: form });
    data = await response.json();
  } catch {
    throw new Error('Upload failed. Check your connection and try again.');
  }
  if (!data || !data.secure_url) {
    throw new Error('Upload failed. Please try again.');
  }

  try {
    const { data: auth } = await supabase.auth.getUser();
    await supabase.from('cloudinary_assets').insert({
      school_id: schoolId,
      public_id: data.public_id,
      url: data.secure_url,
      uploaded_by: auth.user ? auth.user.id : null,
    });
  } catch {}

  return { uri: asset.uri, url: data.secure_url as string };
}

export async function photosAllowed() {
  try {
    const { data } = await supabase.from('app_settings').select('allow_student_photos').limit(1).maybeSingle();
    return !data || data.allow_student_photos !== false;
  } catch {
    return true;
  }
}
