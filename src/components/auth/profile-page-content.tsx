"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { GoogleLoginCard } from "@/components/auth/google-login-card";
import { useAuth } from "@/components/auth/auth-provider";

const MAX_AVATAR_SIZE = 5 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"];
type ProfilePageContentProps = {
  initialSetup: boolean;
  initialError: string;
};

export function ProfilePageContent({ initialSetup, initialError }: ProfilePageContentProps) {
  const router = useRouter();
  const {
    configured,
    authStatus,
    userId,
    profile,
    profileLoading,
    profileError,
    avatarSrc,
    refreshProfile,
    signOut,
  } = useAuth();
  const [editing, setEditing] = useState(initialSetup);
  const [signOutError, setSignOutError] = useState("");

  if (authStatus === "loading") {
    return <p className="account-status" role="status">Checking your secure sign-in…</p>;
  }
  if (!configured || authStatus === "unconfigured" || authStatus === "signed-out") {
    return <GoogleLoginCard errorCode={initialError} nextPath="/profile" />;
  }
  if (profileLoading) {
    return <p className="account-status" role="status">Loading your artist profile…</p>;
  }
  if (profileError) {
    return (
      <section className="account-card">
        <p className="account-error" role="alert">{profileError}</p>
        <button className="button button-play" onClick={() => void refreshProfile()} type="button">
          TRY AGAIN
        </button>
      </section>
    );
  }
  if (!profile || editing) {
    return (
      <ProfileForm
        key={profile?.updated_at ?? "new-profile"}
        onCancel={profile ? () => setEditing(false) : undefined}
        onSaved={async (wasCreated) => {
          await refreshProfile();
          if (wasCreated) {
            router.replace("/");
            router.refresh();
          } else {
            setEditing(false);
          }
        }}
        profile={profile}
        userId={userId}
      />
    );
  }

  async function logout() {
    setSignOutError("");
    try {
      await signOut();
      router.replace("/");
      router.refresh();
    } catch (error: unknown) {
      setSignOutError(error instanceof Error ? error.message : "Logout could not be completed.");
    }
  }

  return (
    <section aria-labelledby="profile-heading" className="account-card profile-card">
      <div className="profile-summary">
        {avatarSrc
          ? <img alt={`${profile.artist_name}'s profile`} className="profile-avatar" src={avatarSrc} />
          : <div aria-hidden="true" className="profile-avatar profile-avatar-fallback">🎤</div>}
        <div className="profile-summary-copy">
          <p className="eyebrow">RECORDING ARTIST</p>
          <h1 id="profile-heading">{profile.artist_name}</h1>
        </div>
      </div>
      <div className="account-status-card">
        <span className="account-status-indicator" aria-hidden="true">●</span>
        <div>
          <strong>Google account connected</strong>
          <p>Your Google email is private and never shown on your profile.</p>
        </div>
      </div>
      {signOutError && <p className="account-error" role="alert">{signOutError}</p>}
      <div className="profile-actions">
        <button className="button button-secondary" onClick={() => setEditing(true)} type="button">
          EDIT PROFILE
        </button>
        <button className="button button-secondary" onClick={() => void logout()} type="button">
          LOG OUT
        </button>
      </div>
    </section>
  );
}

type ProfileFormProps = {
  profile: ReturnType<typeof useAuth>["profile"];
  userId: string | null;
  onCancel?: () => void;
  onSaved: (wasCreated: boolean) => Promise<void>;
};

function ProfileForm({ profile, userId, onCancel, onSaved }: ProfileFormProps) {
  const { supabase, avatarSrc } = useAuth();
  const [artistName, setArtistName] = useState(profile?.artist_name ?? "");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const previewUrlRef = useRef("");
  const [errorMessage, setErrorMessage] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
  }, []);

  function selectAvatar(file: File | null) {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = file ? URL.createObjectURL(file) : "";
    setPreviewUrl(previewUrlRef.current);
    setAvatarFile(file);
  }

  async function chooseAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0] ?? null;
    event.currentTarget.value = "";
    setErrorMessage("");
    if (!file) {
      selectAvatar(null);
      return;
    }
    if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
      selectAvatar(null);
      setErrorMessage("Choose a JPEG, PNG, or WebP image.");
      return;
    }
    if (file.size > MAX_AVATAR_SIZE) {
      selectAvatar(null);
      setErrorMessage("That image is too large. Choose an image no bigger than 5 MB.");
      return;
    }
    let bytes: Uint8Array;
    try {
      bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    } catch {
      selectAvatar(null);
      setErrorMessage("The selected image could not be read. Choose another image and try again.");
      return;
    }
    const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    const isPng = bytes.slice(0, 8).join(",") === "137,80,78,71,13,10,26,10";
    const isWebp = String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
      String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
    const signatureMatchesType =
      (file.type === "image/jpeg" && isJpeg) ||
      (file.type === "image/png" && isPng) ||
      (file.type === "image/webp" && isWebp);
    if (!signatureMatchesType) {
      selectAvatar(null);
      setErrorMessage("That file is not a valid JPEG, PNG, or WebP image.");
      return;
    }
    selectAvatar(file);
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const name = artistName.trim();
    if (name.length < 2 || name.length > 40) {
      setErrorMessage("Your Recording Artist Name must be between 2 and 40 characters.");
      return;
    }
    if (!supabase || !userId) {
      setErrorMessage("Your sign-in session expired. Sign in with Google and try again.");
      return;
    }

    setSaving(true);
    setErrorMessage("");
    setNotice("");
    let avatarPath = profile?.avatar_url ?? null;
    let uploadedAvatarPath: string | null = null;

    try {
      if (avatarFile) {
        const extension = avatarFile.type === "image/jpeg"
          ? "jpg"
          : avatarFile.type === "image/png" ? "png" : "webp";
        uploadedAvatarPath = `${userId}/${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(uploadedAvatarPath, avatarFile, {
            contentType: avatarFile.type,
            upsert: false,
          });
        if (uploadError) {
          const message = uploadError.message.toLowerCase().includes("size")
            ? "That image is too large. Choose an image no bigger than 5 MB."
            : "The profile picture could not be uploaded. Check your connection and try again.";
          throw new Error(message);
        }
        avatarPath = uploadedAvatarPath;
      }

      const mutation = profile
        ? supabase.from("profiles").update({
            artist_name: name,
            avatar_url: avatarPath,
          }).eq("auth_user_id", userId)
        : supabase.from("profiles").insert({
            auth_user_id: userId,
            artist_name: name,
            avatar_url: avatarPath,
          });
      const { error: saveError } = await mutation;
      if (saveError) {
        throw new Error("Your Recording Artist Profile could not be saved. Check your connection and try again.");
      }

      if (uploadedAvatarPath && profile?.avatar_url) {
        const { error: removeError } = await supabase.storage
          .from("avatars")
          .remove([profile.avatar_url]);
        if (removeError) {
          console.error("The previous profile image could not be removed.", removeError);
          setNotice("Your profile was saved. The previous picture could not be cleaned up yet.");
        }
      }
      await onSaved(!profile);
    } catch (error: unknown) {
      if (uploadedAvatarPath) {
        const { error: cleanupError } = await supabase.storage
          .from("avatars")
          .remove([uploadedAvatarPath]);
        if (cleanupError) console.error("An unused profile image could not be removed.", cleanupError);
      }
      setErrorMessage(error instanceof Error
        ? error.message
        : "Your Recording Artist Profile could not be saved. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const displayedAvatar = previewUrl || avatarSrc;
  const isCreating = !profile;

  return (
    <section aria-labelledby="profile-form-heading" className="account-card">
      <p className="eyebrow">{isCreating ? "YOUR KEURAOKE IDENTITY" : "PROFILE SETTINGS"}</p>
      <h1 id="profile-form-heading" className="profile-form-heading">
        {isCreating ? "CREATE YOUR RECORDING ARTIST PROFILE" : "EDIT YOUR RECORDING ARTIST PROFILE"}
      </h1>
      <p className="account-description">
        Choose the name and picture people will see with your KEURAOKE performances.
        Your Google email stays private.
      </p>
      <form className="profile-form" onSubmit={(event) => void saveProfile(event)}>
        <div className="profile-image-picker">
          {displayedAvatar
            ? <img alt="Preview of your profile picture" className="profile-avatar" src={displayedAvatar} />
            : <div aria-hidden="true" className="profile-avatar profile-avatar-fallback">🎤</div>}
          <label className="button button-secondary profile-image-button">
            {avatarFile || profile?.avatar_url ? "CHANGE PROFILE PICTURE" : "ADD PROFILE PICTURE"}
            <input
              accept="image/jpeg,image/png,image/webp"
              aria-label="Upload profile picture"
              className="visually-hidden"
              onChange={chooseAvatar}
              type="file"
            />
          </label>
          <span>JPEG, PNG, or WebP · maximum 5 MB</span>
        </div>
        <label className="account-field">
          <span>RECORDING ARTIST NAME / NICKNAME</span>
          <input
            autoComplete="nickname"
            maxLength={40}
            minLength={2}
            onChange={(event) => setArtistName(event.target.value)}
            placeholder="Your artist name"
            required
            value={artistName}
          />
        </label>
        {errorMessage && <p className="account-error" role="alert">{errorMessage}</p>}
        {notice && <p className="account-notice" role="status">{notice}</p>}
        <div className="profile-actions">
          {onCancel && (
            <button className="button button-secondary" disabled={saving} onClick={onCancel} type="button">
              CANCEL
            </button>
          )}
          <button className="button button-play" disabled={saving} type="submit">
            {saving ? "SAVING PROFILE…" : "SAVE PROFILE"}
          </button>
        </div>
      </form>
      <section aria-labelledby="profile-gcash-heading" className="support-card">
          <h2 id="profile-gcash-heading">❤️ SUPPORT KEURAOKE</h2>

            <p className="support-scan-label">
                SCAN TO SUPPORT
                  </p>

                    <Image
                        src="/gcash-qr.png"
                            alt="KEURAOKE GCash support QR code"
                                className="support-qr"
                                    width={1080}
                                        height={1928}
                                            unoptimized
                                              />

                                                <p className="support-message">
                                                    I have my GCash QR Code for anyone who wants to support me.
                                                        Any amount, big or small, helps me continue building KEURAOKE.
                                                            <br />
                                                                <br />
                                                                    Thank you so much for your support. ❤️
                                                                      </p>
                                                                      </section>
    </section>
  );
}
