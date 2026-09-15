"use client";

import { Camera, ImageUp, RefreshCw, TriangleAlert } from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";

/** Longest edge of the JPEG handed to Gemini. */
export const MAX_IMAGE_PX = 1024;

type CamState = "idle" | "starting" | "live" | "unavailable";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

/** `http://` on anything but localhost: browsers refuse `getUserMedia`. */
function insecureOrigin(): boolean {
  if (typeof window === "undefined") return false;
  const { protocol, hostname } = window.location;
  return protocol === "http:" && !LOCAL_HOSTS.has(hostname);
}

function drawToJpeg(
  source: CanvasImageSource,
  width: number,
  height: number,
): Promise<Blob | null> {
  const scale = Math.min(1, MAX_IMAGE_PX / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.resolve(null);
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) =>
    canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.85),
  );
}

/** Re-encode a picked file so a 12 MP phone photo does not go over the wire. */
async function fileToJpeg(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Could not read that image"));
      el.src = url;
    });
    const blob = await drawToJpeg(img, img.naturalWidth, img.naturalHeight);
    return blob ?? file;
  } catch {
    return file;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export interface CameraCaptureProps {
  /** Called with a JPEG blob (longest edge ≤ 1024 px). */
  onCapture: (blob: Blob) => void;
  /** Disables the capture controls while the caller is working. */
  busy?: boolean;
  /** Label of the primary capture button. */
  captureLabel?: string;
  /** Copy shown over the idle placeholder. */
  idleHint?: ReactNode;
  className?: string;
}

/**
 * Rear-camera preview with a capture button, degrading to a file picker when
 * the camera is blocked, missing or the page is served over plain http.
 */
export function CameraCapture({
  onCapture,
  busy,
  captureLabel = "Capture",
  idleHint = "Point the camera at the ingredient",
  className,
}: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<CamState>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  useEffect(() => stopStream, [stopStream]);
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  const showPreview = useCallback((blob: Blob) => {
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return URL.createObjectURL(blob);
    });
  }, []);

  async function start() {
    setMessage(null);
    if (insecureOrigin()) {
      setState("unavailable");
      setMessage(
        "The camera needs a secure connection (https or localhost). Upload a photo instead.",
      );
      return;
    }
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setState("unavailable");
      setMessage("This browser has no camera access. Upload a photo instead.");
      return;
    }

    setState("starting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      setState("live");
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play().catch(() => {});
      }
    } catch (e) {
      stopStream();
      setState("unavailable");
      setMessage(
        e instanceof DOMException && e.name === "NotAllowedError"
          ? "Camera permission was denied. Upload a photo instead."
          : "No camera available on this device. Upload a photo instead.",
      );
    }
  }

  async function capture() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const blob = await drawToJpeg(video, video.videoWidth, video.videoHeight);
    if (!blob) return;
    showPreview(blob);
    stopStream();
    setState("idle");
    onCapture(blob);
  }

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const blob = await fileToJpeg(file);
    showPreview(blob);
    onCapture(blob);
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="relative aspect-[4/3] w-full max-w-full overflow-hidden rounded-2xl border border-border bg-text/90">
        {/* Always mounted so `srcObject` has somewhere to go. */}
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className={cn(
            "h-full w-full object-cover",
            state === "live" ? "block" : "hidden",
          )}
        />

        {state !== "live" &&
          (preview ? (
            // eslint-disable-next-line @next/next/no-img-element -- object URL of the just-captured frame
            <img
              src={preview}
              alt="Captured photo"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 px-6 text-center">
              <Camera size={28} aria-hidden="true" className="text-primary-fg/70" />
              <p className="text-[13px] leading-relaxed text-primary-fg/80">
                {idleHint}
              </p>
            </div>
          ))}

        {state === "live" && (
          <span className="absolute top-2 left-2 inline-flex items-center gap-1.5 rounded-full bg-text/60 px-2 py-1 text-[11px] font-medium text-primary-fg">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-red-600" />
            Live
          </span>
        )}
      </div>

      {message && (
        <p className="flex items-start gap-2 rounded-xl bg-orange-50 px-3 py-2 text-[12px] leading-relaxed text-orange-600">
          <TriangleAlert size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
          {message}
        </p>
      )}

      <div className="flex gap-2">
        {state === "live" ? (
          <Button fullWidth onClick={capture} disabled={busy} leftIcon={<Camera size={16} />}>
            {captureLabel}
          </Button>
        ) : (
          <Button
            fullWidth
            onClick={start}
            disabled={busy}
            loading={state === "starting"}
            leftIcon={preview ? <RefreshCw size={16} /> : <Camera size={16} />}
          >
            {preview ? "Retake" : "Open camera"}
          </Button>
        )}
        <Button
          variant="secondary"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          aria-label="Upload a photo"
          leftIcon={<ImageUp size={16} />}
        >
          Upload
        </Button>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onFile}
      />
    </div>
  );
}
