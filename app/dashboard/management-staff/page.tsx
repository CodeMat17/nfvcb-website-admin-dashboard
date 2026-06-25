"use client";

import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Pencil,
  Trash2,
  Plus,
  X,
  Check,
  Loader2,
  ArrowLeft,
  ImagePlus,
  XCircle,
  Users,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import imageCompression from "browser-image-compression";

const MAX_NAME = 150;
const MAX_DESIGNATION = 200;
const MAX_IMAGE_KB = 30;

type StaffDoc = {
  _id: Id<"managementStaff">;
  name: string;
  designation: string;
  imageId?: Id<"_storage">;
  imageUrl: string | null;
  order: number;
};

function sanitizeText(value: string, maxLen: number): string {
  return value
    .replace(/<[^>]*>/g, "")
    .replace(/&[a-z]+;/gi, " ")
    .trim()
    .slice(0, maxLen);
}

const EMPTY_FORM = { name: "", designation: "" };

export default function ManagementStaffPage() {
  const staff = useQuery(api.managementStaff.list) as StaffDoc[] | undefined;
  const createStaff = useMutation(api.managementStaff.create);
  const updateStaff = useMutation(api.managementStaff.update);
  const removeStaff = useMutation(api.managementStaff.remove);
  const generateUploadUrl = useMutation(api.managementStaff.generateUploadUrl);

  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<Id<"managementStaff"> | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<Id<"managementStaff"> | null>(null);

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageCompressing, setImageCompressing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        setError("Please select an image file.");
        return;
      }

      setError(null);
      setImageCompressing(true);

      try {
        const compressed = await imageCompression(file, {
          maxSizeMB: MAX_IMAGE_KB / 1024,
          maxWidthOrHeight: 400,
          useWebWorker: true,
          fileType: "image/webp",
        });

        if (imagePreview && imageFile) URL.revokeObjectURL(imagePreview);
        setImageFile(compressed);
        setImagePreview(URL.createObjectURL(compressed));
      } catch {
        setError("Image compression failed. Please try a different image.");
      } finally {
        setImageCompressing(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [imagePreview, imageFile]
  );

  function removeImage() {
    if (imagePreview && imageFile) URL.revokeObjectURL(imagePreview);
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function startCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setImageFile(null);
    setImagePreview(null);
    setError(null);
    setSuccess(null);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function startEdit(item: StaffDoc) {
    setEditingId(item._id);
    setForm({ name: item.name, designation: item.designation });
    setImageFile(null);
    setImagePreview(item.imageUrl ?? null);
    setError(null);
    setSuccess(null);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    if (imagePreview && imageFile) URL.revokeObjectURL(imagePreview);
    setImageFile(null);
    setImagePreview(null);
    setError(null);
    setSuccess(null);
    setShowForm(false);
  }

  function validateClient(): string | null {
    if (!sanitizeText(form.name, MAX_NAME)) return "Name is required.";
    if (!sanitizeText(form.designation, MAX_DESIGNATION))
      return "Designation is required.";
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const clientError = validateClient();
    if (clientError) {
      setError(clientError);
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const name = sanitizeText(form.name, MAX_NAME);
      const designation = sanitizeText(form.designation, MAX_DESIGNATION);

      if (editingId) {
        type UpdatePayload = {
          id: Id<"managementStaff">;
          name: string;
          designation: string;
          imageId?: Id<"_storage">;
        };
        const payload: UpdatePayload = { id: editingId, name, designation };

        if (imageFile) {
          const uploadUrl = await generateUploadUrl();
          const res = await fetch(uploadUrl, {
            method: "POST",
            headers: { "Content-Type": imageFile.type },
            body: imageFile,
          });
          if (!res.ok) throw new Error("Image upload failed. Please try again.");
          const { storageId } = await res.json();
          payload.imageId = storageId as Id<"_storage">;
        }

        await updateStaff(payload);
        setSuccess("Staff member updated.");
      } else {
        let storageId: Id<"_storage"> | undefined;
        if (imageFile) {
          const uploadUrl = await generateUploadUrl();
          const res = await fetch(uploadUrl, {
            method: "POST",
            headers: { "Content-Type": imageFile.type },
            body: imageFile,
          });
          if (!res.ok) throw new Error("Image upload failed. Please try again.");
          const data = await res.json();
          storageId = data.storageId as Id<"_storage">;
        }

        await createStaff({
          name,
          designation,
          imageId: storageId,
          order: Date.now(),
        });
        setSuccess("Staff member added.");
      }

      setEditingId(null);
      setForm(EMPTY_FORM);
      if (imagePreview && imageFile) URL.revokeObjectURL(imagePreview);
      setImageFile(null);
      setImagePreview(null);
      setShowForm(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: Id<"managementStaff">) {
    if (!window.confirm("Remove this staff member? This cannot be undone.")) return;
    setDeletingId(id);
    setError(null);
    setSuccess(null);
    try {
      await removeStaff({ id });
      setSuccess("Staff member removed.");
      if (editingId === id) cancelForm();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Delete failed.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-12 space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/dashboard">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Management Staff</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Add, edit, and remove management staff profiles.
            </p>
          </div>
        </div>
        {!showForm && (
          <Button
            onClick={startCreate}
            className="bg-nfvcb-green hover:bg-nfvcb-green/90 shrink-0"
          >
            <Plus className="h-4 w-4 mr-1.5" /> Add Staff
          </Button>
        )}
      </div>

      {success && !showForm && (
        <p className="text-sm text-nfvcb-green bg-nfvcb-green/10 px-3 py-2 rounded-md flex items-center gap-1.5">
          <Check className="h-4 w-4" /> {success}
        </p>
      )}

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {editingId ? "Edit Staff Member" : "Add Staff Member"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium">
                    Name <span className="text-destructive">*</span>
                  </label>
                  <Input
                    value={form.name}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        name: e.target.value.slice(0, MAX_NAME),
                      }))
                    }
                    placeholder="Full name"
                    maxLength={MAX_NAME}
                  />
                  <p className="text-[11px] text-muted-foreground text-right">
                    {form.name.length}/{MAX_NAME}
                  </p>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">
                    Designation <span className="text-destructive">*</span>
                  </label>
                  <Input
                    value={form.designation}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        designation: e.target.value.slice(0, MAX_DESIGNATION),
                      }))
                    }
                    placeholder="e.g. Executive Director"
                    maxLength={MAX_DESIGNATION}
                  />
                  <p className="text-[11px] text-muted-foreground text-right">
                    {form.designation.length}/{MAX_DESIGNATION}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Photo <span className="text-muted-foreground font-normal">(optional)</span>
                </label>
                <p className="text-xs text-muted-foreground">
                  Compressed to ≤{MAX_IMAGE_KB} KB and converted to WebP. Max display size 400 px.
                </p>

                {imagePreview && (
                  <div className="relative w-32 h-32 rounded-lg overflow-hidden border bg-muted">
                    <Image
                      src={imagePreview}
                      alt="Photo preview"
                      fill
                      unoptimized
                      className="object-cover"
                    />
                    {imageFile && (
                      <button
                        type="button"
                        onClick={removeImage}
                        className="absolute top-1 right-1 bg-background/80 rounded-full p-0.5 hover:bg-destructive hover:text-white transition-colors"
                        title="Remove photo"
                      >
                        <XCircle className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageChange}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={imageCompressing}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {imageCompressing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                        Compressing…
                      </>
                    ) : (
                      <>
                        <ImagePlus className="h-4 w-4 mr-1.5" />
                        {imagePreview ? "Change Photo" : "Select Photo"}
                      </>
                    )}
                  </Button>
                  {imageFile && (
                    <span className="text-xs text-muted-foreground">
                      {imageFile.name} ({(imageFile.size / 1024).toFixed(1)} KB)
                    </span>
                  )}
                </div>
              </div>

              {error && (
                <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
                  {error}
                </p>
              )}
              {success && (
                <p className="text-sm text-nfvcb-green bg-nfvcb-green/10 px-3 py-2 rounded-md flex items-center gap-1.5">
                  <Check className="h-4 w-4" /> {success}
                </p>
              )}

              <div className="flex gap-2 pt-1">
                <Button
                  type="submit"
                  disabled={loading || imageCompressing}
                  className="bg-nfvcb-green hover:bg-nfvcb-green/90"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : editingId ? (
                    "Save Changes"
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-1" /> Add Staff Member
                    </>
                  )}
                </Button>
                <Button type="button" variant="outline" onClick={cancelForm}>
                  <X className="h-4 w-4 mr-1" /> Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        <h2 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">
          All Staff ({staff?.length ?? "…"})
        </h2>

        {staff === undefined && (
          <div className="py-10 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {staff?.map((item) => (
          <Card
            key={item._id}
            className={editingId === item._id ? "border-nfvcb-green" : ""}
          >
            <CardContent className="flex items-center gap-4 py-4">
              {item.imageUrl ? (
                <Image
                  src={item.imageUrl}
                  alt={item.name}
                  width={56}
                  height={56}
                  unoptimized
                  className="w-14 h-14 rounded-lg object-cover shrink-0 border"
                />
              ) : (
                <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center shrink-0 border">
                  <Users className="h-6 w-6 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{item.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {item.designation}
                </p>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={() => startEdit(item)}
                  title="Edit staff member"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => handleDelete(item._id)}
                  disabled={deletingId === item._id}
                  title="Remove staff member"
                >
                  {deletingId === item._id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}

        {staff?.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-10">
            No staff members yet. Click &quot;Add Staff&quot; to add one.
          </p>
        )}
      </div>
    </div>
  );
}
