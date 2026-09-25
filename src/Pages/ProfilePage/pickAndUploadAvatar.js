import * as ImagePicker from "expo-image-picker";

import { t } from "@localization";
import { socialService } from "@services";

/**
 * Opens the photo library on a square crop and uploads the pick as the
 * profile photo. Profile and Edit profile both start it straight from the
 * avatar.
 *
 * Resolves with the updated profile, or null when the user backed out of the
 * library. Anything else that goes wrong is thrown, with a message the screen
 * can show as it is.
 */
export default async function pickAndUploadAvatar({ user }) {
  const permissionResponse =
    await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (!permissionResponse.granted) {
    throw new Error(t("profile.feedback.photoPermissionRequired"));
  }

  const pickerResult = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.7,
  });

  if (pickerResult.canceled) {
    return null;
  }

  const selectedAsset = pickerResult.assets?.[0];

  if (!selectedAsset) {
    throw new Error(t("profile.feedback.noImageSelected"));
  }

  return socialService.uploadOwnAvatar({ user, asset: selectedAsset });
}
