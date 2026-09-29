// Direct browser → Cloudinary uploads. The signature comes from the
// `cloudinary.signUpload` Convex action, so the API secret never reaches the
// browser. Convex then stores only the returned public ID.

export type SignedUpload = {
  cloudName: string;
  apiKey: string;
  publicId: string;
  timestamp: number;
  signature: string;
};

export type UploadedImage = { publicId: string; url: string };

export async function uploadToCloudinary(
  file: Blob,
  signed: SignedUpload
): Promise<UploadedImage> {
  const form = new FormData();
  form.append("file", file);
  form.append("api_key", signed.apiKey);
  form.append("timestamp", String(signed.timestamp));
  form.append("public_id", signed.publicId);
  form.append("signature", signed.signature);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${signed.cloudName}/image/upload`,
    { method: "POST", body: form }
  );
  if (!res.ok) throw new Error("Image upload failed. Please try again.");
  const data = (await res.json()) as { public_id: string };

  return {
    publicId: data.public_id,
    // Same delivery URL the backend stores (auto format + quality).
    url: `https://res.cloudinary.com/${signed.cloudName}/image/upload/f_auto,q_auto/${data.public_id}`,
  };
}
