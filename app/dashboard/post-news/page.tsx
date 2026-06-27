"use client";

import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import TiptapImage from "@tiptap/extension-image";
import TiptapLink from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import imageCompression from "browser-image-compression";
import DOMPurify from "dompurify";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";

// ─── Types ───────────────────────────────────────────────────────────────────

type NewsDoc = {
  _id: Id<"news">;
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  coverImageUrl?: string | null;
  coverImageId?: Id<"_storage">;
  category?: string;
  author?: string;
  featured?: boolean;
  publishedAt?: string;
};

const ALLOWED_CATEGORIES = ["news", "press-release", "announcement"] as const;
const MAX_TITLE = 200;
const MAX_AUTHOR = 100;
const MAX_IMAGE_KB = 300;

// ─── Sanitization helpers ─────────────────────────────────────────────────────

function sanitizeText(value: string, maxLen: number): string {
  return value
    .replace(/<[^>]*>/g, "")
    .replace(/&[a-z]+;/gi, " ")
    .trim()
    .slice(0, maxLen);
}

function sanitizeBody(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      "p", "br", "strong", "em", "u", "s", "h1", "h2", "h3", "h4",
      "ul", "ol", "li", "blockquote", "a", "img", "figure", "figcaption",
      "code", "pre", "hr", "div", "span",
    ],
    ALLOWED_ATTR: ["href", "src", "alt", "title", "target", "rel", "class", "style"],
    ALLOW_DATA_ATTR: false,
  });
}

// ─── Toolbar ──────────────────────────────────────────────────────────────────

type TiptapEditor = ReturnType<typeof useEditor>;

function ToolbarButton({
  onClick,
  active,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      title={title}
      disabled={disabled}
      className={`px-2 py-1 text-sm rounded transition-colors disabled:opacity-40 ${
        active
          ? "bg-nfvcb-green text-white"
          : "hover:bg-muted text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function EditorToolbar({ editor }: { editor: TiptapEditor }) {
  const inlineImageRef = useRef<HTMLInputElement>(null);
  const [insertingImage, setInsertingImage] = useState(false);

  if (!editor) return null;

  function insertLink() {
    const url = window.prompt("Enter URL:");
    if (!url) return;
    try {
      new URL(url);
    } catch {
      return;
    }
    editor
      .chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href: url, target: "_blank", rel: "noopener noreferrer" })
      .run();
  }

  async function handleInlineImageChange(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return;

    setInsertingImage(true);
    try {
      const compressed = await imageCompression(file, {
        maxSizeMB: MAX_IMAGE_KB / 1024,
        maxWidthOrHeight: 1600,
        useWebWorker: true,
        fileType: "image/webp",
      });

      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(compressed);
      });

      editor.chain().focus().setImage({ src: dataUrl }).run();
    } finally {
      setInsertingImage(false);
      if (inlineImageRef.current) inlineImageRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-wrap gap-0.5 border-b px-2 py-1.5 bg-muted/30 rounded-t-md">
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        active={editor.isActive("bold")}
        title="Bold"
      >
        <strong>B</strong>
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        active={editor.isActive("italic")}
        title="Italic"
      >
        <em>I</em>
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        active={editor.isActive("underline")}
        title="Underline"
      >
        <u>U</u>
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleStrike().run()}
        active={editor.isActive("strike")}
        title="Strikethrough"
      >
        <s>S</s>
      </ToolbarButton>
      <span className="w-px bg-border mx-1 self-stretch" />
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        active={editor.isActive("heading", { level: 2 })}
        title="Heading 2"
      >
        H2
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        active={editor.isActive("heading", { level: 3 })}
        title="Heading 3"
      >
        H3
      </ToolbarButton>
      <span className="w-px bg-border mx-1 self-stretch" />
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        active={editor.isActive("bulletList")}
        title="Bullet list"
      >
        • List
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        active={editor.isActive("orderedList")}
        title="Numbered list"
      >
        1. List
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        active={editor.isActive("blockquote")}
        title="Blockquote"
      >
        ❝
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        active={editor.isActive("codeBlock")}
        title="Code block"
      >
        {"</>"}
      </ToolbarButton>
      <span className="w-px bg-border mx-1 self-stretch" />
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign("left").run()}
        active={editor.isActive({ textAlign: "left" })}
        title="Align left"
      >
        ←
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign("center").run()}
        active={editor.isActive({ textAlign: "center" })}
        title="Align center"
      >
        ↔
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign("right").run()}
        active={editor.isActive({ textAlign: "right" })}
        title="Align right"
      >
        →
      </ToolbarButton>
      <span className="w-px bg-border mx-1 self-stretch" />
      <ToolbarButton onClick={insertLink} title="Insert link">
        🔗
      </ToolbarButton>

      <input
        ref={inlineImageRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleInlineImageChange}
      />
      <ToolbarButton
        onClick={() => inlineImageRef.current?.click()}
        disabled={insertingImage}
        title={insertingImage ? "Inserting image…" : "Insert image from device"}
      >
        {insertingImage ? "⏳" : "🖼"}
      </ToolbarButton>

      <span className="w-px bg-border mx-1 self-stretch" />
      <ToolbarButton
        onClick={() => editor.chain().focus().undo().run()}
        title="Undo"
      >
        ↩
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().redo().run()}
        title="Redo"
      >
        ↪
      </ToolbarButton>
    </div>
  );
}

// ─── Empty form state ─────────────────────────────────────────────────────────

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

const EMPTY_FORM = {
  title: "",
  category: "news" as string,
  author: "",
  featured: false,
  publishedAt: todayIso(),
};

// ─── Main page ────────────────────────────────────────────────────────────────

export default function PostNewsPage() {
  const items = useQuery(api.news.list) as NewsDoc[] | undefined;
  const createNews = useMutation(api.news.create);
  const updateNews = useMutation(api.news.update);
  const removeNews = useMutation(api.news.remove);
  const generateUploadUrl = useMutation(api.news.generateUploadUrl);

  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<Id<"news"> | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<Id<"news"> | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageCompressing, setImageCompressing] = useState(false);
  const [existingImageId, setExistingImageId] = useState<Id<"_storage"> | null>(null);
  const [clearExistingImage, setClearExistingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      TiptapImage.configure({ inline: false, allowBase64: true }),
      TiptapLink.configure({ openOnClick: false }),
      Placeholder.configure({ placeholder: "Write the article body here…" }),
    ],
    content: "",
    editorProps: {
      attributes: {
        class:
          "prose prose-sm dark:prose-invert max-w-none min-h-[280px] px-4 py-3 focus:outline-none",
      },
    },
  });

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
          maxWidthOrHeight: 1600,
          useWebWorker: true,
          fileType: "image/webp",
        });

        setImageFile(compressed);
        setImagePreview(URL.createObjectURL(compressed));
        setClearExistingImage(true);
      } catch {
        setError("Image compression failed. Please try a different image.");
      } finally {
        setImageCompressing(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    []
  );

  function removeImage() {
    setImageFile(null);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
    setClearExistingImage(true);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function startCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    editor?.commands.clearContent();
    setImageFile(null);
    setImagePreview(null);
    setExistingImageId(null);
    setClearExistingImage(false);
    setError(null);
    setSuccess(null);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function startEdit(item: NewsDoc) {
    setEditingId(item._id);
    setForm({
      title: item.title,
      category: item.category ?? "news",
      author: item.author ?? "",
      featured: item.featured ?? false,
      publishedAt: item.publishedAt ?? todayIso(),
    });
    editor?.commands.setContent(item.body ?? "");
    setImageFile(null);
    setImagePreview(item.coverImageUrl ?? null);
    setExistingImageId(item.coverImageId ?? null);
    setClearExistingImage(false);
    setError(null);
    setSuccess(null);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    editor?.commands.clearContent();
    if (imagePreview && imageFile) URL.revokeObjectURL(imagePreview);
    setImageFile(null);
    setImagePreview(null);
    setExistingImageId(null);
    setClearExistingImage(false);
    setError(null);
    setSuccess(null);
    setShowForm(false);
  }

  function validateClient(): string | null {
    const title = sanitizeText(form.title, MAX_TITLE);
    if (!title) return "Title is required.";

    const body = editor?.getHTML() ?? "";
    const bodyText = body.replace(/<[^>]*>/g, "").trim();
    if (!bodyText) return "Body content is required.";

    if (form.author && sanitizeText(form.author, MAX_AUTHOR).length === 0)
      return "Author name is invalid.";

    if (!ALLOWED_CATEGORIES.includes(form.category as (typeof ALLOWED_CATEGORIES)[number]))
      return "Invalid category selected.";

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
      const title = sanitizeText(form.title, MAX_TITLE);
      const author = sanitizeText(form.author, MAX_AUTHOR);
      const rawBody = editor?.getHTML() ?? "";
      const body = sanitizeBody(rawBody);

      let coverImageId: Id<"_storage"> | undefined;
      if (imageFile) {
        const uploadUrl = await generateUploadUrl();
        const res = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": imageFile.type },
          body: imageFile,
        });
        if (!res.ok) throw new Error("Image upload failed. Please try again.");
        const { storageId } = await res.json();
        coverImageId = storageId as Id<"_storage">;
      }

      const payload = {
        title,
        body,
        category: form.category || undefined,
        author: author || undefined,
        featured: form.featured || undefined,
        publishedAt: form.publishedAt || undefined,
        ...(coverImageId ? { coverImageId } : {}),
        ...(clearExistingImage && !coverImageId ? { clearCoverImage: true as const } : {}),
      };

      if (editingId) {
        await updateNews({ id: editingId, ...payload });
        setSuccess("Article updated successfully.");
      } else {
        await createNews(payload);
        setSuccess("Article created successfully.");
      }

      setEditingId(null);
      setForm(EMPTY_FORM);
      editor?.commands.clearContent();
      if (imagePreview && imageFile) URL.revokeObjectURL(imagePreview);
      setImageFile(null);
      setImagePreview(null);
      setExistingImageId(null);
      setClearExistingImage(false);
      setShowForm(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: Id<"news">) {
    if (!window.confirm("Delete this article? This cannot be undone.")) return;
    setDeletingId(id);
    setError(null);
    setSuccess(null);
    try {
      await removeNews({ id });
      setSuccess("Article deleted.");
      if (editingId === id) cancelForm();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Delete failed.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className='max-w-4xl mx-auto px-4 py-12 space-y-8'>
      <div className='flex items-center justify-between gap-4'>
        <div className='flex items-center gap-3'>
          <Link href='/dashboard'>
            <Button variant='ghost' size='icon' className='h-8 w-8'>
              <ArrowLeft className='h-4 w-4' />
            </Button>
          </Link>
          <div>
            <h1 className='text-2xl font-bold'>News Management</h1>
            <p className='text-muted-foreground text-sm mt-0.5'>
              Create, edit, and delete news articles.
            </p>
          </div>
        </div>
        {!showForm && (
          <Button
            onClick={startCreate}
            className='bg-nfvcb-green hover:bg-nfvcb-green/90 shrink-0'>
            <Plus className='h-4 w-4 mr-1.5' /> New Article
          </Button>
        )}
      </div>

      {success && !showForm && (
        <p className='text-sm text-nfvcb-green bg-nfvcb-green/10 px-3 py-2 rounded-md flex items-center gap-1.5'>
          <Check className='h-4 w-4' /> {success}
        </p>
      )}

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className='text-base'>
              {editingId ? "Edit Article" : "New Article"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className='space-y-5' noValidate>
              <div className='grid sm:grid-cols-2 gap-4'>
                <div className='space-y-1'>
                  <label className='text-sm font-medium'>
                    Title <span className='text-destructive'>*</span>
                  </label>
                  <Input
                    value={form.title}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        title: e.target.value.slice(0, MAX_TITLE),
                      }))
                    }
                    placeholder='Article title'
                    maxLength={MAX_TITLE}
                  />
                  <p className='text-[11px] text-muted-foreground text-right'>
                    {form.title.length}/{MAX_TITLE}
                  </p>
                </div>
                <div className='space-y-1'>
                  <label className='text-sm font-medium'>Author</label>
                  <Input
                    value={form.author}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        author: e.target.value.slice(0, MAX_AUTHOR),
                      }))
                    }
                    placeholder='Author name'
                    maxLength={MAX_AUTHOR}
                  />
                </div>
              </div>

              <div className='grid sm:grid-cols-3 gap-4'>
                <div className='space-y-1'>
                  <label className='text-sm font-medium'>Category</label>
                  <Select
                    value={form.category}
                    onValueChange={(v) =>
                      setForm((f) => ({ ...f, category: v }))
                    }>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='news'>News</SelectItem>
                      <SelectItem value='press-release'>
                        Press Release
                      </SelectItem>
                      <SelectItem value='announcement'>Announcement</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className='flex flex-col'>
                  <label className='text-sm font-medium'>Published Date</label>
                  <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                    <PopoverTrigger>
                      <button
                        type='button'
                        className='inline-flex items-center gap-2 h-8 px-2.5 rounded-lg border border-border bg-background text-sm font-normal hover:bg-muted transition-colors w-full  text-left'>
                        <CalendarIcon className='h-4 w-4 text-muted-foreground shrink-0' />
                        {form.publishedAt
                          ? format(
                              new Date(form.publishedAt + "T00:00:00"),
                              "PPP",
                            )
                          : "Pick a date"}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className='w-auto p-0' align='start'>
                      <Calendar
                        mode='single'
                        selected={
                          form.publishedAt
                            ? new Date(form.publishedAt + "T00:00:00")
                            : undefined
                        }
                        onSelect={(date) => {
                          setForm((f) => ({
                            ...f,
                            publishedAt: date
                              ? format(date, "yyyy-MM-dd")
                              : todayIso(),
                          }));
                          setCalendarOpen(false);
                        }}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className='flex items-end pb-1'>
                  <label className='flex items-center gap-2 cursor-pointer select-none'>
                    <input
                      type='checkbox'
                      className='h-4 w-4 accent-nfvcb-green'
                      checked={form.featured}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, featured: e.target.checked }))
                      }
                    />
                    <span className='text-sm font-medium'>
                      Featured article
                    </span>
                  </label>
                </div>
              </div>

              <div className='space-y-2'>
                <label className='text-sm font-medium'>Cover Image</label>
                <p className='text-xs text-muted-foreground'>
                  Automatically compressed to ≤{MAX_IMAGE_KB} KB and converted
                  to WebP.
                </p>

                {(imagePreview || existingImageId) && !clearExistingImage && (
                  <div className='relative w-full max-h-52 overflow-hidden rounded-md border bg-muted'>
                    <Image
                      src={imagePreview ?? ""}
                      alt='Cover preview'
                      fill
                      unoptimized
                      className='object-cover'
                    />
                    <button
                      type='button'
                      onClick={removeImage}
                      className='absolute top-2 right-2 bg-background/80 rounded-full p-0.5 hover:bg-destructive hover:text-white transition-colors'
                      title='Remove image'>
                      <XCircle className='h-5 w-5' />
                    </button>
                  </div>
                )}

                <div className='flex items-center gap-2'>
                  <input
                    ref={fileInputRef}
                    type='file'
                    accept='image/*'
                    className='hidden'
                    onChange={handleImageChange}
                    id='cover-image-input'
                  />
                  <Button
                    type='button'
                    variant='outline'
                    size='sm'
                    disabled={imageCompressing}
                    onClick={() => fileInputRef.current?.click()}>
                    {imageCompressing ? (
                      <>
                        <Loader2 className='h-4 w-4 mr-1.5 animate-spin' />
                        Compressing…
                      </>
                    ) : (
                      <>
                        <ImagePlus className='h-4 w-4 mr-1.5' />
                        {imagePreview ? "Change Image" : "Select Image"}
                      </>
                    )}
                  </Button>
                  {imageFile && (
                    <span className='text-xs text-muted-foreground'>
                      {imageFile.name} ({(imageFile.size / 1024).toFixed(1)} KB)
                    </span>
                  )}
                </div>
              </div>

              <div className='space-y-1'>
                <label className='text-sm font-medium'>
                  Body <span className='text-destructive'>*</span>
                </label>
                <div className='border rounded-md overflow-hidden focus-within:ring-1 focus-within:ring-ring'>
                  <EditorToolbar editor={editor} />
                  <EditorContent editor={editor} />
                </div>
                <p className='text-xs text-muted-foreground'>
                  Supports bold, italic, headings, lists, links, and more via
                  the toolbar.
                </p>
              </div>

              {error && (
                <p className='text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md'>
                  {error}
                </p>
              )}
              {success && (
                <p className='text-sm text-nfvcb-green bg-nfvcb-green/10 px-3 py-2 rounded-md flex items-center gap-1.5'>
                  <Check className='h-4 w-4' /> {success}
                </p>
              )}

              <div className='flex gap-2 pt-1'>
                <Button
                  type='submit'
                  disabled={loading || imageCompressing}
                  className='bg-nfvcb-green hover:bg-nfvcb-green/90'>
                  {loading ? (
                    <Loader2 className='h-4 w-4 animate-spin' />
                  ) : editingId ? (
                    "Save Changes"
                  ) : (
                    <>
                      <Plus className='h-4 w-4 mr-1' /> Create Article
                    </>
                  )}
                </Button>
                <Button type='button' variant='outline' onClick={cancelForm}>
                  <X className='h-4 w-4 mr-1' /> Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className='space-y-3'>
        <h2 className='font-semibold text-sm uppercase tracking-wider text-muted-foreground'>
          All Articles ({items?.length ?? "…"})
        </h2>

        {items === undefined && (
          <div className='py-10 flex justify-center'>
            <Loader2 className='h-6 w-6 animate-spin text-muted-foreground' />
          </div>
        )}

        {items?.map((item) => (
          <Card
            key={item._id}
            className={editingId === item._id ? "border-nfvcb-green" : ""}>
            <CardContent className='flex items-start gap-4 py-4'>
              {item.coverImageUrl && (
                <Image
                  src={item.coverImageUrl}
                  alt=''
                  width={56}
                  height={56}
                  unoptimized
                  className='w-14 h-14 rounded object-cover shrink-0 border'
                />
              )}
              <div className='flex-1 min-w-0'>
                <div className='flex items-center gap-2 flex-wrap'>
                  <span className='font-medium text-sm line-clamp-1'>
                    {item.title}
                  </span>
                  {item.featured && (
                    <Badge className='text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/20'>
                      Featured
                    </Badge>
                  )}
                  {item.category && (
                    <Badge variant='outline' className='text-[10px]'>
                      {item.category}
                    </Badge>
                  )}
                </div>
                <p className='text-xs text-muted-foreground mt-0.5 line-clamp-1'>
                  {item.excerpt}
                </p>
                <p className='text-[11px] text-muted-foreground mt-0.5'>
                  {item.author && <>by {item.author} · </>}
                  {item.publishedAt
                    ? format(new Date(item.publishedAt + "T00:00:00"), "PPP")
                    : "No publish date"}
                </p>
              </div>
              <div className='flex gap-1 shrink-0'>
                <Button
                  size='icon'
                  variant='ghost'
                  className='h-8 w-8'
                  onClick={() => startEdit(item)}
                  title='Edit article'>
                  <Pencil className='h-4 w-4' />
                </Button>
                <Button
                  size='icon'
                  variant='ghost'
                  className='h-8 w-8 text-destructive hover:text-destructive'
                  onClick={() => handleDelete(item._id)}
                  disabled={deletingId === item._id}
                  title='Delete article'>
                  {deletingId === item._id ? (
                    <Loader2 className='h-4 w-4 animate-spin' />
                  ) : (
                    <Trash2 className='h-4 w-4' />
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}

        {items?.length === 0 && (
          <p className='text-sm text-muted-foreground text-center py-10'>
            No articles yet. Click &quot;New Article&quot; to create one.
          </p>
        )}
      </div>
    </div>
  );
}
